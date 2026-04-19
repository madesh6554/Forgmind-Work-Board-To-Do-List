const PBKDF2_ITERATIONS = 250_000;
const VERIFIER_PLAINTEXT = "forgmind-vault-verifier-v1";

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export function randomBytes(len: number): Uint8Array {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return arr;
}

export function randomSaltB64(): string {
  return bytesToBase64(randomBytes(16));
}

export async function deriveKey(password: string, saltB64: string): Promise<CryptoKey> {
  const salt = base64ToBytes(saltB64);
  const pwBytes = new TextEncoder().encode(password);
  const passKey = await crypto.subtle.importKey(
    "raw",
    pwBytes as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJson(
  key: CryptoKey,
  value: unknown
): Promise<{ iv: string; ciphertext: string }> {
  const iv = randomBytes(12);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const buf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext as BufferSource
  );
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(buf)) };
}

export async function decryptJson<T>(
  key: CryptoKey,
  ivB64: string,
  ctB64: string
): Promise<T> {
  const iv = base64ToBytes(ivB64);
  const ct = base64ToBytes(ctB64);
  const buf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource
  );
  return JSON.parse(new TextDecoder().decode(buf)) as T;
}

export async function makeVerifier(
  key: CryptoKey
): Promise<{ verifier_iv: string; verifier_ciphertext: string }> {
  const enc = await encryptJson(key, VERIFIER_PLAINTEXT);
  return { verifier_iv: enc.iv, verifier_ciphertext: enc.ciphertext };
}

export async function verifyKey(
  key: CryptoKey,
  verifierIv: string,
  verifierCiphertext: string
): Promise<boolean> {
  try {
    const value = await decryptJson<string>(key, verifierIv, verifierCiphertext);
    return value === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}
