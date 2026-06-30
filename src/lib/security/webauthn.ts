/**
 * WebAuthn / passkeys. The security-critical authentication (assertion)
 * verification is implemented here with Web Crypto for ES256 (P-256) — the
 * dominant passkey algorithm — covering the clientData/authenticatorData checks
 * and ECDSA signature verification (DER→P1363). Ceremony option builders are
 * pure.
 *
 * NOTE: registration *attestation* parsing (CBOR/COSE) is intentionally left to
 * the standard `@simplewebauthn/server` library at the integration layer rather
 * than hand-rolled here — that is the one piece where a battle-tested dependency
 * is the right call. The credential's public key + id are stored once extracted.
 */

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A fresh base64url challenge (32 random bytes). */
export function generateChallenge(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return b64urlEncode(buf);
}

export interface RegistrationOptionsInput {
  rpId: string;
  rpName: string;
  userId: string;
  userName: string;
  userDisplayName?: string;
  excludeCredentialIds?: string[];
}

/** Build PublicKeyCredentialCreationOptions for the browser (registration). */
export function buildRegistrationOptions(input: RegistrationOptionsInput) {
  return {
    challenge: generateChallenge(),
    rp: { id: input.rpId, name: input.rpName },
    user: {
      id: b64urlEncode(new TextEncoder().encode(input.userId)),
      name: input.userName,
      displayName: input.userDisplayName ?? input.userName,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    timeout: 60_000,
    attestation: "none",
    excludeCredentials: (input.excludeCredentialIds ?? []).map((id) => ({ type: "public-key", id })),
  };
}

export interface AuthenticationOptionsInput {
  rpId: string;
  allowCredentialIds?: string[];
}

/** Build PublicKeyCredentialRequestOptions for the browser (authentication). */
export function buildAuthenticationOptions(input: AuthenticationOptionsInput) {
  return {
    challenge: generateChallenge(),
    rpId: input.rpId,
    userVerification: "preferred",
    timeout: 60_000,
    allowCredentials: (input.allowCredentialIds ?? []).map((id) => ({ type: "public-key", id })),
  };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Convert a DER-encoded ECDSA signature to the 64-byte P1363 form Web Crypto wants. */
export function derToRawSignature(der: Uint8Array): Uint8Array {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("Invalid DER: no sequence");
  let seqLen = der[offset++];
  if (seqLen & 0x80) {
    const n = seqLen & 0x7f;
    seqLen = 0;
    for (let i = 0; i < n; i++) seqLen = (seqLen << 8) | der[offset++];
  }
  const readInt = (): Uint8Array => {
    if (der[offset++] !== 0x02) throw new Error("Invalid DER: no integer");
    const len = der[offset++];
    const val = der.slice(offset, offset + len);
    offset += len;
    return val;
  };
  const pad32 = (b: Uint8Array): Uint8Array => {
    let x = b;
    while (x.length > 32 && x[0] === 0) x = x.slice(1);
    const out = new Uint8Array(32);
    out.set(x, 32 - x.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(pad32(r), 0);
  raw.set(pad32(s), 32);
  return raw;
}

export interface AssertionInput {
  publicKey: string; // base64url raw EC point (65 bytes, uncompressed P-256)
  authenticatorData: string; // base64url
  clientDataJSON: string; // base64url
  signature: string; // base64url DER ECDSA signature
  expectedChallenge: string; // base64url
  expectedOrigin: string;
  expectedRpId: string;
}

export interface AssertionResult {
  ok: boolean;
  counter?: number;
  reason?: string;
}

/**
 * Verify a WebAuthn authentication assertion (ES256). Checks the client data
 * (type, challenge, origin), the rpId hash + user-presence flag, and the ECDSA
 * signature over `authenticatorData || SHA-256(clientDataJSON)`.
 */
export async function verifyAssertion(input: AssertionInput): Promise<AssertionResult> {
  let clientData: { type?: string; challenge?: string; origin?: string };
  try {
    clientData = JSON.parse(new TextDecoder().decode(b64urlDecode(input.clientDataJSON)));
  } catch {
    return { ok: false, reason: "Malformed clientDataJSON" };
  }
  if (clientData.type !== "webauthn.get") return { ok: false, reason: "Unexpected ceremony type" };
  if (clientData.challenge !== input.expectedChallenge) return { ok: false, reason: "Challenge mismatch" };
  if (clientData.origin !== input.expectedOrigin) return { ok: false, reason: "Origin mismatch" };

  const authData = b64urlDecode(input.authenticatorData);
  if (authData.length < 37) return { ok: false, reason: "Authenticator data too short" };

  const rpIdHash = authData.slice(0, 32);
  const expectedRpHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.expectedRpId)));
  if (!bytesEqual(rpIdHash, expectedRpHash)) return { ok: false, reason: "rpId mismatch" };

  const flags = authData[32];
  if ((flags & 0x01) === 0) return { ok: false, reason: "User not present" };

  const clientDataBytes = b64urlDecode(input.clientDataJSON);
  const clientHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataBytes as unknown as BufferSource));
  const signedData = new Uint8Array(authData.length + clientHash.length);
  signedData.set(authData, 0);
  signedData.set(clientHash, authData.length);

  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      b64urlDecode(input.publicKey) as unknown as BufferSource,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      derToRawSignature(b64urlDecode(input.signature)) as unknown as BufferSource,
      signedData as unknown as BufferSource
    );
  } catch {
    return { ok: false, reason: "Signature verification failed" };
  }
  if (!valid) return { ok: false, reason: "Invalid signature" };

  const counter = ((authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36]) >>> 0;
  return { ok: true, counter };
}
