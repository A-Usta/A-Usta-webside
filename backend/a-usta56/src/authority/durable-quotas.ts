import type { FastifyReply, FastifyRequest } from "fastify";
import { supabase } from "../config/supabase.js";
import { logDiagnostic } from "../diagnostics/foundation.js";

export type Upload = { reservation_id: string; generation: number; actor_id: string; state: string; assignment_id: string;
  bucket: "service-evidence"; path: string; content_type: string; stage: string; created_at: string;
  candidate_bytes: number | null; content_sha256: string | null; code?: string; enabled?: boolean; replay?: boolean; alert?: boolean };
export class AuthorityUnavailable extends Error {}
// No retries of non-idempotent admission: a lost DB response might have committed.
export async function authority<T>(name: string, args: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase.rpc(name, args);
    if (error || !data || typeof data !== "object") throw new AuthorityUnavailable();
    return data as T;
  } catch { throw new AuthorityUnavailable("Durable authority unavailable"); }
}
export function authorityFailure(request: FastifyRequest, reply: FastifyReply, error?: unknown) {
  logDiagnostic(request, "database_or_rpc", error);
  return reply.header("Cache-Control", "no-store").code(503).send({ error: "Service Unavailable", code: "authority_unavailable", message: "Upload authority temporarily unavailable", request_id: request.id });
}
export function decision(request: FastifyRequest, reply: FastifyReply, value: {code?: string; retry_after_seconds?: number}): boolean {
  if (!value.code || value.code === "admitted") return false;
  const status = value.code === "validation_invalid" ? 400 : value.code === "quota_exhausted" ? 429 : value.code === "authority_unavailable" || value.code === "legacy_debt" ? 503 : value.code === "size_invalid" ? 413 : value.code === "not_found" ? 404 : 409;
  const seconds = Number(value.retry_after_seconds);
  reply.header("Cache-Control", "no-store");
  if (Number.isFinite(seconds) && seconds > 0) reply.header("Retry-After", String(Math.ceil(seconds)));
  reply.code(status).send({ error: status === 429 ? "Too Many Requests" : "Operation unavailable", code: value.code,
    message: status === 429 ? "Managed operation limit reached" : "Operation cannot progress safely", request_id: request.id,
    ...(Number.isFinite(seconds) && seconds > 0 ? {retry_after_seconds: Math.ceil(seconds)} : {}) });
  return true;
}
export function uploadResponse(reply: FastifyReply, r: Upload, lookup = false) {
  // Never expose private paths, digests, accounting rows or worker generations.
  return reply.header("Cache-Control", "no-store").code(r.state === "finalized" ? (lookup ? 200 : 201) : ["released","expired"].includes(r.state) ? (lookup ? 200 : 409) : 202)
    .send({reservation_id:r.reservation_id,state:r.state,assignment_id:r.assignment_id,stage:r.stage});
}
