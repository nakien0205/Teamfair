/**
 * Web Crypto AES-256-GCM Encryption and Redaction Module
 * Operates in standard Web Crypto API environments (Edge / Deno / Node 19+ / Web Browser)
 */

export interface EncryptionKeyRing {
  [version: number]: string; // Base64 encoded 32-byte key
}

export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded
  nonce: string;      // Base64 encoded 96-bit random nonce
  keyVersion: number;
}

/**
 * Returns a 64-character lowercase hex SHA-256 digest of input text
 */
export async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parses and validates key ring JSON from environment
 */
export function parseKeyRing(jsonString?: string, allowTestFallback = false): EncryptionKeyRing {
  if (!jsonString) {
    if (allowTestFallback) {
      return { 1: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' };
    }
    throw new Error('Google Calendar token key ring is required');
  }
  try {
    const ring = JSON.parse(jsonString);
    if (typeof ring !== 'object' || ring === null) {
      throw new Error('Keyring must be an object');
    }
    return ring;
  } catch (err) {
    throw new Error('Invalid key ring JSON');
  }
}

/**
 * Encrypts plaintext using AES-256-GCM with specified versioned key and AAD
 */
export async function encryptToken(
  plaintext: string,
  keyRing: EncryptionKeyRing,
  activeVersion: number,
  aadString: string
): Promise<EncryptedPayload> {
  const base64Key = keyRing[activeVersion];
  if (!base64Key) {
    throw new Error(`Active key version ${activeVersion} not found in key ring`);
  }

  const rawKey = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  if (rawKey.byteLength !== 32) {
    throw new Error(`Key version ${activeVersion} must be exactly 32 bytes (256-bit)`);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate unique 96-bit (12-byte) nonce
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(plaintext);
  const aadBuffer = encoder.encode(aadString);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: aadBuffer,
      tagLength: 128
    },
    cryptoKey,
    plaintextBuffer
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer))),
    nonce: btoa(String.fromCharCode(...nonce)),
    keyVersion: activeVersion
  };
}

/**
 * Decrypts AES-256-GCM payload with versioned key and AAD
 */
export async function decryptToken(
  payload: EncryptedPayload,
  keyRing: EncryptionKeyRing,
  aadString: string
): Promise<string> {
  const base64Key = keyRing[payload.keyVersion];
  if (!base64Key) {
    throw new Error(`Key version ${payload.keyVersion} not found in key ring`);
  }

  const rawKey = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const nonce = Uint8Array.from(atob(payload.nonce), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));

  const encoder = new TextEncoder();
  const aadBuffer = encoder.encode(aadString);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: aadBuffer,
        tagLength: 128
      },
      cryptoKey,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    throw new Error('Authenticated decryption failed: payload tampered or invalid AAD');
  }
}

/**
 * Redacts secret patterns from string for safe logging
 */
export function sanitizeLogMessage(message: string): string {
  if (!message) return '';
  return message
    .replace(/(access_token|refresh_token|code|verifier|secret)=[^&\s]+/gi, '$1=[REDACTED]')
    .replace(/bearer\s+[a-z0-9._-]+/gi, 'Bearer [REDACTED]');
}
