/**
 * Worker PIN ↔ Supabase Auth password.
 *
 * Workers log in with a short numeric PIN (e.g. "1111"), but Supabase Auth rejects any
 * password under 6 characters with `weak_password` — which is what made "add worker"
 * fail with a 500. Rather than force longer PINs on workers, an all-digit password of
 * 4–6 digits is stored in Auth with a fixed prefix. The PIN is still the only secret;
 * the prefix only satisfies the length rule.
 *
 * EVERY path that sets or checks a password must go through this: account creation,
 * PIN reset, login, and scripts/seed-users.ts. Non-PIN passwords pass through unchanged,
 * so manager passwords like "manager1234" are unaffected.
 *
 * Safe to import from client components (no secrets, no server deps).
 */
const PIN_PATTERN = /^\d{4,6}$/;
const PREFIX = "pin-";

export function isPin(password: string): boolean {
  return PIN_PATTERN.test(password);
}

export function toAuthPassword(password: string): string {
  return isPin(password) ? `${PREFIX}${password}` : password;
}
