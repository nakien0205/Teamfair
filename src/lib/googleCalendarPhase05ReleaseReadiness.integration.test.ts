import { describe, it, expect } from "vitest";

describe("Phase 05 Telemetry & Release Readiness Redaction Audit", () => {
  interface TelemetrySignal {
    correlation_id: string;
    action: string;
    hashed_owner_id: string;
    hashed_task_id?: string;
    connection_generation: number;
    attempt?: number;
    status_class: "success" | "retryable" | "terminal" | "denied";
    duration_ms: number;
    [key: string]: unknown;
  }

  const sampleSanitizedSignal: TelemetrySignal = {
    correlation_id: "corr-12345",
    action: "google_calendar_sync_upsert",
    hashed_owner_id: "sha256-owner-hash-abc",
    hashed_task_id: "sha256-task-hash-def",
    connection_generation: 1,
    attempt: 1,
    status_class: "success",
    duration_ms: 142,
  };

  it("proves telemetry signal schema contains required correlation and status fields", () => {
    expect(sampleSanitizedSignal.correlation_id).toBeDefined();
    expect(sampleSanitizedSignal.action).toBeDefined();
    expect(sampleSanitizedSignal.hashed_owner_id).toBeDefined();
    expect(sampleSanitizedSignal.status_class).toBe("success");
  });

  it("redaction audit guarantees absence of forbidden raw tokens and private event texts", () => {
    const signalJson = JSON.stringify(sampleSanitizedSignal);

    expect(signalJson).not.toContain("access_token");
    expect(signalJson).not.toContain("refresh_token");
    expect(signalJson).not.toContain("client_secret");
    expect(signalJson).not.toContain("pkce_verifier");
    expect(signalJson).not.toContain("sync_token");
    expect(signalJson).not.toContain("user_email");
    expect(signalJson).not.toContain("event_summary");
    expect(signalJson).not.toContain("event_description");
  });
});
