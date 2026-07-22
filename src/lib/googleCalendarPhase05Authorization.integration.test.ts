import { describe, it, expect, vi } from "vitest";
import {
  handleGoogleCalendarOverlayRequest,
  HandlerDependencies,
  OverlayRequestBody,
} from "../../supabase/functions/google-calendar-overlay/handler.ts";

describe("Phase 05 Authorization & Security Denial Matrix", () => {
  const createMockDeps = (overrides: Partial<HandlerDependencies> = {}): HandlerDependencies => {
    return {
      getUserId: vi.fn().mockResolvedValue("authenticated-user-uuid"),
      hasProGroupFeatures: vi.fn().mockImplementation(async (uid: string | null) => uid === "authenticated-user-uuid"),
      getConnection: vi.fn().mockResolvedValue({
        status: "connected",
        opted_in: true,
        connection_generation: 2,
      }),
      getCredential: vi.fn().mockResolvedValue({
        access_token: "secret-access-token-xyz",
      }),
      readWindowRpc: vi.fn().mockResolvedValue({
        found: false,
        sync_token: null,
        last_synced_at: null,
        events: [],
      }),
      replaceWindowRpc: vi.fn().mockResolvedValue(true),
      applyDeltaRpc: vi.fn().mockResolvedValue(true),
      clearWindowRpc: vi.fn().mockResolvedValue(true),
      fetchOverlayEvents: vi.fn().mockResolvedValue({
        events: [],
        deletedEventIds: [],
        nextSyncToken: "server-only-sync-token-456",
      }),
      ...overrides,
    };
  };

  it("AC16: denies unauthenticated callers (unauthorized JWT exception)", async () => {
    const deps = createMockDeps({
      getUserId: vi.fn().mockRejectedValue(new Error("Unauthorized: missing JWT token")),
    });
    const body: OverlayRequestBody = {
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
    };

    await expect(handleGoogleCalendarOverlayRequest(body, deps)).rejects.toThrow(
      /Unauthorized/
    );
  });

  it("AC16: denies expired or invalid session token", async () => {
    const deps = createMockDeps({
      getUserId: vi.fn().mockRejectedValue(new Error("JWT expired")),
    });
    const body: OverlayRequestBody = {
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
    };

    await expect(handleGoogleCalendarOverlayRequest(body, deps)).rejects.toThrow("JWT expired");
  });

  it("AC16 / AC20: rejects cross-user targetUserId forgery", async () => {
    const deps = createMockDeps();
    const body: OverlayRequestBody = {
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
      targetUserId: "victim-user-uuid",
    };

    await expect(handleGoogleCalendarOverlayRequest(body, deps)).rejects.toThrow(
      /Unauthorized or unknown request parameter/
    );
  });

  it("AC4: returns upgrade_required for unentitled free accounts", async () => {
    const deps = createMockDeps({
      hasProGroupFeatures: vi.fn().mockResolvedValue(false),
    });
    const body: OverlayRequestBody = {
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
    };

    const res = await handleGoogleCalendarOverlayRequest(body, deps);
    expect(res.status).toBe("upgrade_required");
    expect(res.events).toHaveLength(0);
  });

  it("AC2: returns reconnect_required for connected user who has not opted in", async () => {
    const deps = createMockDeps({
      getConnection: vi.fn().mockResolvedValue({
        status: "connected",
        opted_in: false,
        connection_generation: 2,
      }),
    });
    const body: OverlayRequestBody = {
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
    };

    const res = await handleGoogleCalendarOverlayRequest(body, deps);
    expect(res.status).toBe("reconnect_required");
    expect(res.events).toHaveLength(0);
  });

  it("AC14 / AC18: returns reconnect_required for disconnected or revoked accounts", async () => {
    const deps = createMockDeps({
      getConnection: vi.fn().mockResolvedValue({
        status: "disconnected",
        opted_in: false,
        connection_generation: 3,
      }),
    });
    const body: OverlayRequestBody = {
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
    };

    const res = await handleGoogleCalendarOverlayRequest(body, deps);
    expect(res.status).toBe("reconnect_required");
  });

  it("AC17: browser exposure audit guarantees no credentials in response", async () => {
    const deps = createMockDeps({
      fetchOverlayEvents: vi.fn().mockResolvedValue({
        events: [
          {
            provider_event_id: "google-evt-123",
            title: "Private Meeting",
            start_at: "2026-07-22T10:00:00Z",
            end_at: "2026-07-22T11:00:00Z",
            start_date: null,
            end_date: null,
            all_day: false,
          },
        ],
        deletedEventIds: [],
        nextSyncToken: "super-secret-sync-token",
      }),
    });
    const body: OverlayRequestBody = {
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
    };

    const res = await handleGoogleCalendarOverlayRequest(body, deps);
    const serialized = JSON.stringify(res);

    expect(serialized).not.toContain("secret-access-token-xyz");
    expect(serialized).not.toContain("super-secret-sync-token");
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("refresh_token");
  });
});
