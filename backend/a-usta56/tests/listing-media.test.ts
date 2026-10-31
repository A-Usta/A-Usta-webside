import assert from "node:assert/strict";
import { test } from "node:test";
import { Writable } from "node:stream";
import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import Fastify from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";

// No production clients/credentials or network operations are used by these tests.
process.env.SUPABASE_URL = "https://example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-secret";
const { registerListingMediaRoutes, listingMediaRoutes } = await import("../src/routes/listing-media.js");
const owner = "11111111-1111-1111-1111-111111111111";
const listing = "22222222-2222-2222-2222-222222222222";
const path = `${owner}/${listing}/photo-1.jpg`;
const signedUrl = "https://example.invalid/authorized-object";
const secret = "never-log-this-token";

type Scenario = {
  status?: string;
  relation?: Record<string, unknown>[];
  parent?: Record<string, unknown> | null;
  failure?: "relation" | "parent" | "auth" | "sign";
  throwAt?: "relation" | "parent" | "auth" | "sign";
  user?: string | null;
  emptySignedUrl?: boolean;
};

async function fixture(scenario: Scenario = {}) {
  const calls: string[] = [], logs: string[] = [];
  const error = { message: `private SDK error ${secret} ${path}` };
  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      assert.ok(["listing_media", "vehicle_listings"].includes(table));
      return {
        select(fields: string) {
          assert.equal(fields, table === "listing_media"
            ? "listing_id,owner_id,storage_path" : "id,owner_id,status");
          return this;
        },
        eq(column: string, value: unknown) {
          assert.equal(column, table === "listing_media" ? "storage_path" : "id");
          assert.equal(value, table === "listing_media" ? path : scenario.relation?.[0]?.listing_id ?? listing);
          return this;
        },
        async limit(amount: number) {
          calls.push("relation"); assert.equal(table, "listing_media"); assert.equal(amount, 2);
          if (scenario.throwAt === "relation") throw error;
          return { data: scenario.relation ?? [{ listing_id: listing, owner_id: owner, storage_path: path }],
            error: scenario.failure === "relation" ? error : null };
        },
        async maybeSingle() {
          calls.push("parent"); assert.equal(table, "vehicle_listings");
          if (scenario.throwAt === "parent") throw error;
          return { data: scenario.parent === undefined
            ? { id: listing, owner_id: owner, status: scenario.status ?? "active" } : scenario.parent,
            error: scenario.failure === "parent" ? error : null };
        },
      };
    },
    auth: {
      async getUser(token: string) {
        calls.push("auth"); assert.equal(token, secret);
        if (scenario.throwAt === "auth") throw error;
        return { data: { user: scenario.user ? { id: scenario.user } : null },
          error: scenario.failure === "auth" ? error : null };
      },
      setSession() { assert.fail("Must not mutate service-role session"); },
    },
    storage: {
      from(bucket: string) {
        calls.push("storage"); assert.equal(bucket, "listing-media");
        return {
          async createSignedUrl(object: string, ttl: number) {
            calls.push("sign"); assert.equal(object, path); assert.equal(ttl, 3600);
            if (scenario.throwAt === "sign") throw error;
            return { data: { signedUrl: scenario.emptySignedUrl ? "" : signedUrl },
              error: scenario.failure === "sign" ? error : null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;
  const stream = new Writable({ write(chunk, _encoding, done) { logs.push(String(chunk)); done(); } });
  const app = Fastify({ logger: { stream } });
  await registerListingMediaRoutes(app, client);
  await app.ready();
  return { app, calls, logs };
}

async function request(scenario: Scenario = {}, authorization?: string) {
  const f = await fixture(scenario);
  try {
    const response = await f.app.inject({ method: "GET",
      url: `/listing-media/signed-url?path=${encodeURIComponent(path)}`,
      headers: authorization ? { authorization } : {} });
    return { ...f, response };
  } finally { await f.app.close(); }
}

for (const [name, authorization] of [
  ["anon", undefined], ["non-owner", `Bearer ${secret}`], ["owner", `Bearer ${secret}`],
] as const) {
  test(`${name} + active media: allowed without auth dependency`, async () => {
    const { response, calls } = await request({}, authorization);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { url: signedUrl, expiresIn: 3600 });
    assert.equal(response.headers["cache-control"], "private, no-store");
    assert.deepEqual(calls, ["from:listing_media", "relation", "from:vehicle_listings", "parent", "storage", "sign"]);
  });
}

const denied: [string, Scenario, string?][] = [
  ["anon draft", { status: "draft" }],
  ["non-owner draft", { status: "draft", user: "another-owner" }, `Bearer ${secret}`],
  ["anon inactive", { status: "inactive" }],
  ["invalid bearer inactive", { status: "inactive", failure: "auth", user: owner }, `Bearer ${secret}`],
  ["no verified user", { status: "inactive" }, `Bearer ${secret}`],
  ["non-owner inactive", { status: "inactive", user: "another-owner" }, `Bearer ${secret}`],
  ["malformed bearer", { status: "inactive", user: owner }, "Bearer"],
  ["wrong auth scheme", { status: "inactive", user: owner }, `Basic ${secret}`],
  ["missing relation", { relation: [] }],
  ["duplicate relation", { relation: [{ listing_id: listing }, { listing_id: listing }] }],
  ["relation missing listing ID", { relation: [{ owner_id: owner, storage_path: path }] }],
  ["relation wrong stored path", { relation: [{ listing_id: listing, owner_id: owner, storage_path: "other-path" }] }],
  ["parent missing", { parent: null }],
  ["parent missing owner", { parent: { id: listing, status: "active" } }],
  ["media owner mismatch", { relation: [{ listing_id: listing, owner_id: "another-owner", storage_path: path }] }],
  ["media owner null", { relation: [{ listing_id: listing, owner_id: null, storage_path: path }] }],
  ["path owner mismatch", { parent: { id: listing, owner_id: "other-owner", status: "active" },
    relation: [{ listing_id: listing, owner_id: "other-owner", storage_path: path }] }],
  ["path listing mismatch", { parent: { id: "other-listing", owner_id: owner, status: "active" },
    relation: [{ listing_id: "other-listing", owner_id: owner, storage_path: path }] }],
  ["parent ID mismatch", { parent: { id: "other-listing", owner_id: owner, status: "active" } }],
  ["relation query error", { failure: "relation" }],
  ["parent query error", { failure: "parent" }],
  ["relation exception", { throwAt: "relation" }],
  ["parent exception", { throwAt: "parent" }],
  ["auth exception", { status: "inactive", throwAt: "auth" }, `Bearer ${secret}`],
];
for (const [name, scenario, authorization] of denied) {
  test(`${name}: same safe denial, never signs`, async () => {
    const { response, calls, logs } = await request(scenario, authorization);
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { error: "Media tapılmadı." });
    assert.ok(!calls.includes("storage") && !calls.includes("sign"));
    assert.ok(!logs.join("").includes(secret));
    assert.ok(!logs.join("").includes(owner));
  });
}

test("verified owner draft: verifies before signing", async () => {
  const { response, calls } = await request({ status: "draft", user: owner }, `Bearer ${secret}`);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, ["from:listing_media", "relation", "from:vehicle_listings", "parent", "auth", "storage", "sign"]);
});

for (const scenario of [{ failure: "sign" }, { throwAt: "sign" }, { emptySignedUrl: true }] as Scenario[]) {
  test(`signing failure ${JSON.stringify(scenario)}: safe error`, async () => {
    const { response, logs } = await request(scenario);
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { error: "Media tapılmadı." });
    assert.ok(!logs.join("").includes(secret));
    assert.ok(!logs.join("").includes(owner));
  });
}

const invalid: [string, string | undefined][] = [
  ["missing", undefined], ["empty", ""], ["whitespace", ` ${path}`],
  ["too long", `${owner}/${listing}/${"x".repeat(1025)}.jpg`],
  ["absolute URL", `https://example.invalid/${path}`],
  ["leading slash", `/${path}`], ["backslash", path.replace("/", "\\")],
  ["control", `${path}\u0000`], ["newline", `${path}\n`],
  ["dot segment", `${owner}/./photo.jpg`], ["traversal", `${owner}/../photo.jpg`],
  ["duplicate slash", path.replace("/", "//")],
  ["encoded traversal", `${owner}/%2e%2e/photo.jpg`],
  ["double encoded traversal", `${owner}/%252e%252e/photo.jpg`],
  ["encoded slash", `${owner}/${listing}/photo%2fsecret.jpg`],
  ["encoded backslash", `${owner}/${listing}/photo%5csecret.jpg`],
  ["bucket prefix", `listing-media/${path}`],
  ["other bucket", `marketplace-media/${path}`],
  ["missing segments", "photo.jpg"], ["extra segment", `${path}/extra`],
  ["empty filename", `${owner}/${listing}/`], ["dot filename", `${owner}/${listing}/.`],
  ["dotdot filename", `${owner}/${listing}/..`],
];
for (const [name, input] of invalid) {
  test(`invalid path ${name}: rejects before DB/signing`, async () => {
    const f = await fixture();
    try {
      const url = "/listing-media/signed-url" + (input === undefined ? "" : `?path=${encodeURIComponent(input)}`);
      const response = await f.app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 400);
      assert.deepEqual(f.calls, []);
      assert.ok(!f.logs.join("").includes(owner));
    } finally { await f.app.close(); }
  });
}

test("duplicate query path rejected by actual Fastify parser", async () => {
  const f = await fixture();
  try {
    const response = await f.app.inject({ url: `/listing-media/signed-url?path=${encodeURIComponent(path)}&path=${encodeURIComponent(path)}` });
    assert.equal(response.statusCode, 400); assert.deepEqual(f.calls, []);
  } finally { await f.app.close(); }
});

test("array-style path rejected", async () => {
  const f = await fixture();
  try {
    const response = await f.app.inject({ url: `/listing-media/signed-url?path[]=${encodeURIComponent(path)}` });
    assert.equal(response.statusCode, 400); assert.deepEqual(f.calls, []);
  } finally { await f.app.close(); }
});

test("ordinary encodeURIComponent legacy request works; logs omit path/token", async () => {
  const { response, logs } = await request({}, `Bearer ${secret}`);
  assert.equal(response.statusCode, 200);
  assert.ok(logs.some(line => line.includes("incoming request")));
  assert.ok(!logs.join("").includes(owner));
  assert.ok(!logs.join("").includes(secret));
});

test("route remains a normal one-argument Fastify plugin", () => {
  assert.equal(listingMediaRoutes.length, 1);
});

// Source preservation checks complement the actual request/auth tests above.
test("frontend direct media consumers and owner detail adapter remain present", () => {
  const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
  const seller = readFileSync(new URL("../../../assets/marketplace/seller-page.js", import.meta.url), "utf8");
  assert.ok(html.includes("async function hydrateSupabaseListingMedia(item)"));
  assert.ok(html.includes("await hydrateSupabaseListingMedia("));
  assert.ok(html.includes(".createSignedUrl(row.storage_path,3600)"));
  assert.ok(html.includes("hydrateVehicleCardMedia: listings => attachImages(window.AUSTA_SUPABASE, listings)"));
  assert.ok(seller.includes("await api.hydrateVehicleCardMedia(eligible)"));
  assert.ok(html.includes('media_type","video"') || html.includes('"media_type",\n          "video"'));
});

for (const parameter of ["bucket=marketplace-media", "source=marketplace", "path%5B%5D=extra"]) {
  test(`unexpected bucket/source/array parameter ${parameter}: denied`, async () => {
    const f = await fixture();
    try {
      const response = await f.app.inject({ url: `/listing-media/signed-url?path=${encodeURIComponent(path)}&${parameter}` });
      assert.equal(response.statusCode, 400); assert.deepEqual(f.calls, []);
    } finally { await f.app.close(); }
  });
}

for (const [name, status, listingType] of [
  ["active Vehicle detail", "active", "sale"],
  ["active Rent detail/video", "active", "rent"],
  ["draft owner detail media", "draft", "sale"],
]) {
  test(`${name}: existing real hydration signs via shared Storage, not legacy backend`, async () => {
    const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
    const start = html.indexOf("async function hydrateSupabaseListingMedia(item)");
    const end = html.indexOf("\nfunction imagePaths(item)", start);
    assert.ok(start > 0 && end > start);
    const calls: string[] = [];
    const sb = {
      from(table: string) {
        assert.equal(table, "listing_media");
        return {
          select() { return this; },
          eq(column: string, id: string) { assert.equal(column, "listing_id"); assert.equal(id, listing); return this; },
          async order() { return { error: null, data: [
            { id: "image", listing_id: listing, storage_path: path, media_type: "image" },
            { id: "video", listing_id: listing, storage_path: `${owner}/${listing}/clip.mp4`, media_type: "video" },
          ] }; },
        };
      },
      storage: {
        from(bucket: string) {
          assert.equal(bucket, "listing-media");
          return { async createSignedUrl(object: string, ttl: number) {
            assert.equal(ttl, 3600); calls.push(object);
            return { error: null, data: { signedUrl: `https://example.invalid/${object}` } };
          } };
        },
      },
    };
    const item = { id: listing, status, listing_type: listingType, _austaSupabase: true, __austa_table: "vehicle_listings" };
    const result = await runInNewContext(html.slice(start, end) + ";hydrateSupabaseListingMedia(item)", {
      window: { AUSTA_SUPABASE: sb }, item, console,
      fetch() { assert.fail("Real detail must not request legacy signer"); },
    });
    assert.equal(result._austaMediaError, false);
    assert.equal(calls.length, 2);
    assert.equal(result.image_paths.length, 1);
    assert.ok(result.video_path.endsWith("clip.mp4"));
  });
}
