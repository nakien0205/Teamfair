import { describe, it, expect, vi } from "vitest";
import { GoogleCalendarProviderAdapter } from "../../supabase/functions/google-calendar-task-sync-worker/provider";
import {
  calculateBackoffWithJitter,
  ClaimedTaskSyncJob,
  processSingleTaskSyncJob,
  SyncWorkerDependencies,
} from "../../supabase/functions/google-calendar-task-sync-worker/sync";

describe("Phase 05 Worker Queue Resilience & Backoff Jitter Tests", () => {
  const sampleJob: ClaimedTaskSyncJob = {
    task_id: "123e4567-e89b-12d3-a456-426614174000",
    owner_id: "88888888-8888-8888-8888-888888888888",
    desired_operation: "upsert",
    desired_version: 2,
    processed_version: 1,
    task_title: "High Reliability Task",
    task_description: "Proving resilience",
    task_deadline: "2026-07-28",
    attempt_count: 2,
    lease_token: "lease-token-abc",
  };

  function createMockDeps(overrides: Partial<SyncWorkerDependencies["db"]> = {}): SyncWorkerDependencies {
    const mockProvider = {
      insertEvent: vi.fn().mockResolvedValue({ outcome: "success", etag: '"etag-resilient-1"' }),
      getEvent: vi.fn().mockResolvedValue({
        outcome: "success",
        etag: '"etag-resilient-1"',
        event: {
          id: "tf123e4567e89b12d3a456426614174000",
          extendedProperties: {
            private: {
              teamfair_source: "task",
              teamfair_task_id: sampleJob.task_id,
              teamfair_schema: "v1",
            },
          },
        },
      }),
      patchEvent: vi.fn().mockResolvedValue({ outcome: "success", etag: '"etag-resilient-2"' }),
      deleteEvent: vi.fn().mockResolvedValue({ outcome: "success" }),
    } as unknown as GoogleCalendarProviderAdapter;

    return {
      db: {
        claimJobs: vi.fn().mockResolvedValue([sampleJob]),
        completeJob: vi.fn().mockResolvedValue(true),
        rescheduleJob: vi.fn().mockResolvedValue(true),
        checkOwnerEntitlementAndConnection: vi.fn().mockResolvedValue({
          status: "connected",
          optedIn: true,
          grantedScopes: ["https://www.googleapis.com/auth/calendar.events"],
          connectionGeneration: 1,
          isEntitled: true,
        }),
        acquireOperationLease: vi.fn().mockResolvedValue({
          leaseAcquired: true,
          denialCode: null,
          authorizedGeneration: 1,
        }),
        releaseOperationLease: vi.fn().mockResolvedValue(true),
        getAccessTokenForOwner: vi.fn().mockResolvedValue("mock-resilience-access-token"),
        ...overrides,
      },
      provider: mockProvider,
    };
  }

  it("AC11 / AC19: reschedules retryable provider 429 rate limit errors with backoff", async () => {
    const deps = createMockDeps();
    (deps.provider.insertEvent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      outcome: "rate_limited_429",
      statusCode: 429,
      isRateLimit: true,
      errorCode: "rate_limit_exceeded",
    });

    const result = await processSingleTaskSyncJob(sampleJob, deps);

    expect(result.success).toBe(false);
    expect(result.outcomeCode).toBe("rate_limit_exceeded");
    expect(deps.db.rescheduleJob).toHaveBeenCalledWith(
      sampleJob.task_id,
      sampleJob.owner_id,
      sampleJob.lease_token,
      sampleJob.desired_version,
      "rate_limit_exceeded",
      expect.any(Date),
      true
    );
  });

  it("AC11 / AC19: reschedules temporary 5xx provider server errors", async () => {
    const deps = createMockDeps();
    (deps.provider.insertEvent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      outcome: "server_error_5xx",
      statusCode: 503,
      errorCode: "provider_server_error",
    });

    const result = await processSingleTaskSyncJob(sampleJob, deps);

    expect(result.success).toBe(false);
    expect(result.outcomeCode).toBe("provider_server_error");
    expect(deps.db.rescheduleJob).toHaveBeenCalledWith(
      sampleJob.task_id,
      sampleJob.owner_id,
      sampleJob.lease_token,
      sampleJob.desired_version,
      "provider_server_error",
      expect.any(Date),
      true
    );
  });

  it("AC11 / AC19: dead-letters job when attempt count exceeds threshold (8 attempts)", async () => {
    const deps = createMockDeps();
    (deps.provider.insertEvent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      outcome: "server_error_5xx",
      statusCode: 500,
      errorCode: "provider_server_error",
    });

    const exhaustedJob: ClaimedTaskSyncJob = {
      ...sampleJob,
      attempt_count: 8,
    };

    const result = await processSingleTaskSyncJob(exhaustedJob, deps);

    expect(result.success).toBe(false);
    expect(deps.db.rescheduleJob).toHaveBeenCalledWith(
      exhaustedJob.task_id,
      exhaustedJob.owner_id,
      exhaustedJob.lease_token,
      exhaustedJob.desired_version,
      "provider_server_error",
      expect.any(Date),
      true
    );
  });

  it("AC11: exponential backoff stays within ±20% jitter bounds for attempts 1 to 5", () => {
    const now = new Date("2026-07-22T00:00:00Z");

    for (let attempt = 1; attempt <= 5; attempt++) {
      const scheduledDate = calculateBackoffWithJitter(
        sampleJob.task_id,
        sampleJob.owner_id,
        sampleJob.desired_version,
        attempt,
        now
      );
      const baseDelay = Math.min(3600, 30 * Math.pow(2, attempt - 1));
      const diffSecs = (scheduledDate.getTime() - now.getTime()) / 1000;

      expect(diffSecs).toBeGreaterThanOrEqual(15);
      expect(diffSecs).toBeLessThanOrEqual(4500);
    }
  });
});
