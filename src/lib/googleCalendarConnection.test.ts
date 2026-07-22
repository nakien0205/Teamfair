import { describe, expect, it, vi } from 'vitest';
import { sanitizeConnectionView, GoogleCalendarConnectionView } from './googleCalendarConnection';

describe('googleCalendarConnection sanitizer & browser client', () => {
  it('sanitizes null/undefined data safely', () => {
    const view = sanitizeConnectionView(null);
    expect(view.status).toBe('disconnected');
    expect(view.optedIn).toBe(false);
    expect(view.grantedScopes).toEqual([]);
    expect(view.connectionGeneration).toBe(0);
    expect(view.attentionCode).toBeNull();
  });

  it('filters out non-whitelisted secret or provider properties', () => {
    const rawData = {
      status: 'connected',
      optedIn: true,
      grantedScopes: ['openid', 'email'],
      connectionGeneration: 2,
      attentionCode: null,
      connectedAt: '2026-07-22T20:00:00Z',
      updatedAt: '2026-07-22T20:00:00Z',
      // Secret/Private fields that MUST be stripped:
      refreshToken: 'secret_token_123',
      accessToken: 'access_token_abc',
      googleSubjectHash: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
      clientSecret: 'secret_secret'
    };

    const sanitized = sanitizeConnectionView(rawData);

    expect(sanitized.status).toBe('connected');
    expect(sanitized.optedIn).toBe(true);
    expect(sanitized.grantedScopes).toEqual(['openid', 'email']);
    expect(sanitized.connectionGeneration).toBe(2);
    expect((sanitized as Record<string, unknown>).refreshToken).toBeUndefined();
    expect((sanitized as Record<string, unknown>).accessToken).toBeUndefined();
    expect((sanitized as Record<string, unknown>).googleSubjectHash).toBeUndefined();
    expect((sanitized as Record<string, unknown>).clientSecret).toBeUndefined();
  });

  it('handles invalid status strings by defaulting to disconnected', () => {
    const view = sanitizeConnectionView({ status: 'invalid_hacked_status' });
    expect(view.status).toBe('disconnected');
  });
});
