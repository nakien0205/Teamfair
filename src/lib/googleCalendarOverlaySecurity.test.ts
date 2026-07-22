import { describe, it, expect, vi } from "vitest";
import {
  handleGoogleCalendarOverlayRequest,
  HandlerDependencies,
  OverlayRequestBody,
} from "../../supabase/functions/google-calendar-overlay/handler.ts";

import {
  GoogleProviderError,
  fetchGoogleCalendarOverlayEvents,
} from "../../supabase/functions/google-calendar-overlay/provider.ts";

describe("Google Calendar Overlay Security & Authorization Matrix", () => {
  const createMockDeps = (overrides: Partial<HandlerDependencies> = {}): HandlerDependencies => {
    return {
      getUserId: vi.fn().mockResolvedValue("owner-user-uuid"),
      hasProGroupFeatures: vi.fn().mockResolvedValue(true),
      getConnection: vi.fn().mockResolvedValue({
        status: "connected",
        opted_in: true,
        connection_generation: 1,
      }),
      getCredential: vi.fn().mockResolvedValue({
        access_token: "valid-access-token",
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
        events: [
          {
            provider_event_id: "evt-100",
            title: "Private Google Event",
            start_at: "2026-07-25T09:00:00Z",
            end_at: "2026-07-25T10:00:00Z",
            start_date: null,
            end_date: null,
            all_day: false,
          },
        ],
        deletedEventIds: [],
        nextSyncToken: "next-sync-token-999",
      }),
      ...overrides,
    };
  };

  it("returns upgrade_required when signed-in owner lacks Pro Group entitlement", async () => {
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

  it("returns reconnect_required when connection is disconnected or not opted in", async () => {
    const deps = createMockDeps({
      getConnection: vi.fn().mockResolvedValue({
        status: "disconnected",
        opted_in: false,
        connection_generation: 1,
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

  it("rejects unauthorized caller override fields in request body", async () => {
    const deps = createMockDeps();
    const body: OverlayRequestBody = {
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
      targetUserId: "forged-other-user-uuid",
    };

    await expect(handleGoogleCalendarOverlayRequest(body, deps)).rejects.toThrow(
      /Unauthorized or unknown request parameter/
    );
  });

  it("rejects invalid date range or range spanning > 42 days", async () => {
    const deps = createMockDeps();
    const bodyTooLong: OverlayRequestBody = {
      rangeStart: "2026-01-01",
      rangeEndExclusive: "2026-06-01",
    };

    await expect(handleGoogleCalendarOverlayRequest(bodyTooLong, deps)).rejects.toThrow(
      /Range span exceeds maximum threshold of 42 days/
    );
  });

  it("performs HTTP 410 clear and single full sync retry", async () => {
    const mockClear = vi.fn().mockResolvedValue(true);
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new GoogleProviderError("Expired sync token", "HTTP_410", 410, true))
      .mockResolvedValueOnce({
        events: [
          {
            provider_event_id: "retried-evt",
            title: "Resynced Event",
            start_at: "2026-07-25T11:00:00Z",
            end_at: "2026-07-25T12:00:00Z",
            start_date: null,
            end_date: null,
            all_day: false,
          },
        ],
        deletedEventIds: [],
        nextSyncToken: "fresh-sync-token",
      });

    const deps = createMockDeps({
      readWindowRpc: vi.fn().mockResolvedValue({
        found: true,
        sync_token: "expired-sync-token",
        last_synced_at: "2026-07-20T00:00:00Z",
        events: [],
      }),
      clearWindowRpc: mockClear,
      fetchOverlayEvents: mockFetch as unknown as typeof fetchGoogleCalendarOverlayEvents,
    });

    const body: OverlayRequestBody = {
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
    };

    const res = await handleGoogleCalendarOverlayRequest(body, deps);

    expect(mockClear).toHaveBeenCalledWith("owner-user-uuid", 1, "2026-07-01", "2026-08-01");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(res.status).toBe("ready");
  });

  it("proves response contract contains zero access/refresh/sync tokens", async () => {
    const deps = createMockDeps();
    const body: OverlayRequestBody = {
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
    };

    const res = await handleGoogleCalendarOverlayRequest(body, deps);
    const jsonStr = JSON.stringify(res);

    expect(jsonStr).not.toContain("access_token");
    expect(jsonStr).not.toContain("refresh_token");
    expect(jsonStr).not.toContain("sync_token");
    expect(jsonStr).not.toContain("nextSyncToken");
  });
});
