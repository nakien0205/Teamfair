/**
 * Service-role credential management, operation lease coordination, and disconnect helpers
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { encryptToken, decryptToken, EncryptionKeyRing, sha256Hex } from './crypto.js';

export interface ConnectionView {
  status: 'not_connected' | 'consent_pending' | 'connected' | 'attention_needed' | 'disconnecting' | 'disconnected';
  optedIn: boolean;
  grantedScopes: string[];
  connectionGeneration: number;
  attentionCode: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
}

export interface AcquireLeaseResult {
  leaseAcquired: boolean;
  denialCode: string | null;
  authorizedGeneration: number;
  expiresAt: string | null;
}

/**
 * Stores newly acquired refresh token using AES-256-GCM encryption in private schema via RPC
 */
export async function storeEncryptedCredential(
  supabase: SupabaseClient,
  ownerId: string,
  expectedGen: number,
  refreshToken: string,
  googleSubject: string,
  grantedScopes: string[],
  keyRing: EncryptionKeyRing,
  activeKeyVersion: number
): Promise<number> {
  const nextGen = expectedGen + 1;
  const aad = `google-calendar:refresh-token:${ownerId}:${nextGen}`;

  const encrypted = await encryptToken(refreshToken, keyRing, activeKeyVersion, aad);
  const subjectHash = googleSubject ? await sha256Hex(googleSubject) : null;

  const { data, error } = await supabase.rpc('store_google_calendar_credential', {
    p_owner_id: ownerId,
    p_expected_generation: expectedGen,
    p_credential_generation: nextGen,
    p_encrypted_refresh_token: encrypted.ciphertext,
    p_credential_nonce: encrypted.nonce,
    p_key_version: encrypted.keyVersion,
    p_google_subject_hash: subjectHash,
    p_granted_scopes: grantedScopes,
    p_connected_at: new Date().toISOString()
  });

  if (error) {
    throw new Error(`Failed to store credential: ${error.message}`);
  }

  return data as number;
}

/**
 * Acquires short-lived operation lease (20s - 30s) before executing a Google provider call
 */
export async function acquireOperationLease(
  supabase: SupabaseClient,
  ownerId: string,
  expectedGen: number,
  operationId: string,
  purpose: 'task_event_write' | 'personal_event_read' | 'credential_validation',
  requestedTtlSeconds: number = 30
): Promise<AcquireLeaseResult> {
  const { data, error } = await supabase.rpc('acquire_google_calendar_operation_lease', {
    p_owner_id: ownerId,
    p_expected_generation: expectedGen,
    p_operation_id: operationId,
    p_purpose: purpose,
    p_requested_ttl_seconds: requestedTtlSeconds
  });

  if (error || !data || data.length === 0) {
    return {
      leaseAcquired: false,
      denialCode: error ? error.message : 'acquire_rpc_failed',
      authorizedGeneration: 0,
      expiresAt: null
    };
  }

  const row = data[0];
  return {
    leaseAcquired: row.lease_acquired,
    denialCode: row.denial_code,
    authorizedGeneration: Number(row.authorized_generation),
    expiresAt: row.expires_at
  };
}

/**
 * Releases operation lease idempotently
 */
export async function releaseOperationLease(
  supabase: SupabaseClient,
  ownerId: string,
  operationId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('release_google_calendar_operation_lease', {
    p_owner_id: ownerId,
    p_operation_id: operationId
  });

  return !error && Boolean(data);
}

/**
 * Initiates disconnect fencing by incrementing generation and removing state
 */
export async function beginDisconnect(
  supabase: SupabaseClient,
  ownerId: string
): Promise<{ fencedGeneration: number; activeLeasesCount: number }> {
  const { data, error } = await supabase.rpc('begin_google_calendar_disconnect', {
    p_owner_id: ownerId
  });

  if (error || !data || data.length === 0) {
    throw new Error(`begin_disconnect failed: ${error?.message || 'Unknown error'}`);
  }

  const row = data[0];
  return {
    fencedGeneration: Number(row.fenced_generation),
    activeLeasesCount: Number(row.active_leases_count)
  };
}

/**
 * Finalizes disconnect after active leases drain
 */
export async function finalizeDisconnect(
  supabase: SupabaseClient,
  ownerId: string,
  fencedGen: number
): Promise<{ status: string; activeLeasesCount: number }> {
  const { data, error } = await supabase.rpc('finalize_google_calendar_disconnect', {
    p_owner_id: ownerId,
    p_fenced_generation: fencedGen
  });

  if (error || !data || data.length === 0) {
    throw new Error(`finalize_disconnect failed: ${error?.message || 'Unknown error'}`);
  }

  const row = data[0];
  return {
    status: row.status,
    activeLeasesCount: Number(row.active_leases_count)
  };
}
