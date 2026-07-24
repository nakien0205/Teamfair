/**
 * Google Calendar Overlay Component
 * Path: src/components/GoogleCalendarOverlay.tsx
 */

import React from "react";
import { GoogleOverlayEvent, GoogleOverlayStatus } from "../lib/googleCalendarOverlay";

export interface GoogleCalendarOverlayProps {
  status: GoogleOverlayStatus;
  events: GoogleOverlayEvent[];
  refreshedAt: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const GoogleCalendarOverlay: React.FC<GoogleCalendarOverlayProps> = ({
  status,
  events,
  refreshedAt,
  isLoading,
  onRefresh,
}) => {
  const formattedTime = refreshedAt
    ? new Date(refreshedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section
      className="mt-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4"
      aria-labelledby="google-overlay-heading"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 id="google-overlay-heading" className="text-sm font-semibold text-slate-200">
            Google Calendar Overlay
          </h3>
          <span className="rounded bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-400 border border-sky-500/20">
            Read-only
          </span>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh Google Calendar"
          className="inline-flex items-center rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div
        className="mt-3"
        aria-busy={isLoading}
        role="status"
        aria-live="polite"
      >
        {status === "upgrade_required" && (
          <div role="alert" className="rounded bg-amber-500/10 p-3 text-xs text-amber-300 border border-amber-500/20">
            Pro Group feature subscription required to view Google Calendar overlay.
          </div>
        )}

        {status === "reconnect_required" && (
          <div role="alert" className="rounded bg-rose-500/10 p-3 text-xs text-rose-300 border border-rose-500/20">
            Google Calendar connection or authorization required. Please reconnect in Settings.
          </div>
        )}

        {status === "retryable_error" && (
          <div role="alert" className="flex items-center justify-between rounded bg-red-500/10 p-3 text-xs text-red-300 border border-red-500/20">
            <span>Unable to refresh Google events. Local calendar remains active.</span>
            <button
              type="button"
              onClick={onRefresh}
              className="ml-2 underline hover:text-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {status === "stale" && (
          <div className="mb-2 flex items-center justify-between rounded bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-300 border border-yellow-500/20">
            <span>
              Showing cached events from {formattedTime || "earlier"}. Provider update pending.
            </span>
            <button type="button" onClick={onRefresh} className="underline hover:text-yellow-100">
              Refresh now
            </button>
          </div>
        )}

        {status === "ready" && events.length === 0 && !isLoading && (
          <p className="text-xs text-slate-400 italic">No Google events in this visible date range.</p>
        )}

        {events.length > 0 && (
          <ul className="mt-2 space-y-1.5" aria-label="Google Calendar Events">
            {events.map((evt) => (
              <li
                key={evt.providerEventId}
                className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-slate-100">{evt.title}</span>
                  <span className="text-[10px] text-slate-400">
                    Google Calendar · Read-only
                  </span>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  {evt.allDay ? (
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">All-day</span>
                  ) : (
                    <span>
                      {evt.start.dateTime
                        ? new Date(evt.start.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "Scheduled"}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
