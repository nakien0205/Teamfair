import { describe, expect, it, vi } from "vitest";
import { encryptToken, parseKeyRing } from "../../supabase/functions/_shared/google-calendar/crypto";
import { withGoogleCalendarProviderRequest } from "../../supabase/functions/_shared/google-calendar/credentials";

const ownerId = "123e4567-e89b-12d3-a456-426614174000";
const generation = 7;
const keyRing = parseKeyRing('{"1":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="}');

async function leaseEnvelope() {
  const encrypted = await encryptToken(
    "test-refresh-token",
    keyRing,
    1,
    `google-calendar:refresh-token:${ownerId}:${generation}`
  );
  return {
    lease_acquired: true,
    denial_code: null,
    authorized_generation: generation,
    expires_at: "2026-07-23T00:00:30.000Z",
    encrypted_refresh_token: encrypted.ciphertext,
    credential_nonce: encrypted.nonce,
    credential_key_version: encrypted.keyVersion,
    credential_generation: generation,
  };
}

describe("Google Calendar runtime credential custody", () => {
  it("fails closed without a production key ring and permits fallback only by explicit injection", () => {
    expect(() => parseKeyRing()).toThrow("Google Calendar token key ring is required");
    expect(parseKeyRing(undefined, true)[1]).toBe("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  });

  it("uses separate refresh and provider leases and releases both on success", async () => {
    const envelope = await leaseEnvelope();
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [envelope], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: [envelope], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    const request = vi.fn().mockResolvedValue("provider-result");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "memory-only-access-token" }),
    });

    const result = await withGoogleCalendarProviderRequest(
      { rpc } as never,
      ownerId,
      generation,
      "personal_event_read",
      keyRing,
      { clientId: "test-client", clientSecret: "test-secret" },
      request,
      fetchMock as unknown as typeof fetch
    );

    expect(result).toBe("provider-result");
    expect(request).toHaveBeenCalledWith("memory-only-access-token");
    expect(rpc).toHaveBeenCalledTimes(4);
  });

  it("maps refresh timeout to a sanitized error and releases the refresh lease", async () => {
    const envelope = await leaseEnvelope();
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [envelope], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    const fetchMock = vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));

    await expect(withGoogleCalendarProviderRequest(
      { rpc } as never,
      ownerId,
      generation,
      "personal_event_read",
      keyRing,
      { clientId: "test-client", clientSecret: "test-secret", refreshTimeoutMs: 1 },
      vi.fn(),
      fetchMock as unknown as typeof fetch
    )).rejects.toThrow("credential_refresh_failed");

    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
