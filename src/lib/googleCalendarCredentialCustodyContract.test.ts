import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Google Calendar credential-custody repair", () => {
  const migration = readSource("supabase/migrations/20260722800000_google_calendar_operation_lease_envelope.sql");
  const credentials = readSource("supabase/functions/_shared/google-calendar/credentials.ts");
  const worker = readSource("supabase/functions/google-calendar-task-sync-worker/index.ts");
  const overlay = readSource("supabase/functions/google-calendar-overlay/index.ts");
  const overlayProvider = readSource("supabase/functions/google-calendar-overlay/provider.ts");

  it("returns an encrypted credential envelope only from the service-role lease RPC", () => {
    expect(migration).toContain("encrypted_refresh_token text");
    expect(migration).toContain("credential_nonce text");
    expect(migration).toContain("credential_key_version integer");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.acquire_google_calendar_operation_lease");
    expect(migration).toContain("TO service_role");
    expect(migration).not.toContain("plaintext_refresh_token");
    expect(migration).not.toContain("access_token");
  });

  it("binds refresh-token decryption to owner and credential generation and keeps it callback-local", () => {
    expect(credentials).toContain("google-calendar:refresh-token:${ownerId}:${envelope.credentialGeneration}");
    expect(credentials).toContain("withGoogleCalendarProviderRequest");
    expect(credentials).toContain("await releaseOperationLease");
    expect(credentials).not.toMatch(/console\.(log|error).*token/i);
  });

  it("removes invalid direct credential access and normalizes worker OAuth variables", () => {
    expect(overlay).not.toContain("get_decrypted_google_calendar_credential");
    expect(worker).not.toContain("GOOGLE_CLIENT_ID");
    expect(worker).not.toContain("GOOGLE_CLIENT_SECRET");
    expect(worker).toContain("GOOGLE_OAUTH_CLIENT_ID");
    expect(worker).toContain("GOOGLE_OAUTH_CLIENT_SECRET");
    expect(worker).toContain("withGoogleCalendarProviderRequest");
  });

  it("checks source wiring only; runtime tests prove pagination and release behavior", () => {
    expect(overlayProvider).toContain("providerRequest?: <T>");
    expect(overlayProvider).toContain("response = await requestWithLease");
    expect(overlay).toContain("withGoogleCalendarProviderRequest");
  });
});
