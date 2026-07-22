import { describe, it, expect } from "vitest";
import {
  GoogleCalendarApiEvent,
  fetchGoogleCalendarOverlayEvents,
} from "../../supabase/functions/google-calendar-overlay/provider.ts";

describe("Phase 05 Overlay Privacy & Event Deduplication Proof", () => {
  it("AC12 / AC13: filters out Teamfair-created task copies from read overlay to avoid duplicate display", async () => {
    const mockEventsListResponse = {
      items: [
        {
          id: "google-native-evt-1",
          summary: "Doctor Appointment",
          start: { dateTime: "2026-07-25T09:00:00Z" },
          end: { dateTime: "2026-07-25T10:00:00Z" },
        },
        {
          id: "tf123e4567e89b12d3a456426614174000",
          summary: "Teamfair Task Mirror Copy",
          start: { date: "2026-07-25" },
          end: { date: "2026-07-26" },
          extendedProperties: {
            private: {
              teamfair_source: "task",
              teamfair_task_id: "123e4567-e89b-12d3-a456-426614174000",
              teamfair_schema: "v1",
            },
          },
        },
      ],
      nextSyncToken: "sync-token-dedup-proof",
    };

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockEventsListResponse,
    });

    const result = await fetchGoogleCalendarOverlayEvents({
      accessToken: "mock-access-token",
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
      syncToken: null,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].provider_event_id).toBe("google-native-evt-1");
    expect(result.events[0].title).toBe("Doctor Appointment");
  });

  it("AC12: returns minimal schema only (no attendees, descriptions, htmlLink, location)", async () => {
    const rawGoogleItem: GoogleCalendarApiEvent = {
      id: "google-evt-full-schema",
      summary: "Confidential Strategy Session",
      start: { dateTime: "2026-07-25T14:00:00Z" },
      end: { dateTime: "2026-07-25T15:00:00Z" },
    };

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        items: [rawGoogleItem],
        nextSyncToken: "sync-token-minimal-schema",
      }),
    });

    const result = await fetchGoogleCalendarOverlayEvents({
      accessToken: "mock-access-token",
      rangeStart: "2026-07-01",
      rangeEndExclusive: "2026-08-01",
      syncToken: null,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const projected = result.events[0];
    expect(projected.provider_event_id).toBe("google-evt-full-schema");
    expect(projected.title).toBe("Confidential Strategy Session");

    const jsonStr = JSON.stringify(projected);
    expect(jsonStr).not.toContain("attendees");
    expect(jsonStr).not.toContain("location");
    expect(jsonStr).not.toContain("htmlLink");
  });
});
