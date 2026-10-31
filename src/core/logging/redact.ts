/** Keys whose values never reach a log, a report or the clipboard (case-insensitive, "_"/"-" optional). */
export const SECRET_KEYS = ['password', 'passwd', 'token', 'access_token', 'refresh_token', 'secret', 'api_key', 'apikey', 'authorization', 'cookie', 'private_key', 'pin'];

const keyPattern = SECRET_KEYS.map((k) => k.replace(/_/g, '[_-]?')).join('|');

let pattern: RegExp | null;
try {
  // ("?)(key)("?\s*[:=]\s*)("?)(value) — covers JSON and key=value; "Bearer x" values keep the scheme.
  pattern = new RegExp(`("?)\\b(${keyPattern})("?\\s*[:=]\\s*)("?)((?:Bearer\\s+)?[^",}\\s]+)`, 'gi');
} catch {
  pattern = null; // never let redaction stop logging
}

export const REDACTED = '[REDACTED]';

/** Replaces the value of every known secret key with [REDACTED]. */
export function redactSensitive(text: string): string {
  if (!pattern) return text;
  try {
    return text.replace(pattern, (_m, q1: string, key: string, sep: string, q2: string) => `${q1}${key}${sep}${q2}${REDACTED}`);
  } catch {
    pattern = null; // a runtime regex failure disables redaction instead of crashing
    return text;
  }
}

/** True for a settings key that must not be printed. */
export const isSecretKey = (key: string): boolean => new RegExp(`^(${keyPattern})$`, 'i').test(key);
