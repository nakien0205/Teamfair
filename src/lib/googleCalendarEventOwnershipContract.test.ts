import { describe, expect, it } from "vitest";
import {
  calculateExclusiveEndNextDay,
  createTaskEventPayload,
  deriveGoogleEventId,
  isTeamfairOwnedTaskEvent,
  isValidCanonicalUuid,
  SCHEMA_MARKER_KEY,
  SCHEMA_MARKER_VALUE,
  SOURCE_MARKER_KEY,
  SOURCE_MARKER_VALUE,
  TASK_ID_MARKER_KEY,
  TEAMFAIR_EVENT_ID_PREFIX,
} from "../../supabase/functions/_shared/googleCalendarEventOwnership";

describe("googleCalendarEventOwnership Contract Tests", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("validates canonical hyphenated UUIDs correctly", () => {
    expect(isValidCanonicalUuid(validUuid)).toBe(true);
    expect(isValidCanonicalUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
    expect(isValidCanonicalUuid("not-a-uuid")).toBe(false);
    expect(isValidCanonicalUuid("123e4567e89b12d3a456426614174000")).toBe(false);
  });

  it("derives deterministic 34-character event ID with 'tf' prefix", () => {
    const eventId = deriveGoogleEventId(validUuid);
    expect(eventId).toBe("tf123e4567e89b12d3a456426614174000");
    expect(eventId.length).toBe(34);
    expect(eventId.startsWith(TEAMFAIR_EVENT_ID_PREFIX)).toBe(true);
  });

  it("throws on invalid UUID for deriveGoogleEventId", () => {
    expect(() => deriveGoogleEventId("invalid-uuid")).toThrow();
  });

  it("calculates exclusive end date exactly one day after deadline", () => {
    expect(calculateExclusiveEndNextDay("2026-07-22")).toBe("2026-07-23");
    expect(calculateExclusiveEndNextDay("2026-12-31")).toBe("2027-01-01");
    expect(calculateExclusiveEndNextDay("2024-02-28")).toBe("2024-02-29"); // leap year
  });

  it("constructs minimal all-day event payload with private ownership markers", () => {
    const payload = createTaskEventPayload(
      "  Final Project Demo  ",
      "  Submit codebase and slides  ",
      "2026-07-22",
      validUuid
    );

    expect(payload.id).toBe("tf123e4567e89b12d3a456426614174000");
    expect(payload.summary).toBe("Final Project Demo");
    expect(payload.description).toBe("Submit codebase and slides");
    expect(payload.start).toEqual({ date: "2026-07-22" });
    expect(payload.end).toEqual({ date: "2026-07-23" });
    expect(payload.extendedProperties.private[SOURCE_MARKER_KEY]).toBe(SOURCE_MARKER_VALUE);
    expect(payload.extendedProperties.private[TASK_ID_MARKER_KEY]).toBe(validUuid);
    expect(payload.extendedProperties.private[SCHEMA_MARKER_KEY]).toBe(SCHEMA_MARKER_VALUE);
  });

  it("validates Teamfair event ownership predicate accurately", () => {
    const validEvent = {
      id: "tf123e4567e89b12d3a456426614174000",
      extendedProperties: {
        private: {
          [SOURCE_MARKER_KEY]: SOURCE_MARKER_VALUE,
          [TASK_ID_MARKER_KEY]: validUuid,
          [SCHEMA_MARKER_KEY]: SCHEMA_MARKER_VALUE,
        },
      },
    };

    expect(isTeamfairOwnedTaskEvent(validEvent)).toBe(true);
    expect(isTeamfairOwnedTaskEvent(validEvent, validUuid)).toBe(true);
    expect(isTeamfairOwnedTaskEvent(validEvent, "99999999-9999-9999-9999-999999999999")).toBe(false);

    // Missing markers or wrong values
    expect(isTeamfairOwnedTaskEvent(null)).toBe(false);
    expect(isTeamfairOwnedTaskEvent({})).toBe(false);
    expect(
      isTeamfairOwnedTaskEvent({
        extendedProperties: {
          private: { [SOURCE_MARKER_KEY]: "other_source" },
        },
      })
    ).toBe(false);
  });
});
