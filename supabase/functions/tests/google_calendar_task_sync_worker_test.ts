import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  calculateExclusiveEndNextDay,
  createTaskEventPayload,
  deriveGoogleEventId,
  isTeamfairOwnedTaskEvent,
} from "../_shared/googleCalendarEventOwnership.ts";
import { GoogleCalendarProviderAdapter } from "../google-calendar-task-sync-worker/provider.ts";
import {
  calculateBackoffWithJitter,
  ClaimedTaskSyncJob,
  processSingleTaskSyncJob,
  runTaskSyncWorkerBatch,
  SyncWorkerDependencies,
} from "../google-calendar-task-sync-worker/sync.ts";

const validUuid = "123e4567-e89b-12d3-a456-426614174000";

Deno.test("Event ownership helper derives 34-char deterministic ID", () => {
  const eventId = deriveGoogleEventId(validUuid);
  assertEquals(eventId, "tf123e4567e89b12d3a456426614174000");
  assertEquals(eventId.length, 34);
});

Deno.test("Event ownership helper calculates exclusive next day", () => {
  assertEquals(calculateExclusiveEndNextDay("2026-07-22"), "2026-07-23");
});

Deno.test("Event ownership helper constructs payload with private markers", () => {
  const payload = createTaskEventPayload("Test Task", "Desc", "2026-07-22", validUuid);
  assertEquals(payload.summary, "Test Task");
  assertEquals(payload.extendedProperties.private.teamfair_source, "task");
  assertEquals(payload.extendedProperties.private.teamfair_task_id, validUuid);
  assertEquals(payload.extendedProperties.private.teamfair_schema, "v1");
});

Deno.test("Worker processes single job successfully", async () => {
  const sampleJob: ClaimedTaskSyncJob = {
    task_id: validUuid,
    owner_id: "88888888-8888-8888-8888-888888888888",
    desired_operation: "upsert",
    desired_version: 1,
    processed_version: 0,
    task_title: "Test Task",
    task_description: "Desc",
    task_deadline: "2026-07-22",
    attempt_count: 0,
    lease_token: "token-123",
  };

  const fakeDeps: SyncWorkerDependencies = {
    db: {
      claimJobs: async () => [sampleJob],
      completeJob: async () => true,
      rescheduleJob: async () => true,
      checkOwnerEntitlementAndConnection: async () => ({
        status: "connected",
        optedIn: true,
        grantedScopes: ["https://www.googleapis.com/auth/calendar.events"],
        connectionGeneration: 1,
        isEntitled: true,
      }),
      acquireOperationLease: async () => ({
        leaseAcquired: true,
        denialCode: null,
        authorizedGeneration: 1,
      }),
      releaseOperationLease: async () => true,
      getAccessTokenForOwner: async () => "mock-token",
    },
    provider: {
      insertEvent: async () => ({ outcome: "success", etag: '"etag-1"' }),
      getEvent: async () => ({ outcome: "success" }),
      patchEvent: async () => ({ outcome: "success" }),
      deleteEvent: async () => ({ outcome: "success" }),
    } as unknown as GoogleCalendarProviderAdapter,
  };

  const result = await processSingleTaskSyncJob(sampleJob, fakeDeps);
  assertEquals(result.success, true);
  assertEquals(result.outcomeCode, "success");
});
