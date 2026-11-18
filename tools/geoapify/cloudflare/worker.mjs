import { DurableObject } from "cloudflare:workers";
import {
  ORIGIN,
  Denied,
  sha,
  boundary,
  plan,
  safeResponse,
} from "./policy.mjs";
import geometry from "./boundary.mjs";
import assets from "./assets.mjs";
const contains = boundary(geometry),
  POLICY =
    "v1:240:120:60:60:20:8578487282384781be5bf87fb4d4fe0635c1323a2bec08cd331f67f8122266fc";
const COOKIE = "__Host-austa-map",
  enc = new TextEncoder();
const hex = (bytes) =>
  [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
const equal = (a, b) => {
  if (a.length !== b.length) return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
};
const error = (code, status) => ({
  status,
  mime: "application/json",
  body: enc.encode(JSON.stringify({ error: code })),
});
const fail = (code, status = 403) => {
  throw new Denied(code, status);
};
export class MapAdmission extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.transactionSync(() => {
        const existing = this.sql
          .exec(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('meta','usage','rate','cache','lease')",
          )
          .toArray();
        if (existing.length && existing.length !== 5)
          fail("STORE_UNAVAILABLE", 503);
        this.sql.exec(
          "CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK(id=1), policy TEXT NOT NULL, high REAL NOT NULL, secret TEXT NOT NULL)",
        );
        this.sql.exec(
          "CREATE TABLE IF NOT EXISTS usage(day INTEGER,subject TEXT,units INTEGER NOT NULL, PRIMARY KEY(day,subject))",
        );
        this.sql.exec(
          "CREATE TABLE IF NOT EXISTS rate(minute INTEGER,subject TEXT,calls INTEGER NOT NULL, PRIMARY KEY(minute,subject))",
        );
        this.sql.exec(
          "CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY,expiry REAL,mime TEXT,body BLOB)",
        );
        this.sql.exec(
          "CREATE TABLE IF NOT EXISTS lease(key TEXT PRIMARY KEY,owner TEXT,expiry REAL)",
        );
        this.sql.exec(
          "INSERT OR IGNORE INTO meta VALUES(1,?,0,?)",
          POLICY,
          hex(crypto.getRandomValues(new Uint8Array(32))),
        );
        const row = this.sql.exec("SELECT * FROM meta WHERE id=1").one();
        if (row.policy !== POLICY) fail("POLICY", 503);
        this.secret = row.secret;
      });
    });
  }
  tx(fn) {
    return this.ctx.storage.transactionSync(fn);
  }
  clock() {
    const now = Date.now() / 1000,
      high = this.sql.exec("SELECT high FROM meta WHERE id=1").one().high;
    if (now < high - 5) fail("CLOCK", 503);
    this.sql.exec("UPDATE meta SET high=max(high,?) WHERE id=1", now);
    return now;
  }
  rate(subject, limit, now) {
    const minute = Math.floor(now / 60),
      r = this.sql
        .exec(
          "SELECT calls FROM rate WHERE minute=? AND subject=?",
          minute,
          subject,
        )
        .toArray()[0];
    if (r && r.calls >= limit) fail("RATE", 429);
    this.sql.exec(
      "INSERT INTO rate VALUES(?,?,1) ON CONFLICT(minute,subject) DO UPDATE SET calls=calls+1",
      minute,
      subject,
    );
  }
  async mac(text) {
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(this.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return hex(
      new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(text))),
    );
  }
  async subject(peer) {
    if (
      typeof peer !== "string" ||
      peer.length > 64 ||
      !/^[:.0-9a-fA-F]+$/.test(peer)
    )
      fail("PEER");
    return this.mac("peer:" + peer.toLowerCase());
  }
  async verify(peer, cookie) {
    try {
      if (
        typeof cookie !== "string" ||
        cookie.length > 4096 ||
        cookie.split(COOKIE + "=").length !== 2
      )
        return null;
      const token = cookie
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith(COOKIE + "="))
        ?.slice(COOKIE.length + 1);
      const [payload, sig, ...extra] = token.split(".");
      if (
        extra.length ||
        payload.length > 256 ||
        !equal(await this.mac(payload), sig || "")
      )
        return null;
      const data = JSON.parse(
          atob(payload.replaceAll("-", "+").replaceAll("_", "/")),
        ),
        now = Date.now() / 1000;
      if (
        Object.keys(data).sort().join(",") !== "e,s" ||
        data.s !== (await this.subject(peer)) ||
        !Number.isInteger(data.e) ||
        data.e <= now ||
        data.e > now + 900
      )
        return null;
      return data.s;
    } catch {
      return null;
    }
  }
  async session(peer, cookie) {
    try {
      if (await this.verify(peer, cookie)) return { status: 200, cookie: null };
      const subject = await this.subject(peer);
      this.tx(() => {
        const now = this.clock();
        this.rate("session:*", 20, now);
        this.rate("session:" + subject, 2, now);
        this.sql.exec(
          "DELETE FROM rate WHERE minute<?",
          Math.floor(now / 60) - 2,
        );
      });
      const payload = btoa(
        JSON.stringify({ s: subject, e: Math.floor(Date.now() / 1000) + 899 }),
      )
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
      return {
        status: 200,
        cookie: `${COOKIE}=${payload}.${await this.mac(payload)}; Path=/; Max-Age=899; Secure; HttpOnly; SameSite=Strict`,
      };
    } catch (e) {
      return { status: e instanceof Denied ? e.status : 503, cookie: null };
    }
  }
  admit(key, subject, p) {
    return this.tx(() => {
      const now = this.clock(),
        day = Math.floor(now / 86400);
      this.rate("*", 60, now);
      this.rate(subject, 60, now);
      if (p.cost !== 1) this.rate("json:" + subject, 20, now);
      this.sql.exec(
        "DELETE FROM rate WHERE minute<?",
        Math.floor(now / 60) - 2,
      );
      this.sql.exec("DELETE FROM usage WHERE day<?", day - 2);
      this.sql.exec("DELETE FROM cache WHERE expiry<=?", now);
      const cached = this.sql
        .exec("SELECT mime,body FROM cache WHERE key=? AND expiry>?", key, now)
        .toArray()[0];
      if (cached) return { state: "cached", ...cached };
      const lease = this.sql
        .exec("SELECT expiry FROM lease WHERE key=?", key)
        .toArray()[0];
      if (lease?.expiry > now) return { state: "wait" };
      for (const [who, cap] of [
        ["*", 240],
        [subject, 120],
      ]) {
        const row = this.sql
          .exec("SELECT units FROM usage WHERE day=? AND subject=?", day, who)
          .toArray()[0];
        if ((row?.units || 0) + p.cost > cap) fail("BUDGET", 429);
        this.sql.exec(
          "INSERT INTO usage VALUES(?,?,?) ON CONFLICT(day,subject) DO UPDATE SET units=units+excluded.units",
          day,
          who,
          p.cost,
        );
      }
      const owner = crypto.randomUUID();
      this.sql.exec(
        "INSERT INTO lease VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET owner=excluded.owner,expiry=excluded.expiry",
        key,
        owner,
        now + 12,
      );
      return { state: "owner", owner };
    });
  }
  finish(key, owner, response, ttl) {
    this.tx(() => {
      const now = this.clock(),
        lease = this.sql
          .exec("SELECT owner,expiry FROM lease WHERE key=?", key)
          .toArray()[0];
      if (lease?.owner !== owner || lease.expiry <= now) fail("STALE", 503);
      if (response && ttl) {
        this.sql.exec(
          "INSERT INTO cache VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET expiry=excluded.expiry,mime=excluded.mime,body=excluded.body",
          key,
          now + ttl,
          response.mime,
          response.body,
        );
        this.sql.exec(
          "DELETE FROM cache WHERE key NOT IN (SELECT key FROM cache ORDER BY expiry DESC LIMIT 32)",
        );
      }
      this.sql.exec("DELETE FROM lease WHERE key=? AND owner=?", key, owner);
    });
  }
  async query(urlString, peer, cookie) {
    try {
      const subject = await this.verify(peer, cookie);
      if (!subject) fail("AUTH", 401);
      const u = new URL(urlString);
      if (u.origin !== ORIGIN) fail("HOST");
      const p = plan(u, contains),
        key = await sha(
          p.url + JSON.stringify(p.box) + (p.ttl ? "" : crypto.randomUUID()),
        ),
        a = this.admit(key, subject, p);
      if (a.state === "cached")
        return { status: 200, mime: a.mime, body: new Uint8Array(a.body) };
      if (a.state === "wait") {
        for (let i = 0; i < 100; i++) {
          await new Promise((r) => setTimeout(r, 90));
          const cached = this.sql
            .exec(
              "SELECT mime,body FROM cache WHERE key=? AND expiry>?",
              key,
              Date.now() / 1000,
            )
            .toArray()[0];
          if (cached)
            return {
              status: 200,
              mime: cached.mime,
              body: new Uint8Array(cached.body),
            };
        }
        fail("BUSY", 503);
      }
      let result;
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 9500);
      try {
        const secret = this.env.GEOAPIFY_SERVER_KEY;
        if (
          typeof secret !== "string" ||
          !/^[A-Za-z0-9_-]{20,100}$/.test(secret) ||
          secret.startsWith("sb_")
        )
          fail("SERVER_CONFIG", 503);
        const upstream = new URL(p.url);
        upstream.searchParams.set("apiKey", secret);
        const response = await fetch(upstream, {
          method: "GET",
          headers: {
            Accept: p.route === "/tile" ? "image/png" : "application/json",
          },
          redirect: "manual",
          signal: controller.signal,
        });
        result = await safeResponse(response, p, contains, secret);
        this.finish(key, a.owner, result, p.ttl);
        return { status: 200, ...result };
      } catch {
        try {
          this.finish(key, a.owner, null, 0);
        } catch {}
        return error("UPSTREAM", 502);
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      return error(
        e instanceof Denied ? e.code : "UNAVAILABLE",
        e instanceof Denied ? e.status : 503,
      );
    }
  }
  // No public URL exposes this RPC; tests can inspect aggregate reservations only.
  stats() {
    const day = Math.floor(Date.now() / 86400000);
    return {
      units:
        this.sql
          .exec("SELECT units FROM usage WHERE day=? AND subject=?", day, "*")
          .toArray()[0]?.units || 0,
      cache: this.sql.exec("SELECT count(*) AS n FROM cache").one().n,
    };
  }
}
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' https://xnhxneziasqthkhhntkv.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};
async function emptyRequest(request) {
  if (!request.body) return true;
  const reader=request.body.getReader(); let timer;
  try {
    const part=await Promise.race([reader.read(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Denied('SESSION_REQUEST',403)),2000);})]);
    return part.done===true;
  } finally {clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
function reply(body, status = 200, mime = "application/json", extra = {}) {
  return new Response(body, {
    status,
    headers: { ...headers, "Content-Type": mime, ...extra },
  });
}
export default {
  async fetch(request, env) {
    try {
      const u = new URL(request.url);
      if (u.origin !== ORIGIN || env.AUSTA_MAP_MODE !== "TEST")
        fail("TEST_SCOPE");
      if (u.username || u.password || u.hash) fail("PARAMETERS", 400);
      const path = u.pathname;
      if (path === "/health" && request.method === "GET" && !u.search) {
        const stats =
          await env.MAP_ADMISSION.getByName("austa-map-test-v1").stats();
        return reply(
          JSON.stringify({
            mode: "TEST",
            ready: true,
            reservedUnits: stats.units,
            cacheEntries: stats.cache,
            globalDailyCap: 240,
            perPeerDailyCap: 120,
          }),
        );
      }
      if(path === '/map-test-config' && request.method === 'GET' && !u.search){
        const key=env.SUPABASE_TEST_PUBLISHABLE_KEY;
        if(typeof key!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{10,100}$/.test(key))fail('TEST_CONFIG',503);
        // Public anon credential by design: no Geoapify/server/service-role value.
        return reply(JSON.stringify({project:'xnhxneziasqthkhhntkv',publishableKey:key}));
      }
      if (path.startsWith("/map-api/")) {
        if (request.headers.has("CF-Worker")) fail("WORKER_SUBREQUEST");
        const origin = request.headers.get("Origin"),
          referer = request.headers.get("Referer"),
          site = request.headers.get("Sec-Fetch-Site");
        if (site && site !== "same-origin") fail("ORIGIN");
        if (origin && origin !== ORIGIN) fail("ORIGIN");
        if (!origin) {
          try {
            if (new URL(referer).origin !== ORIGIN) fail("ORIGIN");
          } catch {
            fail("ORIGIN");
          }
        }
        const peer = request.headers.get("CF-Connecting-IP") || "",
          cookie = request.headers.get("Cookie") || "",
          stub = env.MAP_ADMISSION.getByName("austa-map-test-v1");
        if (path === "/map-api/session") {
          if (
            request.method !== "POST" ||
            origin !== ORIGIN ||
            request.headers.get("X-AUSTA-Map-Session") !== "1" ||
            u.search ||
            (request.headers.get("Content-Length") &&
              !["0"].includes(request.headers.get("Content-Length"))) ||
            !(await emptyRequest(request))
          )
            fail("SESSION_REQUEST");
          const r = await stub.session(peer, cookie);
          return reply(
            JSON.stringify(
              r.status === 200 ? { ready: true } : { error: "SESSION_DENIED" },
            ),
            r.status,
            "application/json",
            r.cookie ? { "Set-Cookie": r.cookie } : {},
          );
        }
        if (request.method !== "GET") fail("METHOD", 405);
        const r = await stub.query(u.href, peer, cookie);
        return reply(r.body, r.status, r.mime);
      }
      if (request.method !== "GET" || u.search) fail("NOT_FOUND", 404);
      if (path === "/assets/map/runtime-config.json")
        return reply(
          JSON.stringify({ proxyPath: "/map-api", allowedOrigins: [ORIGIN] }),
        );
      const a = assets[path];
      if (!a) fail("NOT_FOUND", 404);
      return reply(
        Uint8Array.from(atob(a.body), (c) => c.charCodeAt(0)),
        200,
        a.mime,
      );
    } catch (e) {
      return reply(
        JSON.stringify({ error: e instanceof Denied ? e.code : "UNAVAILABLE" }),
        e instanceof Denied ? e.status : 503,
      );
    }
  },
};
