/**
 * Stateless signed log token.
 *
 * The server creates a token when the worker opens a task form (start-log). The worker
 * includes it in the submit payload. The server verifies the signature to confirm that
 * photo_required, the form-open time and the QR-scan time were decided server-side and
 * not tampered with.
 *
 * Token format: base64url(payload) + "." + base64url(HMAC-SHA256)
 *
 * The HMAC key is LOG_TOKEN_SECRET. It used to be the first 32 characters of the
 * service-role key — but that key is a JWT, and the first 32 characters of every
 * Supabase JWT are the same public header (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX`), so
 * anyone could forge a token (skip the photo, backdate the form-open time).
 */
import { createHmac, timingSafeEqual } from "crypto";
import type { PhotoRequirementReason } from "@/types/database";

export interface LogTokenPayload {
  workerId: string;
  treeId: string;
  taskDefId: string;
  photoRequired: boolean;
  photoRequirementReason: PhotoRequirementReason;
  auditSeed: string;
  formOpenedAt: string; // ISO timestamp (server-side)
  /**
   * When the client says the QR was scanned, fixed at form-open time. Bound into the
   * token so a client can't backdate it at submit to dodge `qr_to_submit_too_fast`.
   */
  qrScannedAt: string;
  /**
   * Random id for this opened form. submit_task_log stores it and returns the original
   * log if the same id arrives again, so a retry after a lost response can't duplicate.
   */
  submissionId: string;
  expiresAt: string;    // ISO timestamp
}

export type VerifyResult =
  | { ok: true; payload: LogTokenPayload }
  | { ok: false; reason: "invalid" | "expired" };

function secret(): string {
  const s = process.env.LOG_TOKEN_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "LOG_TOKEN_SECRET is missing or shorter than 32 characters. " +
      "Generate one with: openssl rand -base64 48",
    );
  }
  return s;
}

function sign(data: string): Buffer {
  return createHmac("sha256", secret()).update(data).digest();
}

export function signToken(payload: LogTokenPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data).toString("base64url")}`;
}

/**
 * `allowExpired` accepts a correctly-signed but expired token — used only by start-log to
 * renew a token while keeping its original timings (see app/api/start-log).
 */
export function verifyToken(token: string, opts: { allowExpired?: boolean } = {}): VerifyResult {
  const [data, sig] = token.split(".");
  if (!data || !sig) return { ok: false, reason: "invalid" };

  const expected = sign(data);
  const given = Buffer.from(sig, "base64url");
  // Constant-time compare: a plain === leaks how many leading bytes matched.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "invalid" };
  }

  let payload: LogTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!opts.allowExpired && new Date(payload.expiresAt) < new Date()) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}
