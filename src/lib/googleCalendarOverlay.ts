/**
 * Browser Client Library for Google Calendar Overlay Integration
 * Path: src/lib/googleCalendarOverlay.ts
 */

export interface GoogleOverlayEvent {
  providerEventId: string;
  title: string;
  start: { date: string } | { dateTime: string };
  end: { date: string } | { dateTime: string };
  allDay: boolean;
  readOnly: true;
  source: "google";
}

export type GoogleOverlayStatus =
  | "ready"
  | "stale"
  | "upgrade_required"
  | "reconnect_required"
  | "retryable_error";

export interface GoogleOverlayResponse {
  status: GoogleOverlayStatus;
  events: GoogleOverlayEvent[];
  metadata: {
    refreshedAt: string | null;
    stale: boolean;
    retryAfterSeconds?: number;
  };
}

export interface FetchGoogleOverlayParams {
  rangeStart: string; // YYYY-MM-DD
  rangeEndExclusive: string; // YYYY-MM-DD
  reason?: "open" | "navigate" | "manual";
}

export interface MinimalSupabaseClient {
  functions: {
    invoke: (
      functionName: string,
      options: { body: Record<string, unknown> }
    ) => Promise<{ data: unknown; error: unknown }>;
  };
}

export async function fetchGoogleCalendarOverlay(
  supabaseClient: MinimalSupabaseClient,
  params: FetchGoogleOverlayParams
): Promise<GoogleOverlayResponse> {
  const { rangeStart, rangeEndExclusive, reason = "open" } = params;

  if (!supabaseClient || typeof supabaseClient.functions?.invoke !== "function") {
    throw new Error("Invalid Supabase client supplied to fetchGoogleCalendarOverlay");
  }

  const { data, error } = await supabaseClient.functions.invoke("google-calendar-overlay", {
    body: {
      rangeStart,
      rangeEndExclusive,
      reason,
    },
  });

  if (error || !data || typeof data !== "object") {
    return {
      status: "retryable_error",
      events: [],
      metadata: {
        refreshedAt: null,
        stale: false,
        retryAfterSeconds: 30,
      },
    };
  }

  const payload = data as Record<string, unknown>;

  if (typeof payload.status !== "string" || !Array.isArray(payload.events)) {
    return {
      status: "retryable_error",
      events: [],
      metadata: {
        refreshedAt: null,
        stale: false,
        retryAfterSeconds: 30,
      },
    };
  }

  const rawEvents = payload.events as Array<Record<string, unknown>>;
  const sanitizedEvents: GoogleOverlayEvent[] = rawEvents.map((evt) => ({
    providerEventId: String(evt.providerEventId || evt.provider_event_id || ""),
    title: String(evt.title || "Untitled event"),
    start: (evt.start as { date: string } | { dateTime: string }) || { date: "1970-01-01" },
    end: (evt.end as { date: string } | { dateTime: string }) || { date: "1970-01-01" },
    allDay: Boolean(evt.allDay || evt.all_day),
    readOnly: true,
    source: "google",
  }));

  const metadataObj = (payload.metadata || {}) as Record<string, unknown>;

  return {
    status: payload.status as GoogleOverlayStatus,
    events: sanitizedEvents,
    metadata: {
      refreshedAt: (metadataObj.refreshedAt as string | null) || null,
      stale: Boolean(metadataObj.stale),
      retryAfterSeconds: metadataObj.retryAfterSeconds as number | undefined,
    },
  };
}
