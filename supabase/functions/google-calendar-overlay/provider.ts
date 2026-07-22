/**
 * Google Calendar Overlay Provider Adapter
 * Path: supabase/functions/google-calendar-overlay/provider.ts
 */

import { isTeamfairOwnedTaskEvent } from "../_shared/googleCalendarEventOwnership.ts";

export interface MinimalOverlayEvent {
  provider_event_id: string;
  title: string | null;
  start_at: string | null;
  end_at: string | null;
  start_date: string | null;
  end_date: string | null;
  all_day: boolean;
}

export interface GoogleCalendarApiEvent {
  id: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export interface FetchOverlayEventsParams {
  accessToken: string;
  rangeStart: string; // YYYY-MM-DD
  rangeEndExclusive: string; // YYYY-MM-DD
  syncToken?: string | null;
  fetchFn?: typeof fetch;
}

export interface FetchOverlayEventsResult {
  events: MinimalOverlayEvent[];
  deletedEventIds: string[];
  nextSyncToken: string | null;
}

export type ProviderErrorCode =
  | "HTTP_410"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "PAGE_LIMIT_EXCEEDED"
  | "RECORD_LIMIT_EXCEEDED";

export class GoogleProviderError extends Error {
  code: ProviderErrorCode;
  status: number;
  retryable: boolean;

  constructor(message: string, code: ProviderErrorCode, status = 500, retryable = true) {
    super(message);
    this.name = "GoogleProviderError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

const MAX_PAGES = 20;
const PAGE_SIZE = 250;
const MAX_EVENTS_TOTAL = 5000;
const FETCH_TIMEOUT_MS = 10000;

export async function fetchGoogleCalendarOverlayEvents(
  params: FetchOverlayEventsParams
): Promise<FetchOverlayEventsResult> {
  const { accessToken, rangeStart, rangeEndExclusive, syncToken, fetchFn = fetch } = params;

  let pageToken: string | null = null;
  let pageCount = 0;
  let nextSyncToken: string | null = null;

  const eventsMap = new Map<string, MinimalOverlayEvent>();
  const deletedEventIds: string[] = [];

  do {
    pageCount++;
    if (pageCount > MAX_PAGES) {
      throw new GoogleProviderError(
        "Google Calendar pagination exceeded maximum page limit of 20",
        "PAGE_LIMIT_EXCEEDED",
        429,
        true
      );
    }

    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");

    if (syncToken) {
      url.searchParams.set("syncToken", syncToken);
    } else {
      // Full sync parameters for range
      const timeMin = new Date(`${rangeStart}T00:00:00Z`).toISOString();
      const timeMax = new Date(`${rangeEndExclusive}T00:00:00Z`).toISOString();
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
    }

    url.searchParams.set("maxResults", String(PAGE_SIZE));
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetchFn(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new GoogleProviderError("Google Calendar API request timed out", "TIMEOUT", 504, true);
      }
      throw new GoogleProviderError(
        `Network error calling Google API: ${err instanceof Error ? err.message : String(err)}`,
        "PROVIDER_ERROR",
        502,
        true
      );
    }
    clearTimeout(timeoutId);

    if (response.status === 410) {
      throw new GoogleProviderError("Sync token is invalid or expired (HTTP 410)", "HTTP_410", 410, true);
    }

    if (response.status === 429) {
      throw new GoogleProviderError("Google API rate limit exceeded", "RATE_LIMIT", 429, true);
    }

    if (!response.ok) {
      throw new GoogleProviderError(
        `Google API error response (HTTP ${response.status})`,
        "PROVIDER_ERROR",
        response.status,
        response.status >= 500
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new GoogleProviderError("Failed to parse Google API response JSON", "PROVIDER_ERROR", 502, true);
    }

    const items = (body.items as GoogleCalendarApiEvent[]) || [];

    for (const item of items) {
      if (!item.id) continue;

      // Filter out Teamfair task mirror events (Phase 3 contract)
      if (isTeamfairOwnedTaskEvent(item)) {
        continue;
      }

      if (item.status === "cancelled") {
        deletedEventIds.push(item.id);
        eventsMap.delete(item.id);
        continue;
      }

      const allDay = Boolean(item.start?.date && !item.start?.dateTime);
      const title = item.summary ? item.summary.trim() : null;

      const minimal: MinimalOverlayEvent = {
        provider_event_id: item.id,
        title,
        start_at: item.start?.dateTime || null,
        end_at: item.end?.dateTime || null,
        start_date: item.start?.date || null,
        end_date: item.end?.date || null,
        all_day: allDay,
      };

      eventsMap.set(item.id, minimal);

      if (eventsMap.size + deletedEventIds.length > MAX_EVENTS_TOTAL) {
        throw new GoogleProviderError(
          "Total events in response exceeded maximum threshold of 5,000",
          "RECORD_LIMIT_EXCEEDED",
          429,
          true
        );
      }
    }

    pageToken = (body.nextPageToken as string) || null;
    if (body.nextSyncToken) {
      nextSyncToken = body.nextSyncToken as string;
    }
  } while (pageToken);

  return {
    events: Array.from(eventsMap.values()),
    deletedEventIds,
    nextSyncToken,
  };
}
