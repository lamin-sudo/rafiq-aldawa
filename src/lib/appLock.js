// App lock (PIN) — client-side only.
// The PIN itself is never stored: we store a salted, iterated SHA-256 hash on the
// user profile. NOTE: a 4-6 digit PIN is inherently brute-forceable; the iteration
// count only slows an attacker down. See docs for the full limitation.

const ATTEMPTS_KEY = "app_lock_fail_count";
const LOCK_UNTIL_KEY = "app_lock_until";
const SESSION_KEY = "app_lock_session_unlocked";
const ITERATIONS = 2000;

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// FNV-1a — only used when WebCrypto is unavailable (insecure context). Weaker.
function fallbackHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

export function isStrongCryptoAvailable() {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

async function sha256Hex(text) {
  if (isStrongCryptoAvailable()) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return toHex(digest);
  }
  return fallbackHash(text);
}

export function generateSalt() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return toHex(arr);
  }
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

export function isValidPin(pin) {
  return /^[0-9]{4,6}$/.test(String(pin || ""));
}

export async function hashPin(pin, salt) {
  let out = await sha256Hex(`${salt}:${pin}`);
  for (let i = 1; i < ITERATIONS; i++) {
    out = await sha256Hex(`${out}${salt}`);
  }
  return out;
}

export async function verifyPin(pin, salt, expectedHash) {
  if (!expectedHash) return false;
  const hash = await hashPin(pin, salt || "");
  return hash === expectedHash;
}

export function getFailures() {
  return parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0", 10) || 0;
}

function setFailures(n) {
  localStorage.setItem(ATTEMPTS_KEY, String(n));
}

export function lockRemainingMs() {
  const until = parseInt(localStorage.getItem(LOCK_UNTIL_KEY) || "0", 10) || 0;
  return Math.max(0, until - Date.now());
}

export function registerFailure() {
  const failures = getFailures() + 1;
  setFailures(failures);
  let waitMs = 0;
  if (failures >= 5) waitMs = 5 * 60 * 1000;
  else if (failures >= 3) waitMs = 30 * 1000;
  if (waitMs > 0) localStorage.setItem(LOCK_UNTIL_KEY, String(Date.now() + waitMs));
  return { failures, waitMs };
}

export function resetFailures() {
  setFailures(0);
  localStorage.removeItem(LOCK_UNTIL_KEY);
}

export function isSessionUnlocked() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSessionUnlocked() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* sessionStorage unavailable — lock will simply re-ask */
  }
}

export function clearSessionUnlocked() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}