import { describe, expect, it, vi } from "vitest";
import { GoogleCalendarProviderAdapter } from "../../supabase/functions/google-calendar-task-sync-worker/provider";
import {
  calculateBackoffWithJitter,
  ClaimedTaskSyncJob,
  processSingleTaskSyncJob,
  runTaskSyncWorkerBatch,
  SyncWorkerDependencies,
} from "../../supabase/functions/google-calendar-task-sync-worker/sync";

describe("Google Calendar Task Sync Contract Tests", () => {
  const sampleJob: ClaimedTaskSyncJob = {
    task_id: "123e4567-e89b-12d3-a456-426614174000",
    owner_id: "88888888-8888-8888-8888-888888888888",
    desired_operation: "upsert",
    desired_version: 1,
    processed_version: 0,
    task_title: "Test Task",
    task_description: "Test Description",
    task_deadline: "2026-07-22",
    attempt_count: 0,
    lease_token: "99999999-9999-9999-9999-999999999999",
  };

  function createMockDeps(overrides: Partial<SyncWorkerDependencies["db"]> = {}): SyncWorkerDependencies {
    const mockProvider = {
      insertEvent: vi.fn().mockResolvedValue({ outcome: "success", etag: '"etag-123"' }),
      getEvent: vi.fn().mockResolvedValue({
        outcome: "success",
        etag: '"etag-123"',
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
      patchEvent: vi.fn().mockResolvedValue({ outcome: "success", etag: '"etag-124"' }),
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
          grantedScopes: ["https://www.googleapis.com/auth/calendar.events.owned"],
          connectionGeneration: 1,
          isEntitled: true,
        }),
        withGoogleCalendarProviderRequest: vi.fn(async (_ownerId, _generation, _purpose, request) =>
          request("mock-access-token")
        ),
        ...overrides,
      },
      provider: mockProvider,
    };
  }

  it("completes upsert job successfully on first attempt", async () => {
    const deps = createMockDeps();
    const result = await processSingleTaskSyncJob(sampleJob, deps);

    expect(result.success).toBe(true);
    expect(result.outcomeCode).toBe("success");
    expect(deps.db.withGoogleCalendarProviderRequest).toHaveBeenCalledTimes(1);
    expect(deps.db.completeJob).toHaveBeenCalledWith(
      sampleJob.task_id,
      sampleJob.owner_id,
      sampleJob.lease_token,
      1,
      "tf123e4567e89b12d3a456426614174000",
      '"etag-123"',
      1
    );
  });

  it("pauses job if user is not opted in", async () => {
    const deps = createMockDeps({
      checkOwnerEntitlementAndConnection: vi.fn().mockResolvedValue({
        status: "connected",
        optedIn: false,
        grantedScopes: ["https://www.googleapis.com/auth/calendar.events.owned"],
        connectionGeneration: 1,
        isEntitled: true,
      }),
    });

    const result = await processSingleTaskSyncJob(sampleJob, deps);

    expect(result.success).toBe(false);
    expect(result.outcomeCode).toBe("not_opted_in");
    expect(deps.db.rescheduleJob).toHaveBeenCalledWith(
      sampleJob.task_id,
      sampleJob.owner_id,
      sampleJob.lease_token,
      1,
      "not_opted_in",
      null,
      false
    );
  });

  it("pauses job if user is not entitled (e.g. free plan)", async () => {
    const deps = createMockDeps({
      checkOwnerEntitlementAndConnection: vi.fn().mockResolvedValue({
        status: "connected",
        optedIn: true,
        grantedScopes: ["https://www.googleapis.com/auth/calendar.events"],
        connectionGeneration: 1,
        isEntitled: false,
      }),
    });

    const result = await processSingleTaskSyncJob(sampleJob, deps);

    expect(result.success).toBe(false);
    expect(result.outcomeCode).toBe("entitlement_required");
  });

  it("handles 409 conflict by fetching existing event and patching if owned", async () => {
    const deps = createMockDeps();
    (deps.provider.insertEvent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      outcome: "conflict_409",
    });

    const result = await processSingleTaskSyncJob(sampleJob, deps);

    expect(result.success).toBe(true);
    expect(deps.provider.getEvent).toHaveBeenCalled();
    expect(deps.provider.patchEvent).toHaveBeenCalled();
    expect(deps.db.withGoogleCalendarProviderRequest).toHaveBeenCalledTimes(3);
  });

  it("dead-letters job if 409 conflict event is NOT owned by Teamfair", async () => {
    const deps = createMockDeps();
    (deps.provider.insertEvent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      outcome: "conflict_409",
    });
    (deps.provider.getEvent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      outcome: "success",
      event: { id: "tf123e4567e89b12d3a456426614174000", extendedProperties: { private: {} } }, // missing markers
    });

    const result = await processSingleTaskSyncJob(sampleJob, deps);

    expect(result.success).toBe(false);
    expect(result.outcomeCode).toBe("ownership_conflict");
    expect(deps.db.rescheduleJob).toHaveBeenCalledWith(
      sampleJob.task_id,
      sampleJob.owner_id,
      sampleJob.lease_token,
      1,
      "ownership_conflict",
      null,
      true
    );
  });

  it("calculates backoff with deterministic jitter between -20% and +20%", () => {
    const now = new Date("2026-07-22T12:00:00Z");
    const backoffDate1 = calculateBackoffWithJitter(sampleJob.task_id, sampleJob.owner_id, 1, 1, now);
    const backoffDate2 = calculateBackoffWithJitter(sampleJob.task_id, sampleJob.owner_id, 1, 1, now);

    expect(backoffDate1.getTime()).toBe(backoffDate2.getTime()); // deterministic
    const diffSecs = (backoffDate1.getTime() - now.getTime()) / 1000;
    expect(diffSecs).toBeGreaterThanOrEqual(24); // 30s * 0.8
    expect(diffSecs).toBeLessThanOrEqual(36); // 30s * 1.2
  });

  it("runs worker batch processing cleanly", async () => {
    const deps = createMockDeps();
    const result = await runTaskSyncWorkerBatch("worker-1", 10, deps);

    expect(result.claimedCount).toBe(1);
    expect(result.processedCount).toBe(1);
  });
});
