import type { FastifyReply, FastifyRequest } from "fastify";
import { admissionPolicy } from "../diagnostics/admission.js";

function jsonBytes(value: unknown): number {
  try { return Buffer.byteLength(JSON.stringify(value), "utf8"); } catch { return Infinity; }
}

function resourceBounds(b: Record<string, unknown>): string | null {
  for (const [key, limit] of Object.entries(admissionPolicy.text)) {
    if (typeof b[key] === "string" && Buffer.byteLength(b[key] as string, "utf8") > limit) return key + " is too long";
  }
  if (typeof b.form_version === "string" && b.form_version.length > 120) return "form_version is too long";
  if (Array.isArray(b.answers)) {
    const limits = admissionPolicy.answers;
    if (b.answers.length > limits.items || jsonBytes(b.answers) > limits.bytes || b.answers.some(a => jsonBytes(a) > limits.itemBytes)) return "answers exceeds the input limit";
  }
  if (Array.isArray(b.evidence_files)) {
    const limits = admissionPolicy.evidence;
    if (b.evidence_files.length > limits.items || jsonBytes(b.evidence_files) > limits.bytes) return "evidence_files exceeds the input limit";
    for (const item of b.evidence_files) {
      if (!item || typeof item !== "object" || Array.isArray(item) || jsonBytes(item) > limits.itemBytes) return "Invalid evidence metadata";
      const record = item as Record<string, unknown>;
      // Owner binding and initial-stage checks still run in the route. Metadata
      // bounds are not proof of object existence, content or Storage byte quota.
      if (typeof record.path !== "string" || Buffer.byteLength(record.path, "utf8") > limits.pathBytes ||
          !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/(?:problem|before|after)\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(record.path)) return "Invalid evidence path";
      for (const [key, limit] of Object.entries({ bucket: 64, category: 32, content_type: 128, name: 1024, type: 128 })) {
        if (record[key] !== undefined && (typeof record[key] !== "string" || Buffer.byteLength(record[key] as string, "utf8") > limit)) return "Invalid evidence metadata";
      }
    }
  }
  return null;
}

// Scoped to service-order routes; legacy numeric helpers elsewhere are unchanged.
export function serviceNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
const absent = (v: unknown) => v === undefined || v === null || v === "";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function serviceOrderInputError(route: string, method: string, body: unknown, params: Record<string, unknown>): string | null {
  for (const key of ["orderId", "assignmentId"]) if (params[key] !== undefined && (typeof params[key] !== "string" || !uuid.test(params[key] as string))) return key + " must be a UUID";
  if (method === "GET" || route.includes("/evidence/")) return null;
  if (body !== undefined && body !== null && (typeof body !== "object" || Array.isArray(body) || Object.getPrototypeOf(body) !== Object.prototype)) return "Body must be an object";
  const b = (body ?? {}) as Record<string, unknown>;
  const create = method === "POST" && route === "/service-orders";
  const assignment = method === "POST" && route.endsWith("/assignments");
  const complete = route.endsWith("/complete");
  const location = route === "/provider/location";
  const offer = route.endsWith("/price-offer");
  const numeric = create ? ["latitude","longitude","estimated_price_min","estimated_price_max"] : assignment ? ["distance_km"] : complete ? ["final_price"] : location ? ["latitude","longitude"] : offer ? ["proposed_price"] : [];
  for (const key of numeric) {
    const value = b[key], required = location || offer;
    if (absent(value)) { if (required) return key + " is required"; continue; }
    const n = serviceNumber(value);
    if (n === null) return key + " must be finite numeric input";
    if (key === "latitude" ? n < -90 || n > 90 : key === "longitude" ? n < -180 || n > 180 : n < 0) return key + " is outside its valid range";
  }
  if (create) {
    for (const key of ["service_description","address","region","district","customer_note","client_order_id","form_version"]) if (!absent(b[key]) && typeof b[key] !== "string") return key + " must be text";
    if (typeof b.client_order_id === "string" && b.client_order_id.trim().length > 120) return "client_order_id is too long";
    if (!absent(b.vehicle_id) && (typeof b.vehicle_id !== "string" || !uuid.test(b.vehicle_id))) return "vehicle_id must be a UUID";
    for (const key of ["answers","evidence_files"]) if (!absent(b[key]) && !Array.isArray(b[key])) return key + " must be an array";
    const bounds = resourceBounds(b);
    if (bounds) return bounds;
    const min=serviceNumber(b.estimated_price_min), max=serviceNumber(b.estimated_price_max);
    if (min !== null && max !== null && min > max) return "estimated_price_min exceeds estimated_price_max";
  }
  const enums: Record<string, readonly string[]> = create ? {
    service_category:["mechanic_service","tow_service","cargo_service"], urgency:["normal","urgent"],service_mode:["mobile","shop"],price_status:["unknown","estimated","confirmed","final"],
  } : assignment ? {provider_type:["mechanic","shop","tow","cargo"]} : complete ? {price_status:["unknown","estimated","confirmed","final"]} : {};
  for (const [key, values] of Object.entries(enums)) {
    if (absent(b[key]) && key !== "service_category" && key !== "provider_type") continue;
    if (typeof b[key] !== "string" || !values.includes(b[key] as string)) return "Invalid " + key;
  }
  if (assignment && (typeof b.provider_id !== "string" || !uuid.test(b.provider_id))) return "provider_id must be a UUID";
  return null;
}
export async function validateServiceOrderRequest(request: FastifyRequest, reply: FastifyReply) {
  const error = serviceOrderInputError(request.routeOptions.url ?? "", request.method, request.body, (request.params ?? {}) as Record<string, unknown>);
  if (error) return reply.code(400).send({error:"Bad Request",message:error});
}
