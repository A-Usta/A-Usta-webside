import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { boundary, plan, safeResponse, png, ORIGIN } from "../policy.mjs";
const contains = boundary(
  JSON.parse(
    fs.readFileSync(new URL("../../proxy/aze-adm0.geojson", import.meta.url)),
  ),
);
test("real AZ polygon covers nine samples and rejects neighboring countries", () => {
  for (const [x, y] of [
    [49.8671, 40.4093],
    [49.6682, 40.5897],
    [46.3606, 40.6828],
    [47.1706, 41.1919],
    [48.5134, 41.3611],
    [48.1268, 41.1786],
    [48.8506, 38.752],
    [46.9274, 39.9908],
    [45.4122, 39.2089],
  ])
    assert.ok(contains(x, y), [x, y].join(","));
  for (const [x, y] of [
    [44.5152, 40.1872],
    [44.793, 41.715],
    [46.2919, 38.0962],
  ])
    assert.equal(contains(x, y), false);
  const h = boundary({
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
      [
        [1, 1],
        [3, 1],
        [3, 3],
        [1, 3],
        [1, 1],
      ],
    ],
  });
  assert.ok(h(0.5, 0.5));
  assert.equal(h(2, 2), false);
});
test("fixed endpoints, bounded coordinates, query manipulation and category rejection", () => {
  const base =
    ORIGIN + "/map-api/places?category=all&box=49.84,40.38,49.89,40.44";
  assert.equal(plan(new URL(base), contains).cost, 12);
  for (const suffix of [
    "&apiKey=attacker",
    "&url=https://evil.invalid",
    "&category=wash",
    "&page=3",
    "&name=%00",
    "&limit=10000",
  ])
    assert.throws(() => plan(new URL(base + suffix), contains));
  for (const category of ["tow", "cargo", "constructor", "__proto__"])
    assert.throws(() =>
      plan(
        new URL(base.replace("category=all", "category=" + category)),
        contains,
      ),
    );
  assert.throws(() =>
    plan(
      new URL(base.replace("49.84,40.38,49.89,40.44", "44.7,38.3,50.95,41.95")),
      contains,
    ),
  );
  assert.throws(() =>
    plan(
      new URL(
        ORIGIN + "/map-api/tile?z=11&x=1&y=1&box=49.84,40.38,49.89,40.44",
      ),
      contains,
    ),
  );
  assert.throws(() =>
    plan(
      new URL(ORIGIN + "/map-api/geocode?text=AZ&filter=countrycode:us"),
      contains,
    ),
  );
});
test("safe DTO rejects secret, redirect, malformed PNG, oversized body; strips metadata and foreign points", async () => {
  const key = "NotARealCredentialSynthetic123456";
  const p = plan(
    new URL(
      ORIGIN + "/map-api/places?category=fuel&box=49.84,40.38,49.89,40.44",
    ),
    contains,
  );
  const f = (x, y) => ({
    type: "Feature",
    properties: {
      country_code: "az",
      name: "Fuel",
      place_id: "id",
      categories: ["service.vehicle.fuel", "private.category"],
      private: "hidden",
    },
    geometry: { type: "Point", coordinates: [x, y] },
  });
  const r = await safeResponse(
      Response.json({
        type: "FeatureCollection",
        features: [f(49.8671, 40.4093), f(44.51, 40.18)],
      }),
      p,
      contains,
      key,
    ),
    s = new TextDecoder().decode(r.body);
  assert.equal(JSON.parse(s).features.length, 1);
  assert.ok(!s.includes("private") && !s.includes(key));
  await assert.rejects(() =>
    safeResponse(
      Response.json({ type: "FeatureCollection", features: [], key }),
      p,
      contains,
      key,
    ),
  );
  await assert.rejects(() =>
    safeResponse(new Response("", { status: 302 }), p, contains, key),
  );
  await assert.rejects(() =>
    safeResponse(
      new Response("x".repeat(2000001), {
        headers: { "Content-Type": "application/json" },
      }),
      p,
      contains,
      key,
    ),
  );
  assert.throws(() => png(new Uint8Array(50)));
});

test("geocoding retains addresses and adds real country context to ambiguous AZ city names", () => {
  const a = plan(
    new URL(ORIGIN + "/map-api/geocode?text=" + encodeURIComponent("Gəncə")),
    contains,
  );
  assert.equal(new URL(a.url).searchParams.get("text"), "Gəncə, Azərbaycan");
  const b = plan(
    new URL(
      ORIGIN +
        "/map-api/geocode?text=" +
        encodeURIComponent("Gəncə, Azərbaycan"),
    ),
    contains,
  );
  assert.equal(new URL(b.url).searchParams.get("text"), "Gəncə, Azərbaycan");
});
