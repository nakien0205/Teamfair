import { describe, it, expect, vi } from "vitest";
import {
  fetchGoogleCalendarOverlayEvents,
  GoogleProviderError,
} from "../../supabase/functions/google-calendar-overlay/provider.ts";
import {
  fetchGoogleCalendarOverlay,
  GoogleOverlayResponse,
  MinimalSupabaseClient,
} from "./googleCalendarOverlay";

describe("Google Calendar Overlay Provider Adapter", () => {
  it("fetches single page events and converts to MinimalOverlayEvent", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: "event-1",
            summary: "Team Sync",
            start: { dateTime: "2026-07-25T10:00:00Z" },
            end: { dateTime: "2026-07-25T11:00:00Z" },
          },
          {
            id: "event-2",
            summary: "All Day Conference",
            start: { date: "2026-07-26" },
            end: { date: "2026-07-27" },
          },
        ],
        nextSyncToken: "sync-token-123",
      }),
    });

    const result = await fetchGoogleCalendarOverlayEvents({
      accessToken: "mock-access-token",
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.events).toHaveLength(2);
    expect(result.events[0].provider_event_id).toBe("event-1");
    expect(result.events[0].title).toBe("Team Sync");
    expect(result.events[0].all_day).toBe(false);

    expect(result.events[1].provider_event_id).toBe("event-2");
    expect(result.events[1].all_day).toBe(true);
    expect(result.nextSyncToken).toBe("sync-token-123");
  });

  it("filters out Phase 3 Teamfair task mirror copies", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: "tf00000000000000000000000000000001",
            summary: "Teamfair Task Mirror",
            start: { date: "2026-07-25" },
            end: { date: "2026-07-26" },
            extendedProperties: {
              private: {
                teamfair_source: "task",
                teamfair_task_id: "00000000-0000-0000-0000-000000000001",
                teamfair_schema: "v1",
              },
            },
          },
          {
            id: "real-google-event",
            summary: "Doctor Appointment",
            start: { dateTime: "2026-07-25T14:00:00Z" },
            end: { dateTime: "2026-07-25T15:00:00Z" },
          },
        ],
      }),
    });

    const result = await fetchGoogleCalendarOverlayEvents({
      accessToken: "mock-access-token",
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].provider_event_id).toBe("real-google-event");
    expect(result.events[0].title).toBe("Doctor Appointment");
  });

  it("handles cancelled entries in incremental sync mode", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: "event-old",
            status: "cancelled",
          },
          {
            id: "event-new",
            summary: "New Event",
            start: { dateTime: "2026-07-28T09:00:00Z" },
            end: { dateTime: "2026-07-28T10:00:00Z" },
          },
        ],
        nextSyncToken: "sync-token-456",
      }),
    });

    const result = await fetchGoogleCalendarOverlayEvents({
      accessToken: "mock-access-token",
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
      syncToken: "sync-token-old",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.deletedEventIds).toContain("event-old");
    expect(result.events).toHaveLength(1);
    expect(result.events[0].provider_event_id).toBe("event-new");
  });

  it("invokes the provider lease wrapper once per pagination page", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, json: async () => ({ items: [], nextPageToken: "page-2" }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, json: async () => ({ items: [], nextSyncToken: "done" }),
      });
    const providerRequest = vi.fn(async (request) => request("leased-token"));

    await fetchGoogleCalendarOverlayEvents({
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
      providerRequest,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(providerRequest).toHaveBeenCalledTimes(2);
  });

  it("throws GoogleProviderError HTTP_410 on 410 response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 410,
    });

    await expect(
      fetchGoogleCalendarOverlayEvents({
        accessToken: "mock-access-token",
        rangeStart: "2026-07-01",
        rangeEndExclusive: "2026-08-01",
        syncToken: "invalid-sync-token",
        fetchFn: mockFetch as unknown as typeof fetch,
      })
    ).rejects.toThrow(GoogleProviderError);
  });
});

describe("Browser Client Helper (fetchGoogleCalendarOverlay)", () => {
  it("invokes Edge Function and formats returned response payload", async () => {
    const mockSupabase: MinimalSupabaseClient = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: {
            status: "ready",
            events: [
              {
                providerEventId: "evt-1",
                title: "Client Sync",
                start: { dateTime: "2026-07-25T10:00:00Z" },
                end: { dateTime: "2026-07-25T11:00:00Z" },
                allDay: false,
                readOnly: true,
                source: "google",
              },
            ],
            metadata: {
              refreshedAt: "2026-07-22T20:00:00Z",
              stale: false,
            },
          },
          error: null,
        }),
      },
    };

    const res: GoogleOverlayResponse = await fetchGoogleCalendarOverlay(mockSupabase, {
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
    });

    expect(res.status).toBe("ready");
    expect(res.events).toHaveLength(1);
    expect(res.events[0].providerEventId).toBe("evt-1");
    expect(res.events[0].readOnly).toBe(true);
    expect(res.events[0].source).toBe("google");
  });

  it("gracefully falls back to retryable_error on function invocation error", async () => {
    const mockSupabase: MinimalSupabaseClient = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("Network error"),
        }),
      },
    };

    const res = await fetchGoogleCalendarOverlay(mockSupabase, {
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
    });

    expect(res.status).toBe("retryable_error");
    expect(res.events).toEqual([]);
    expect(res.metadata.stale).toBe(false);
  });
});
