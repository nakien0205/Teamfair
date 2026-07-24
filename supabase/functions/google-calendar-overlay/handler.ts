/**
 * Google Calendar Overlay Request Handler
 * Path: supabase/functions/google-calendar-overlay/handler.ts
 */

import {
  fetchGoogleCalendarOverlayEvents,
  GoogleProviderError,
  MinimalOverlayEvent,
} from "./provider.ts";

export interface OverlayRequestBody {
  rangeStart: string;
  rangeEndExclusive: string;
  reason?: "open" | "navigate" | "manual";
  [key: string]: unknown; // Used to detect unauthorized unknown fields
}

export interface MinimalBrowserEvent {
  providerEventId: string;
  title: string;
  start: { date: string } | { dateTime: string };
  end: { date: string } | { dateTime: string };
  allDay: boolean;
  readOnly: true;
  source: "google";
}

export type OverlayStatus =
  | "ready"
  | "stale"
  | "upgrade_required"
  | "reconnect_required"
  | "retryable_error";

export interface OverlayResponsePayload {
  status: OverlayStatus;
  events: MinimalBrowserEvent[];
  metadata: {
    refreshedAt: string | null;
    stale: boolean;
    retryAfterSeconds?: number;
  };
}

export interface ConnectionState {
  status: string;
  opted_in: boolean;
  connection_generation: number;
}

export interface HandlerDependencies {
  getUserId: () => Promise<string>;
  hasProGroupFeatures: (userId: string) => Promise<boolean>;
  getConnection: (userId: string) => Promise<ConnectionState | null>;
  withGoogleCalendarProviderRequest: <T>(
    userId: string,
    generation: number,
    request: (accessToken: string) => Promise<T>
  ) => Promise<T>;
  readWindowRpc: (
    userId: string,
    generation: number,
    rangeStart: string,
    rangeEndExclusive: string
  ) => Promise<{
    found: boolean;
    sync_token: string | null;
    last_synced_at: string | null;
    events: MinimalOverlayEvent[];
  }>;
  replaceWindowRpc: (
    userId: string,
    generation: number,
    rangeStart: string,
    rangeEndExclusive: string,
    syncToken: string | null,
    events: MinimalOverlayEvent[]
  ) => Promise<boolean>;
  applyDeltaRpc: (
    userId: string,
    generation: number,
    rangeStart: string,
    rangeEndExclusive: string,
    syncToken: string | null,
    upsertEvents: MinimalOverlayEvent[],
    deletedEventIds: string[]
  ) => Promise<boolean>;
  clearWindowRpc: (
    userId: string,
    generation: number,
    rangeStart: string,
    rangeEndExclusive: string
  ) => Promise<boolean>;
  fetchOverlayEvents?: typeof fetchGoogleCalendarOverlayEvents;
}

const ALLOWED_BODY_KEYS = new Set(["rangeStart", "rangeEndExclusive", "reason"]);

export function mapToMinimalBrowserEvent(event: MinimalOverlayEvent): MinimalBrowserEvent {
  const title = event.title && event.title.trim() ? event.title.trim() : "Untitled event";

  let startObj: { date: string } | { dateTime: string };
  let endObj: { date: string } | { dateTime: string };

  if (event.all_day) {
    startObj = { date: event.start_date || "1970-01-01" };
    endObj = { date: event.end_date || event.start_date || "1970-01-01" };
  } else {
    startObj = { dateTime: event.start_at || new Date().toISOString() };
    endObj = { dateTime: event.end_at || event.start_at || new Date().toISOString() };
  }

  return {
    providerEventId: event.provider_event_id,
    title,
    start: startObj,
    end: endObj,
    allDay: event.all_day,
    readOnly: true,
    source: "google",
  };
}

export function isCacheFreshForStale(lastSyncedAtStr: string | null): boolean {
  if (!lastSyncedAtStr) return false;
  const syncedTime = new Date(lastSyncedAtStr).getTime();
  if (isNaN(syncedTime)) return false;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - syncedTime <= thirtyDaysMs;
}

export async function handleGoogleCalendarOverlayRequest(
  body: OverlayRequestBody,
  deps: HandlerDependencies
): Promise<OverlayResponsePayload> {
  // Reject unknown fields or owner override attempts
  const bodyKeys = Object.keys(body);
  for (const key of bodyKeys) {
    if (!ALLOWED_BODY_KEYS.has(key)) {
      throw new Error(`Unauthorized or unknown request parameter: "${key}"`);
    }
  }

  const { rangeStart, rangeEndExclusive } = body;
  if (!rangeStart || !rangeEndExclusive) {
    throw new Error("Missing required parameters rangeStart and rangeEndExclusive");
  }

  const startMs = new Date(rangeStart).getTime();
  const endMs = new Date(rangeEndExclusive).getTime();

  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
    throw new Error("Invalid rangeStart or rangeEndExclusive; end must be after start");
  }

  const durationDays = (endMs - startMs) / (1000 * 60 * 60 * 24);
  if (durationDays > 42) {
    throw new Error("Range span exceeds maximum threshold of 42 days");
  }

  // 1. Derive verified owner identity
  const userId = await deps.getUserId();

  // 2. Check entitlement
  const isEntitled = await deps.hasProGroupFeatures(userId);
  if (!isEntitled) {
    return {
      status: "upgrade_required",
      events: [],
      metadata: { refreshedAt: null, stale: false },
    };
  }

  // 3. Check connection and opt-in
  const connection = await deps.getConnection(userId);
  if (!connection || connection.status !== "connected" || !connection.opted_in) {
    return {
      status: "reconnect_required",
      events: [],
      metadata: { refreshedAt: null, stale: false },
    };
  }

  const generation = connection.connection_generation;

  // 4. Read current cached window cursor
  const cachedWindow = await deps.readWindowRpc(userId, generation, rangeStart, rangeEndExclusive);

  const fetchEvents = deps.fetchOverlayEvents || fetchGoogleCalendarOverlayEvents;
  const providerRequest = <T>(request: (accessToken: string) => Promise<T>) =>
    deps.withGoogleCalendarProviderRequest(userId, generation, request);

  let fetchResult;
  let isFullSync = !cachedWindow.found || !cachedWindow.sync_token;

  try {
    fetchResult = await fetchEvents({
      rangeStart,
      rangeEndExclusive,
      syncToken: isFullSync ? null : cachedWindow.sync_token,
      providerRequest,
    });
  } catch (err: unknown) {
    if (err instanceof GoogleProviderError && err.code === "HTTP_410") {
      // Clear window state and perform one full sync retry
      await deps.clearWindowRpc(userId, generation, rangeStart, rangeEndExclusive);
      isFullSync = true;

      try {
        fetchResult = await fetchEvents({
          rangeStart,
          rangeEndExclusive,
          syncToken: null,
          providerRequest,
        });
      } catch (retryErr: unknown) {
        // Retry failed; fall back to stale or retryable error
        if (cachedWindow.found && isCacheFreshForStale(cachedWindow.last_synced_at)) {
          return {
            status: "stale",
            events: cachedWindow.events.map(mapToMinimalBrowserEvent),
            metadata: {
              refreshedAt: cachedWindow.last_synced_at,
              stale: true,
              retryAfterSeconds: 30,
            },
          };
        }
        return {
          status: "retryable_error",
          events: [],
          metadata: { refreshedAt: null, stale: false, retryAfterSeconds: 30 },
        };
      }
    } else {
      // Other provider errors: serve stale cache if available and fresh
      if (cachedWindow.found && isCacheFreshForStale(cachedWindow.last_synced_at)) {
        return {
          status: "stale",
          events: cachedWindow.events.map(mapToMinimalBrowserEvent),
          metadata: {
            refreshedAt: cachedWindow.last_synced_at,
            stale: true,
            retryAfterSeconds: 30,
          },
        };
      }
      return {
        status: "retryable_error",
        events: [],
        metadata: { refreshedAt: null, stale: false, retryAfterSeconds: 30 },
      };
    }
  }

  // 6. Pre-commit state check: ensure entitlement/connection/generation haven't changed
  const postEntitlement = await deps.hasProGroupFeatures(userId);
  const postConn = await deps.getConnection(userId);

  if (
    !postEntitlement ||
    !postConn ||
    postConn.status !== "connected" ||
    !postConn.opted_in ||
    postConn.connection_generation !== generation
  ) {
    return {
      status: "reconnect_required",
      events: [],
      metadata: { refreshedAt: null, stale: false },
    };
  }

  // 7. Atomic Compare-And-Swap database write
  if (isFullSync) {
    await deps.replaceWindowRpc(
      userId,
      generation,
      rangeStart,
      rangeEndExclusive,
      fetchResult.nextSyncToken,
      fetchResult.events
    );
  } else {
    await deps.applyDeltaRpc(
      userId,
      generation,
      rangeStart,
      rangeEndExclusive,
      fetchResult.nextSyncToken,
      fetchResult.events,
      fetchResult.deletedEventIds
    );
  }

  // 8. Re-read updated events for response
  const updatedWindow = await deps.readWindowRpc(userId, generation, rangeStart, rangeEndExclusive);
  const events = (updatedWindow.found ? updatedWindow.events : fetchResult.events).map(
    mapToMinimalBrowserEvent
  );

  const refreshedAt = updatedWindow.last_synced_at || new Date().toISOString();

  return {
    status: "ready",
    events,
    metadata: {
      refreshedAt,
      stale: false,
    },
  };
}
