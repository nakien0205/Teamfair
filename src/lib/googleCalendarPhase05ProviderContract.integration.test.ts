import { describe, it, expect } from "vitest";
import {
  calculateExclusiveEndNextDay,
  createTaskEventPayload,
  deriveGoogleEventId,
  isTeamfairOwnedTaskEvent,
} from "../../supabase/functions/_shared/googleCalendarEventOwnership";

describe("Phase 05 Provider Contract & Event Identity Integration Proof", () => {
  const validTaskId = "550e8400-e29b-41d4-a716-446655440000";

  it("AC7: derives deterministic 34-char provider event ID with 'tf' prefix", () => {
    const providerId = deriveGoogleEventId(validTaskId);
    expect(providerId).toBe("tf550e8400e29b41d4a716446655440000");
    expect(providerId).toHaveLength(34);
    expect(providerId.startsWith("tf")).toBe(true);
  });

  it("AC7 / AC8: constructs valid all-day event payload with exclusive next-day end date", () => {
    const payload = createTaskEventPayload(
      "Sprint 5 Code Freeze",
      "All pull requests merged and verified",
      "2026-07-22",
      validTaskId
    );

    expect(payload.id).toBe("tf550e8400e29b41d4a716446655440000");
    expect(payload.summary).toBe("Sprint 5 Code Freeze");
    expect(payload.start).toEqual({ date: "2026-07-22" });
    expect(payload.end).toEqual({ date: "2026-07-23" });
    expect(calculateExclusiveEndNextDay("2026-07-22")).toBe("2026-07-23");
  });

  it("AC9 / AC10: proves Teamfair ownership marker validation prevents modifying non-Teamfair events", () => {
    const teamfairOwnedEvent = {
      id: deriveGoogleEventId(validTaskId),
      extendedProperties: {
        private: {
          teamfair_source: "task",
          teamfair_task_id: validTaskId,
          teamfair_schema: "v1",
        },
      },
    };

    const userPersonalGoogleEvent = {
      id: "personal-google-calendar-event-id-999",
      summary: "Doctor Appointment",
      start: { dateTime: "2026-07-22T14:00:00Z" },
      end: { dateTime: "2026-07-22T15:00:00Z" },
    };

    expect(isTeamfairOwnedTaskEvent(teamfairOwnedEvent, validTaskId)).toBe(true);
    expect(isTeamfairOwnedTaskEvent(userPersonalGoogleEvent)).toBe(false);
    expect(isTeamfairOwnedTaskEvent(userPersonalGoogleEvent, validTaskId)).toBe(false);
  });
});
