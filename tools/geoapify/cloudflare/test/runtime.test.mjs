import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Miniflare } from "miniflare";
import { execFileSync } from "node:child_process";
const origin = "https://austa-map-test.austahelper.workers.dev",
  secret = "SyntheticProviderCredentialNotReal0001";
const dir = await mkdtemp(path.join(os.tmpdir(), "austa-cf-test-"));
execFileSync("python", ["build.py", path.join(dir, "build")]);
const modules = JSON.parse(
  await readFile(path.join(dir, "build/modules.json"), "utf8"),
);
const harness = `import worker,{MapAdmission}from'./worker.mjs';export{MapAdmission};export default{async fetch(r,e){const u=new URL(r.url),s=e.MAP_ADMISSION.getByName(u.pathname==='/__perpeer'?'isolated-per-peer-test':'austa-map-test-v1');if(u.pathname==='/__stats')return Response.json(await s.stats());if(u.pathname==='/__admit'||u.pathname==='/__perpeer'){try{return Response.json(await s.admit(u.searchParams.get('key'),u.searchParams.get('subject'),{cost:12}));}catch{return new Response('denied',{status:429});}}return worker.fetch(r,e);}};`;
let calls = 0;
const make = () =>
  new Miniflare({
    modules: [
      { type: "ESModule", path: "harness.mjs", contents: harness },
      ...Object.entries(modules).map(([p, contents]) => ({
        type: "ESModule",
        path: p,
        contents,
      })),
    ],
    modulesRoot: process.cwd(),
    compatibilityDate: "2026-07-30",
    bindings: { AUSTA_MAP_MODE: "TEST", GEOAPIFY_SERVER_KEY: secret },
    durableObjects: {
      MAP_ADMISSION: { className: "MapAdmission", useSQLite: true },
    },
    durableObjectsPersist: path.join(dir, "state"),
    outboundService: async (req) => {
      calls++;
      await new Promise((r) => setTimeout(r, 100));
      const u = new URL(req.url);
      assert.ok(["api.geoapify.com", "maps.geoapify.com"].includes(u.host));
      assert.equal(u.searchParams.get("apiKey"), secret);
      return Response.json({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              name: "Synthetic fuel",
              place_id: "fixture",
              country_code: "az",
              categories: ["service.vehicle.fuel"],
              secret: "discard",
            },
            geometry: { type: "Point", coordinates: [49.8671, 40.4093] },
          },
        ],
      });
    },
  });
let mf = make();
const common = {
  Origin: origin,
  Referer: origin + "/",
  "CF-Connecting-IP": "192.0.2.1",
  "Sec-Fetch-Site": "same-origin",
};
const session = async (peer = "192.0.2.1") => {
  const r = await mf.dispatchFetch(origin + "/map-api/session", {
    method: "POST",
    headers: {
      ...common,
      "CF-Connecting-IP": peer,
      "X-AUSTA-Map-Session": "1",
    },
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
};
const url =
  origin + "/map-api/places?box=49.84,40.38,49.89,40.44&category=fuel";
test("actual SQLite workerd: sessions, strict routing, sanitized response and coalescing", async () => {
  assert.equal((await mf.dispatchFetch(url)).status, 403);
  assert.equal((await mf.dispatchFetch(url, { headers: common })).status, 401);
  assert.equal((await mf.dispatchFetch(origin+'/map-api/session',{method:'POST',headers:{...common,'X-AUSTA-Map-Session':'1'},body:'not empty'})).status,403);
  assert.equal((await mf.dispatchFetch(url,{headers:{...common,'CF-Worker':'untrusted.invalid'}})).status,403);
  const cookie = await session();
  assert.ok(cookie.startsWith("__Host-austa-map="));
  const headers = { ...common, Cookie: cookie };
  assert.equal(
    (
      await mf.dispatchFetch(url, {
        headers: { ...headers, Origin: "https://evil.invalid" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await mf.dispatchFetch(url, {
        headers: { ...headers, "CF-Connecting-IP": "192.0.2.2" },
      })
    ).status,
    401,
  );
  assert.equal(
    (await mf.dispatchFetch(url + "&category=wash", { headers })).status,
    400,
  );
  assert.equal(
    (
      await mf.dispatchFetch(
        url.replace("49.84,40.38,49.89,40.44", "44,38,51,42"),
        { headers },
      )
    ).status,
    400,
  );
  const rs = await Promise.all(
    Array.from({ length: 5 }, () => mf.dispatchFetch(url, { headers })),
  );
  assert.ok(rs.every((r) => r.status === 200));
  assert.equal(calls, 1);
  const text = await rs[0].text();
  assert.ok(!text.includes(secret) && !text.includes("discard"));
  assert.equal(JSON.parse(text).features.length, 1);
  assert.equal(
    (await (await mf.dispatchFetch(origin + "/__stats")).json()).units,
    12,
  );
  await mf.dispose();
  mf = make();
  const reused = await mf.dispatchFetch(url, { headers });
  assert.equal(reused.status, 200);
  assert.equal(calls, 1);
  assert.equal(
    (await (await mf.dispatchFetch(origin + "/__stats")).json()).units,
    12,
  );
  assert.equal(
    (await mf.dispatchFetch(origin + "/assets/map/runtime-config.json")).status,
    200,
  );
  assert.ok(
    !(await (await mf.dispatchFetch(origin + "/")).text()).includes(secret),
  );
});
test("actual SQLite concurrent global budget, many principals, persistent restart and cache bypass", async () => {
  const rs = await Promise.all(
    Array.from({ length: 40 }, (_, i) =>
      mf.dispatchFetch(
        origin +
          "/__admit?key=" +
          String(i).padStart(64, "0") +
          "&subject=" +
          String(i).padStart(64, "f"),
      ),
    ),
  );
  const count = rs.filter((r) => r.status === 200).length;
  assert.equal(count, 19);
  assert.equal(
    (await (await mf.dispatchFetch(origin + "/__stats")).json()).units,
    240,
  );
  await mf.dispose();
  mf = make();
  assert.equal(
    (
      await mf.dispatchFetch(
        origin +
          "/__admit?key=" +
          "a".repeat(64) +
          "&subject=" +
          "b".repeat(64),
      )
    ).status,
    429,
  );
  assert.equal(
    (await (await mf.dispatchFetch(origin + "/__stats")).json()).units,
    240,
  );
});
test("cookie reset cannot reset principal daily budget; session issuance is bounded", async () => {
  const r = await mf.dispatchFetch(origin + "/map-api/session", {
    method: "POST",
    headers: { ...common, "X-AUSTA-Map-Session": "1" },
  });
  assert.equal(r.status, 200);
  const blocked = await mf.dispatchFetch(origin + "/map-api/session", {
    method: "POST",
    headers: { ...common, "X-AUSTA-Map-Session": "1" },
  });
  assert.equal(blocked.status, 429);
});
test("per-principal daily cap rejects the eleventh concurrent 12-unit reservation", async()=>{
 const requests=Array.from({length:20},(_,i)=>mf.dispatchFetch(origin+'/__perpeer?key='+String(i).padStart(64,'a')+'&subject='+'c'.repeat(64)));
 const rs=await Promise.all(requests);
 assert.equal(rs.filter(r=>r.status===200).length,10);
 assert.equal(rs.filter(r=>r.status===429).length,10);
 await mf.dispose();mf=make();
 assert.equal((await mf.dispatchFetch(origin+'/__perpeer?key='+'d'.repeat(64)+'&subject='+'c'.repeat(64))).status,429);
});
test.after(async () => {
  await mf.dispose();
  await rm(dir, { recursive: true, force: true });
});
