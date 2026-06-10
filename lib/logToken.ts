/**
 * Stateless signed log token.
 *
 * The server creates a token when the worker opens a task form (start-log).
 * The worker includes it in the submit payload. The server verifies the
 * signature to confirm photo_required was decided server-side and not tampered.
 *
 * Token format: base64(payload) + "." + base64(HMAC-SHA256)
 */
import { createHmac } from "crypto";

export interface LogTokenPayload {
  workerId: string;
  treeId: string;
  taskDefId: string;
  photoRequired: boolean;
  photoRequirementReason: string;
  auditSeed: string;
  formOpenedAt: string; // ISO timestamp (server-side)
  expiresAt: string;    // ISO timestamp
}

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return s.slice(0, 32); // 32-char slice as HMAC secret
}

export function signToken(payload: LogTokenPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): LogTokenPayload | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expected = createHmac("sha256", secret()).update(data).digest("base64url");
    if (sig !== expected) return null;
    const payload: LogTokenPayload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (new Date(payload.expiresAt) < new Date()) return null;
    return payload;
  } catch {
    return null;
  }
}
