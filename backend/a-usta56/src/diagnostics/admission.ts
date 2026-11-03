import { performance } from "node:perf_hooks";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Best-effort, process-local load shedding. Restart resets state; instances do
// not share counters. This provides neither per-client fairness nor durable
// count/byte quotas. Direct browser -> Supabase traffic bypasses this layer.
type Policy = "create" | "discover" | "dispatch" | "assignment" | "location" | "pricing" | "lifecycle" | "read" | "upload" | "sign" | "auth";
type Window = readonly [limit: number, milliseconds: number];
const minute = 60_000;
export const admissionPolicy = {
  maxKeys: 4096,
  cleanupMs: minute,
  global: { create: 120, discover: 120, dispatch: 120, assignment: 300, location: 600, pricing: 300, lifecycle: 600, read: 600, upload: 120, sign: 600, auth: 300 },
  actor: {
    create: [[5, 10 * minute], [30, 1440 * minute]],
    discover: [[10, minute]], dispatch: [[10, minute]], assignment: [[30, minute]],
    location: [[30, minute]], pricing: [[20, minute]], lifecycle: [[30, minute]],
    read: [[30, minute]], upload: [[12, minute]], sign: [[60, minute]], auth: [[60, minute]],
  } as Record<Policy, readonly Window[]>,
  resource: { discover: 3, dispatch: 3, assignment: 10, pricing: 6, lifecycle: 10, location: 30, upload: 12 },
  slots: { auth: 8, "auth-lifecycle": 4, discover: 2, dispatch: 2, upload: 2, "upload-actor": 1, sign: 8 },
  text: { service_description: 65536, customer_note: 65536, address: 2048, region: 256, district: 256 },
  jsonBytes: 1048576, // Explicit route transport ceiling; same as the existing Fastify default.
  answers: { items: 64, itemBytes: 8192, bytes: 65536 },
  evidence: { items: 3, pathBytes: 1024, itemBytes: 4096, bytes: 12288 },
  multipart: { files: 1, fields: 0, parts: 1, headerPairs: 32, fileSize: 10 * 1024 * 1024 },
} as const;

type Counter = { count: number; expires: number };
export class Admission {
  private counters = new Map<string, Counter>();
  private active = new Map<string, number>();
  private nextCleanup = 0;
  constructor(readonly clock: () => number = () => performance.now(), readonly maxKeys: number = admissionPolicy.maxKeys) {}
  cleanup() {
    const now = this.clock();
    for (const [key, value] of this.counters) if (value.expires <= now) this.counters.delete(key);
    this.nextCleanup = now + admissionPolicy.cleanupMs;
  }
  // Check every window before charging any window. No await between check/write.
  spend(scope: string, identity: string, windows: readonly Window[]): number {
    const now = this.clock();
    if (now >= this.nextCleanup || this.counters.size >= this.maxKeys) this.cleanup();
    const entries = windows.map(([limit, ms], index) => {
      const key = JSON.stringify([scope, identity, index]);
      const stored = this.counters.get(key);
      const value = stored && stored.expires > now ? stored : undefined;
      return { key, value, limit, ms };
    });
    const missing = entries.filter(e => !this.counters.has(e.key)).length;
    if (this.counters.size + missing > this.maxKeys) return 1;
    const wait = Math.max(0, ...entries.filter(e => e.value && e.value.count >= e.limit).map(e => e.value!.expires - now));
    if (wait > 0) return Math.max(1, Math.ceil(wait / 1000));
    for (const e of entries) this.counters.set(e.key, { count: (e.value?.count ?? 0) + 1, expires: e.value?.expires ?? now + e.ms });
    return 0;
  }
  slot(scope: string, identity: string, limit: number): (() => void) | undefined {
    const key = JSON.stringify([scope, identity]);
    const count = this.active.get(key) ?? 0;
    if (count >= limit || (!count && this.active.size >= this.maxKeys)) return;
    this.active.set(key, count + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const remaining = (this.active.get(key) ?? 1) - 1;
      if (remaining) this.active.set(key, remaining); else this.active.delete(key);
    };
  }
  get sizes() { return { counters: this.counters.size, active: this.active.size }; }
}

declare module "fastify" { interface FastifyInstance { localAdmission: Admission } }
function policy(method: string, route: string): Policy | undefined {
  if (route === "/health") return;
  if (route === "/service-order-uploads/:reservationId" || route === "/service-order-upload-operations/:key") return "read";
  if (route === "/listing-media/signed-url") return "sign";
  if (route === "/auth/me") return "auth";
  if (route === "/provider/location") return "location";
  if (!/^\/service-order(?:s|s?[-]assignments)(?:\/|$)/.test(route)) return;
  if (method === "GET" || method === "HEAD") return "read";
  if (route === "/service-orders") return "create";
  if (route.endsWith("/discover-providers")) return "discover";
  if (route.endsWith("/dispatch")) return "dispatch";
  if (route.endsWith("/assignments")) return "assignment";
  if (route.includes("/evidence/")) return "upload";
  if (route.includes("/price")) return "pricing";
  return "lifecycle";
}
export function rejectAdmission(request: FastifyRequest, reply: FastifyReply, kind: Policy, scope: "process" | "actor" | "resource", seconds: number) {
  const retry = Math.max(1, Math.ceil(seconds));
  request.log.info({ event: "request_admission_rejected", request_id: request.id,
    route: request.routeOptions.url ?? "unmatched", policy_class: kind, scope_type: scope,
    retry_after_seconds: retry }, "Backend admission rejected");
  reply.header("x-request-id", request.id).header("Retry-After", String(retry)).header("Cache-Control", "no-store");
  return reply.code(429).send({ error: "Too Many Requests", message: "Please try again later", request_id: request.id, retry_after_seconds: retry });
}
export function admitActor(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply, kind: Policy, verifiedUserId: string): boolean {
  const wait = app.localAdmission.spend("actor:" + kind, verifiedUserId, admissionPolicy.actor[kind]);
  if (wait) { rejectAdmission(request, reply, kind, "actor", wait); return false; }
  return true;
}
// Call only AFTER existing ownership/assignment/provider validation; never pass
// request.params as resource identity. A failed authorization never charges it.
export function admitResource(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply, kind: keyof typeof admissionPolicy.resource, authorizedId: string): boolean {
  const wait = app.localAdmission.spend("resource:" + kind, authorizedId, [[admissionPolicy.resource[kind], minute]]);
  if (wait) { rejectAdmission(request, reply, kind, "resource", wait); return false; }
  return true;
}
export function authSlot(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply, kind: Policy) {
  const pool = kind === "lifecycle" ? "auth-lifecycle" : "auth";
  const release = app.localAdmission.slot(pool, "process", admissionPolicy.slots[pool]);
  if (!release) rejectAdmission(request, reply, kind, "process", 1);
  return release;
}

export function installAdmission(app: FastifyInstance, state = new Admission()) {
  // Fastify decorators/hooks are inherited by encapsulated route plugins.
  if (app.hasDecorator("localAdmission")) return;
  app.decorate("localAdmission", state);
  app.addHook("onRequest", async (request, reply) => {
    const kind = policy(request.method, request.routeOptions.url ?? "");
    if (!kind) return;
    const wait = state.spend("process:" + kind, "process", [[admissionPolicy.global[kind], minute]]);
    if (wait) return rejectAdmission(request, reply, kind, "process", wait);
  });
  app.addHook("onRoute", options => {
    const kind = policy(String(Array.isArray(options.method) ? options.method[0] : options.method), options.url);
    if (!kind) return;
    if (kind !== "sign" && kind !== "auth") options.bodyLimit = admissionPolicy.jsonBytes;
    const authenticate = options.preHandler;
    // Only the existing code-owned async authentication hook is wrapped.
    if (typeof authenticate === "function" && authenticate.name === "requireAuth") {
      options.preHandler = async function (request, reply) {
        const release = authSlot(this, request, reply, kind);
        if (!release) return;
        try { await authenticate.call(this, request, reply, () => {}); } finally { release(); }
        if (reply.sent) return;
        const actor = (request as FastifyRequest & { user: { id: string } }).user.id;
        if (!admitActor(this, request, reply, kind, actor)) return;
      };
    }
    if (kind === "upload" || kind === "sign" || kind === "discover" || kind === "dispatch") {
      const handler = options.handler;
      options.handler = async function (request, reply) {
        const release = state.slot(kind, "process", admissionPolicy.slots[kind]);
        if (!release) return rejectAdmission(request, reply, kind, "process", 1);
        let actorRelease: (() => void) | undefined;
        try {
          if (kind === "upload") {
            const actor = (request as FastifyRequest & { user: { id: string } }).user.id;
            actorRelease = state.slot("upload-actor", actor, admissionPolicy.slots["upload-actor"]);
            if (!actorRelease) return rejectAdmission(request, reply, kind, "actor", 1);
          }
          // Keep slots until upstream work settles even if the socket aborts.
          // Disconnects must not free capacity while uploads/SDK calls still run.
          return await handler.call(this, request, reply);
        } finally { actorRelease?.(); release(); }
      };
    }
  });
}
