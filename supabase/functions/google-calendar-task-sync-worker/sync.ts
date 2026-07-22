/**
 * Pure Sync Job Orchestrator for Task-to-Google Write Sync
 * Module: sync.ts
 */

import {
  createTaskEventPayload,
  deriveGoogleEventId,
  isTeamfairOwnedTaskEvent,
} from "../_shared/googleCalendarEventOwnership.ts";
import { GoogleCalendarProviderAdapter, ProviderResult } from "./provider.ts";

export interface ClaimedTaskSyncJob {
  task_id: string;
  owner_id: string;
  desired_operation: "upsert" | "delete";
  desired_version: number;
  processed_version: number;
  task_title: string | null;
  task_description: string | null;
  task_deadline: string | null;
  attempt_count: number;
  lease_token: string;
}

export interface SyncWorkerDependencies {
  db: {
    claimJobs(workerId: string, batchSize: number, leaseSeconds: number): Promise<ClaimedTaskSyncJob[]>;
    completeJob(
      taskId: string,
      ownerId: string,
      leaseToken: string,
      claimedVersion: number,
      googleEventId: string | null,
      etag: string | null,
      connectionGeneration?: number
    ): Promise<boolean>;
    rescheduleJob(
      taskId: string,
      ownerId: string,
      leaseToken: string,
      claimedVersion: number,
      outcomeCode: string,
      availableAt: Date | null,
      consumeAttempt: boolean
    ): Promise<boolean>;
    checkOwnerEntitlementAndConnection(
      ownerId: string
    ): Promise<{
      status: string;
      optedIn: boolean;
      grantedScopes: string[];
      connectionGeneration: number;
      isEntitled: boolean;
    }>;
    acquireOperationLease(
      ownerId: string,
      expectedGeneration: number,
      operationId: string,
      purpose: string,
      requestedTtlSeconds: number
    ): Promise<{
      leaseAcquired: boolean;
      denialCode: string | null;
      authorizedGeneration: number;
    }>;
    releaseOperationLease(ownerId: string, operationId: string): Promise<boolean>;
    getAccessTokenForOwner(ownerId: string): Promise<string | null>;
  };
  provider: GoogleCalendarProviderAdapter;
  nowProvider?: () => Date;
}

export function calculateBackoffWithJitter(
  taskId: string,
  ownerId: string,
  desiredVersion: number,
  attemptCount: number,
  now: Date
): Date {
  const baseSeconds = Math.min(3600, 30 * Math.pow(2, Math.max(0, attemptCount - 1)));
  
  // Deterministic pseudo-jitter from inputs
  const hashString = `${taskId}:${ownerId}:${desiredVersion}:${attemptCount}`;
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    hash = (hash << 5) - hash + hashString.charCodeAt(i);
    hash |= 0;
  }
  const normalizedJitter = ((Math.abs(hash) % 40) - 20) / 100; // -0.20 to +0.20
  const finalSeconds = Math.max(1, Math.round(baseSeconds * (1 + normalizedJitter)));

  return new Date(now.getTime() + finalSeconds * 1000);
}

export async function processSingleTaskSyncJob(
  job: ClaimedTaskSyncJob,
  deps: SyncWorkerDependencies
): Promise<{ success: boolean; outcomeCode: string }> {
  const now = deps.nowProvider ? deps.nowProvider() : new Date();

  // 1. Authoritative Preflight Check
  const connState = await deps.db.checkOwnerEntitlementAndConnection(job.owner_id);

  if (connState.status !== "connected") {
    await deps.db.rescheduleJob(
      job.task_id,
      job.owner_id,
      job.lease_token,
      job.desired_version,
      "not_connected",
      null,
      false
    );
    return { success: false, outcomeCode: "not_connected" };
  }

  if (!connState.optedIn) {
    await deps.db.rescheduleJob(
      job.task_id,
      job.owner_id,
      job.lease_token,
      job.desired_version,
      "not_opted_in",
      null,
      false
    );
    return { success: false, outcomeCode: "not_opted_in" };
  }

  if (!connState.isEntitled) {
    await deps.db.rescheduleJob(
      job.task_id,
      job.owner_id,
      job.lease_token,
      job.desired_version,
      "entitlement_required",
      null,
      false
    );
    return { success: false, outcomeCode: "entitlement_required" };
  }

  const REQUIRED_SCOPE = "https://www.googleapis.com/auth/calendar.events";
  const hasScope = connState.grantedScopes.some(
    s => s === REQUIRED_SCOPE || s === "https://www.googleapis.com/auth/calendar"
  );
  if (!hasScope) {
    await deps.db.rescheduleJob(
      job.task_id,
      job.owner_id,
      job.lease_token,
      job.desired_version,
      "scope_missing",
      null,
      false
    );
    return { success: false, outcomeCode: "scope_missing" };
  }

  // 2. Acquire Operation Lease
  const operationId = crypto.randomUUID();
  const leaseResult = await deps.db.acquireOperationLease(
    job.owner_id,
    connState.connectionGeneration,
    operationId,
    "task_event_write",
    30
  );

  if (!leaseResult.leaseAcquired) {
    await deps.db.rescheduleJob(
      job.task_id,
      job.owner_id,
      job.lease_token,
      job.desired_version,
      leaseResult.denialCode || "lease_denied",
      null,
      false
    );
    return { success: false, outcomeCode: leaseResult.denialCode || "lease_denied" };
  }

  try {
    // 3. Get Credential
    const accessToken = await deps.db.getAccessTokenForOwner(job.owner_id);
    if (!accessToken) {
      await deps.db.rescheduleJob(
        job.task_id,
        job.owner_id,
        job.lease_token,
        job.desired_version,
        "credential_unreadable",
        null,
        false
      );
      return { success: false, outcomeCode: "credential_unreadable" };
    }

    const deterministicEventId = deriveGoogleEventId(job.task_id);

    // 4. Execute Remote Operation
    if (job.desired_operation === "upsert") {
      if (!job.task_title || !job.task_deadline) {
        await deps.db.rescheduleJob(
          job.task_id,
          job.owner_id,
          job.lease_token,
          job.desired_version,
          "invalid_task_snapshot",
          null,
          false
        );
        return { success: false, outcomeCode: "invalid_task_snapshot" };
      }

      const payload = createTaskEventPayload(
        job.task_title,
        job.task_description,
        job.task_deadline,
        job.task_id
      );

      let result: ProviderResult = await deps.provider.insertEvent(accessToken, payload);

      if (result.outcome === "conflict_409") {
        // Fetch existing event & verify marker ownership
        const getRes = await deps.provider.getEvent(accessToken, deterministicEventId);
        if (getRes.outcome === "success" && isTeamfairOwnedTaskEvent(getRes.event, job.task_id)) {
          // Update owned event
          result = await deps.provider.patchEvent(
            accessToken,
            deterministicEventId,
            payload,
            getRes.etag
          );
        } else {
          // Ownership mismatch! Dead-letter row
          await deps.db.rescheduleJob(
            job.task_id,
            job.owner_id,
            job.lease_token,
            job.desired_version,
            "ownership_conflict",
            null,
            true
          );
          return { success: false, outcomeCode: "ownership_conflict" };
        }
      }

      if (result.outcome === "success") {
        const completed = await deps.db.completeJob(
          job.task_id,
          job.owner_id,
          job.lease_token,
          job.desired_version,
          deterministicEventId,
          result.etag || null,
          connState.connectionGeneration
        );
        return { success: completed, outcomeCode: "success" };
      }

      // Retry / Pause classification for failed insert/patch
      return await handleProviderFailure(job, result, deps, now);
    } else {
      // desired_operation === 'delete'
      const getRes = await deps.provider.getEvent(accessToken, deterministicEventId);

      if (getRes.outcome === "not_found_404" || getRes.outcome === "gone_410") {
        // Event already gone; complete delete tombstone
        const completed = await deps.db.completeJob(
          job.task_id,
          job.owner_id,
          job.lease_token,
          job.desired_version,
          deterministicEventId,
          null,
          connState.connectionGeneration
        );
        return { success: completed, outcomeCode: "success" };
      }

      if (getRes.outcome === "success") {
        if (!isTeamfairOwnedTaskEvent(getRes.event, job.task_id)) {
          // Ownership mismatch; do not delete remote event, dead-letter
          await deps.db.rescheduleJob(
            job.task_id,
            job.owner_id,
            job.lease_token,
            job.desired_version,
            "ownership_conflict",
            null,
            true
          );
          return { success: false, outcomeCode: "ownership_conflict" };
        }

        const delRes = await deps.provider.deleteEvent(accessToken, deterministicEventId);
        if (delRes.outcome === "success" || delRes.outcome === "not_found_404" || delRes.outcome === "gone_410") {
          const completed = await deps.db.completeJob(
            job.task_id,
            job.owner_id,
            job.lease_token,
            job.desired_version,
            deterministicEventId,
            null,
            connState.connectionGeneration
          );
          return { success: completed, outcomeCode: "success" };
        }

        return await handleProviderFailure(job, delRes, deps, now);
      }

      return await handleProviderFailure(job, getRes, deps, now);
    }
  } finally {
    await deps.db.releaseOperationLease(job.owner_id, operationId);
  }
}

async function handleProviderFailure(
  job: ClaimedTaskSyncJob,
  result: ProviderResult,
  deps: SyncWorkerDependencies,
  now: Date
): Promise<{ success: boolean; outcomeCode: string }> {
  if (result.outcome === "unauthorized_401") {
    await deps.db.rescheduleJob(
      job.task_id,
      job.owner_id,
      job.lease_token,
      job.desired_version,
      "reconnect_required",
      null,
      false
    );
    return { success: false, outcomeCode: "reconnect_required" };
  }

  if (result.outcome === "forbidden_403" && !result.isRateLimit) {
    await deps.db.rescheduleJob(
      job.task_id,
      job.owner_id,
      job.lease_token,
      job.desired_version,
      "scope_missing",
      null,
      false
    );
    return { success: false, outcomeCode: "scope_missing" };
  }

  if (result.outcome === "bad_request_400") {
    await deps.db.rescheduleJob(
      job.task_id,
      job.owner_id,
      job.lease_token,
      job.desired_version,
      "invalid_payload",
      null,
      true
    );
    return { success: false, outcomeCode: "invalid_payload" };
  }

  // Transient retryable errors (5xx, 429, 403 rate limit, timeout/network)
  const nextAvailableAt = calculateBackoffWithJitter(
    job.task_id,
    job.owner_id,
    job.desired_version,
    job.attempt_count + 1,
    now
  );
  const errorCode = result.errorCode || "transient_failure";

  await deps.db.rescheduleJob(
    job.task_id,
    job.owner_id,
    job.lease_token,
    job.desired_version,
    errorCode,
    nextAvailableAt,
    true
  );

  return { success: false, outcomeCode: errorCode };
}

export async function runTaskSyncWorkerBatch(
  workerId: string,
  batchSize: number,
  deps: SyncWorkerDependencies
): Promise<{ claimedCount: number; processedCount: number }> {
  const jobs = await deps.db.claimJobs(workerId, batchSize, 300);
  let processedCount = 0;

  for (const job of jobs) {
    const res = await processSingleTaskSyncJob(job, deps);
    if (res.success) {
      processedCount++;
    }
  }

  return { claimedCount: jobs.length, processedCount };
}
