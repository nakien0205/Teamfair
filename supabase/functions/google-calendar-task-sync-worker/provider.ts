/**
 * Pure Google Calendar Events HTTP API Provider Adapter
 * Module: provider.ts
 */

import { GoogleCalendarEventPayload, MinimalGoogleEvent } from "../_shared/googleCalendarEventOwnership.ts";

export type ProviderOutcomeKind =
  | "success"
  | "conflict_409"
  | "not_found_404"
  | "gone_410"
  | "precondition_failed_412"
  | "unauthorized_401"
  | "forbidden_403"
  | "rate_limited_429"
  | "bad_request_400"
  | "server_error_5xx"
  | "timeout_network_failure";

export interface ProviderResult {
  outcome: ProviderOutcomeKind;
  statusCode?: number;
  event?: MinimalGoogleEvent & { etag?: string };
  etag?: string;
  isRateLimit?: boolean;
  errorCode?: string;
}

const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

export class GoogleCalendarProviderAdapter {
  private baseUrl: string;
  private timeoutMs: number;
  private fetchImpl: typeof fetch;

  constructor(
    options: {
      baseUrl?: string;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    } = {}
  ) {
    this.baseUrl = options.baseUrl ?? GOOGLE_CALENDAR_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  private async request(
    method: string,
    path: string,
    accessToken: string,
    body?: unknown,
    etag?: string
  ): Promise<ProviderResult> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    if (etag) {
      headers["If-Match"] = etag;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const status = response.status;

      if (status >= 200 && status < 300) {
        let responseData: (MinimalGoogleEvent & { etag?: string }) | undefined;
        if (status !== 204) {
          try {
            responseData = await response.json();
          } catch {
            // Empty body
          }
        }
        const responseEtag = response.headers.get("etag") || responseData?.etag;
        return {
          outcome: "success",
          statusCode: status,
          event: responseData,
          etag: responseEtag || undefined,
        };
      }

      if (status === 401) {
        return { outcome: "unauthorized_401", statusCode: 401, errorCode: "unauthorized" };
      }

      if (status === 403) {
        let isRateLimit = false;
        try {
          const errJson = await response.json();
          const reason = errJson?.error?.errors?.[0]?.reason;
          if (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded") {
            isRateLimit = true;
          }
        } catch {
          // ignore JSON parse error
        }
        return {
          outcome: "forbidden_403",
          statusCode: 403,
          isRateLimit,
          errorCode: isRateLimit ? "rate_limit_exceeded" : "forbidden",
        };
      }

      if (status === 404) {
        return { outcome: "not_found_404", statusCode: 404, errorCode: "not_found" };
      }

      if (status === 409) {
        return { outcome: "conflict_409", statusCode: 409, errorCode: "event_exists" };
      }

      if (status === 410) {
        return { outcome: "gone_410", statusCode: 410, errorCode: "event_gone" };
      }

      if (status === 412) {
        return { outcome: "precondition_failed_412", statusCode: 412, errorCode: "etag_mismatch" };
      }

      if (status === 429) {
        return { outcome: "rate_limited_429", statusCode: 429, isRateLimit: true, errorCode: "rate_limit_exceeded" };
      }

      if (status === 400) {
        return { outcome: "bad_request_400", statusCode: 400, errorCode: "invalid_payload" };
      }

      if (status >= 500) {
        return { outcome: "server_error_5xx", statusCode: status, errorCode: "provider_server_error" };
      }

      return { outcome: "server_error_5xx", statusCode: status, errorCode: `http_${status}` };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = (err as { name?: string })?.name === "AbortError";
      return {
        outcome: "timeout_network_failure",
        errorCode: isAbort ? "request_timeout" : "network_failure",
      };
    }
  }

  async insertEvent(accessToken: string, payload: GoogleCalendarEventPayload): Promise<ProviderResult> {
    return this.request("POST", "/calendars/primary/events", accessToken, payload);
  }

  async getEvent(accessToken: string, eventId: string): Promise<ProviderResult> {
    return this.request("GET", `/calendars/primary/events/${encodeURIComponent(eventId)}`, accessToken);
  }

  async patchEvent(
    accessToken: string,
    eventId: string,
    payload: Partial<GoogleCalendarEventPayload>,
    etag?: string
  ): Promise<ProviderResult> {
    return this.request("PATCH", `/calendars/primary/events/${encodeURIComponent(eventId)}`, accessToken, payload, etag);
  }

  async deleteEvent(accessToken: string, eventId: string): Promise<ProviderResult> {
    return this.request("DELETE", `/calendars/primary/events/${encodeURIComponent(eventId)}`, accessToken);
  }
}
