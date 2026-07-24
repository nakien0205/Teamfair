/**
 * Pure Event Identity and Ownership Helper for Teamfair Google Calendar Integration
 * Module: googleCalendarEventOwnership.ts
 */

export const TEAMFAIR_EVENT_ID_PREFIX = "tf";

export const SOURCE_MARKER_KEY = "teamfair_source";
export const SOURCE_MARKER_VALUE = "task";
export const TASK_ID_MARKER_KEY = "teamfair_task_id";
export const SCHEMA_MARKER_KEY = "teamfair_schema";
export const SCHEMA_MARKER_VALUE = "v1";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates whether a string is a canonical hyphenated UUID.
 */
export function isValidCanonicalUuid(uuidStr: string): boolean {
  return UUID_REGEX.test(uuidStr);
}

/**
 * Derives a deterministic Google Calendar Event ID for a task.
 * Format: 'tf' + lowercase task UUID with hyphens removed (34 characters total).
 */
export function deriveGoogleEventId(taskId: string): string {
  const normalized = taskId.trim().toLowerCase();
  if (!isValidCanonicalUuid(normalized)) {
    throw new Error(`Invalid canonical task UUID: "${taskId}"`);
  }
  const hex = normalized.replace(/-/g, "");
  return `${TEAMFAIR_EVENT_ID_PREFIX}${hex}`;
}

/**
 * Calculates the exclusive end date for an all-day Google event (YYYY-MM-DD + 1 day).
 */
export function calculateExclusiveEndNextDay(startDateStr: string): string {
  const dateParts = startDateStr.split("-");
  if (dateParts.length !== 3) {
    throw new Error(`Invalid date string: "${startDateStr}"`);
  }
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);

  const date = new Date(Date.UTC(year, month, day));
  date.setUTCDate(date.getUTCDate() + 1);

  const endYear = date.getUTCFullYear();
  const endMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const endDay = String(date.getUTCDate()).padStart(2, "0");

  return `${endYear}-${endMonth}-${endDay}`;
}

export interface GoogleCalendarEventPayload {
  id?: string;
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  extendedProperties: {
    private: {
      [SOURCE_MARKER_KEY]: typeof SOURCE_MARKER_VALUE;
      [TASK_ID_MARKER_KEY]: string;
      [SCHEMA_MARKER_KEY]: typeof SCHEMA_MARKER_VALUE;
    };
  };
}

/**
 * Constructs the minimal all-day Google Event payload for a Teamfair task.
 */
export function createTaskEventPayload(
  title: string,
  description: string | null | undefined,
  deadlineStr: string,
  taskId: string
): GoogleCalendarEventPayload {
  const canonicalTaskId = taskId.trim().toLowerCase();
  if (!isValidCanonicalUuid(canonicalTaskId)) {
    throw new Error(`Invalid canonical task UUID: "${taskId}"`);
  }
  const eventId = deriveGoogleEventId(canonicalTaskId);
  const endDateStr = calculateExclusiveEndNextDay(deadlineStr);

  return {
    id: eventId,
    summary: title.trim(),
    description: description ? description.trim() : "",
    start: { date: deadlineStr },
    end: { date: endDateStr },
    extendedProperties: {
      private: {
        [SOURCE_MARKER_KEY]: SOURCE_MARKER_VALUE,
        [TASK_ID_MARKER_KEY]: canonicalTaskId,
        [SCHEMA_MARKER_KEY]: SCHEMA_MARKER_VALUE,
      },
    },
  };
}

export interface MinimalGoogleEvent {
  id?: string;
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

/**
 * Verifies whether a remote Google Calendar event is owned by Teamfair and optionally matches a specific task ID.
 */
export function isTeamfairOwnedTaskEvent(
  event: MinimalGoogleEvent | null | undefined,
  expectedTaskId?: string
): boolean {
  if (!event || !event.extendedProperties || !event.extendedProperties.private) {
    return false;
  }
  const priv = event.extendedProperties.private;
  if (priv[SOURCE_MARKER_KEY] !== SOURCE_MARKER_VALUE) {
    return false;
  }
  if (priv[SCHEMA_MARKER_KEY] !== SCHEMA_MARKER_VALUE) {
    return false;
  }
  if (expectedTaskId) {
    const canonicalExpected = expectedTaskId.trim().toLowerCase();
    if (priv[TASK_ID_MARKER_KEY]?.toLowerCase() !== canonicalExpected) {
      return false;
    }
  }
  return true;
}
