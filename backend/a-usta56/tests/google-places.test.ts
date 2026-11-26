import assert from "node:assert/strict";
import { test } from "node:test";
import { Writable } from "node:stream";
import Fastify from "fastify";
import { Admission, installAdmission, admissionPolicy } from "../src/diagnostics/admission.js";
import { diagnosticsOptions, installDiagnostics } from "../src/diagnostics/foundation.js";

process.env.SUPABASE_URL = "https://example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "TEST_SUPABASE_SERVICE_ROLE_NOT_A_SECRET";
const { supabase } = await import("../src/config/supabase.js");
const { registerGooglePlacesRoutes } = await import("../src/routes/google-places.js");

const userId = "11111111-1111-4111-8111-111111111111";
const key = "TEST_GOOGLE_KEY_NEVER_LOG";
const point = (id: string, name: string, latitude: number, longitude: number) => ({
  id, displayName: { text: name }, formattedAddress: "Bakı, Azərbaycan",
  location: { latitude, longitude }, types: ["gas_station"], nationalPhoneNumber: "+994 12 000 00 00",
  regularOpeningHours: { weekdayDescriptions: ["Bazar ertəsi: 09:00–18:00"] }, rating: 4.4, userRatingCount: 123,
});

async function fixture(options: Parameters<typeof registerGooglePlacesRoutes>[1] = {}) {
  const logs: string[] = [], originalGetUser = supabase.auth.getUser.bind(supabase.auth);
  (supabase.auth as any).getUser = async (token: string) => token === "valid-test-token"
    ? { data: { user: { id: userId } }, error: null }
    : { data: { user: null }, error: { message: "invalid" } };
  const stream = new Writable({ write(chunk, _encoding, done) { logs.push(String(chunk)); done(); } });
  const app = Fastify({ ...diagnosticsOptions, logger: { ...diagnosticsOptions.logger, stream } });
  installDiagnostics(app); installAdmission(app, new Admission());
  await registerGooglePlacesRoutes(app, options); await app.ready();
  return { app, logs, restore: () => { (supabase.auth as any).getUser = originalGetUser; } };
}
const validBody = { category: "fuel", latitude: 40.4093, longitude: 49.8671, radiusKm: 10 };
async function send(f: Awaited<ReturnType<typeof fixture>>, body: unknown, token?: string) {
  return f.app.inject({ method: "POST", url: "/places/nearby-search", payload: body,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) } });
}

test("Places route requires a verified session and never calls Google for guests", async () => {
  const f = await fixture({ apiKey: key, fetchImpl: async () => { assert.fail("upstream must not run"); } });
  try {
    const response = await send(f, validBody);
    assert.equal(response.statusCode, 401);
  } finally { await f.app.close(); f.restore(); }
});

test("Nearby Search validates scope and uses fixed type filters, field mask and no-store", async () => {
  let captured: { url?: string; init?: RequestInit } = {};
  const f = await fixture({ apiKey: key, fetchImpl: async (input, init) => {
    captured = { url: String(input), init }; return Response.json({ places: [
      point("places/id-1", "TEST Fuel", 40.41, 49.87),
      point("places/id-1", "duplicate", 40.41, 49.87),
      point("places/outside", "Outside", 40.80, 49.90),
    ] });
  } });
  try {
    const response = await send(f, validBody, "valid-test-token");
    assert.equal(response.statusCode, 200); assert.equal(response.headers["cache-control"], "private, no-store");
    const body = response.json(); assert.equal(body.places.length, 1); assert.equal(body.places[0].name, "TEST Fuel");
    assert.equal(body.places[0].attribution, "Google Maps"); assert.equal(body.attribution, "Google Maps");
    assert.equal(body.places[0].phone, "+994 12 000 00 00"); assert.equal(body.places[0].rating, 4.4);
    assert.equal(captured.url, "https://places.googleapis.com/v1/places:searchNearby");
    assert.equal((captured.init?.headers as Record<string, string>)["X-Goog-Api-Key"], key);
    assert.equal((captured.init?.headers as Record<string, string>)["X-Goog-FieldMask"],
      "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.nationalPhoneNumber,places.regularOpeningHours.weekdayDescriptions,places.rating,places.userRatingCount");
    assert.deepEqual(JSON.parse(String(captured.init?.body)).includedTypes, ["gas_station"]);
    assert.equal(captured.init?.signal instanceof AbortSignal, true);
    assert.ok(!f.logs.join("").includes(key));
  } finally { await f.app.close(); f.restore(); }
});

test("custom category uses server-owned Text Search query and location bias", async () => {
  let captured: any;
  const f = await fixture({ apiKey: key, fetchImpl: async (input, init) => {
    captured = { url: String(input), body: JSON.parse(String(init?.body)) };
    return Response.json({ places: [point("places/ev-1", "EV Charge", 40.41, 49.87)] });
  } });
  try {
    const response = await send(f, { ...validBody, category: "charging" }, "valid-test-token");
    assert.equal(response.statusCode, 200);
    assert.equal(captured.url, "https://places.googleapis.com/v1/places:searchNearby");
    assert.deepEqual(captured.body.includedTypes, ["electric_vehicle_charging_station"]);
    assert.equal(captured.body.locationRestriction.circle.radius, 10_000);
  } finally { await f.app.close(); f.restore(); }
});

test("tire category uses the supported Nearby Search type", async () => {
  let captured: any;
  const f = await fixture({ apiKey: key, fetchImpl: async (input, init) => {
    captured = { url: String(input), body: JSON.parse(String(init?.body)) };
    return Response.json({ places: [point("places/tyre-1", "TEST Tire Repair", 40.41, 49.87)] });
  } });
  try {
    const response = await send(f, { ...validBody, category: "tyre" }, "valid-test-token");
    assert.equal(response.statusCode, 200); assert.equal(captured.url, "https://places.googleapis.com/v1/places:searchNearby");
    assert.deepEqual(captured.body.includedTypes, ["tire_shop"]);
    assert.equal(captured.body.locationRestriction.circle.radius, 10_000);
    assert.equal("query" in captured.body, false);
  } finally { await f.app.close(); f.restore(); }
});

test("invalid requests, absent TEST key, and upstream failures return distinct safe errors", async () => {
  const f = await fixture({ fetchImpl: async () => Response.json({}) });
  try {
    for (const invalid of [null, {}, { ...validBody, category: "arbitrary" }, { ...validBody, radiusKm: 50.1 }, { ...validBody, latitude: "40" }, { ...validBody, extra: true }]) {
      assert.equal((await send(f, invalid, "valid-test-token")).statusCode, 400);
    }
    assert.equal((await send(f, validBody, "valid-test-token")).json().code, "PLACES_NOT_CONFIGURED");
  } finally { await f.app.close(); f.restore(); }
  for (const scenario of [
    { fetchImpl: async () => new Response("billing detail secret", { status: 403 }), code: "PLACES_UPSTREAM_ERROR" },
    { fetchImpl: async () => { throw new TypeError("private upstream detail"); }, code: "PLACES_NETWORK_ERROR" },
    { fetchImpl: async () => new Response("bad", { status: 429 }), code: "PLACES_RATE_LIMITED" },
  ]) {
    const g = await fixture({ apiKey: key, fetchImpl: scenario.fetchImpl });
    try { const response = await send(g, validBody, "valid-test-token"); assert.equal(response.json().code, scenario.code); assert.ok(!response.body.includes("billing detail secret")); assert.ok(!g.logs.join("").includes(key)); }
    finally { await g.app.close(); g.restore(); }
  }
});

test("Google TEST permission failures are classified without leaking upstream details", async () => {
  for (const item of [
    { message: "Billing has not been enabled for this project", code: "PLACES_BILLING_REQUIRED" },
    { message: "Requests from this IP address are not allowed", code: "PLACES_IP_RESTRICTION" },
    { message: "Places API is not enabled for this project", code: "PLACES_API_PERMISSION" },
  ]) {
    const f = await fixture({ apiKey: key, fetchImpl: async () => Response.json({ error: { status: "PERMISSION_DENIED", message: item.message } }, { status: 403 }) });
    try {
      const response = await send(f, validBody, "valid-test-token");
      assert.equal(response.statusCode, 502); assert.equal(response.json().code, item.code);
      assert.doesNotMatch(response.body, /PERMISSION_DENIED|this IP address|Billing has not|Places API is not enabled/);
    } finally { await f.app.close(); f.restore(); }
  }
});

test("all 17 mobile map filter keys have a bounded backend query policy", async () => {
  assert.ok(admissionPolicy.actor.places[0][0] <= 10);
  const categories = ["all", "fuel", "charging", "service", "tyre", "wash", "parts_shop", "auto_electrician", "oil_change", "diagnostics", "inspection", "towing", "parking", "repair", "alignment", "other_auto", "usta"];
  for (const category of categories) {
    let calls = 0;
    const f = await fixture({ apiKey: key, fetchImpl: async () => { calls++; return Response.json({ places: [] }); } });
    try { const response = await send(f, { ...validBody, category }, "valid-test-token"); assert.equal(response.statusCode, 200, category); assert.equal(calls, category === "all" ? 2 : 1); }
    finally { await f.app.close(); f.restore(); }
  }
});
