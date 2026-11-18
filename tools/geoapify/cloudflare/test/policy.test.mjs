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

test('live CI requires exact owner manual action, rejects forks, other PRs, branches and pushes; no secrets',()=>{
 const y=fs.readFileSync(new URL('../../../../.github/workflows/v356-cloudflare-test.yml',import.meta.url),'utf8');
 const condition=y.match(/    if: >-\n([\s\S]+?)    runs-on:/)[1].split('\n').map(x=>x.trim()).join(' ');
 const allowed=new Function('github','return ('+condition+')');
 const base={repository:'A-Usta/A-Usta-webside',actor:'A-Usta',event_name:'pull_request',ref:'refs/pull/296/merge',event:{action:'labeled',label:{name:'austa-map-live-qa'},pull_request:{number:296,head:{repo:{full_name:'A-Usta/A-Usta-webside'},ref:'feat/v356-live-automotive-map'}}}};
 assert.equal(allowed(base),true);
 const change=(fn)=>{const x=structuredClone(base);fn(x);return allowed(x);};
 for(const fn of[x=>x.actor='other',x=>x.event.action='synchronize',x=>x.event.label.name='other',x=>x.event.pull_request.number=294,x=>x.event.pull_request.head.repo.full_name='fork/repo',x=>x.event.pull_request.head.ref='main',x=>x.event_name='push'])assert.equal(change(fn),false);
 assert.equal(allowed({repository:base.repository,actor:base.actor,event_name:'workflow_dispatch',ref:'refs/heads/feat/v356-live-automotive-map',event:{}}),true);
 assert.equal(allowed({repository:base.repository,actor:base.actor,event_name:'workflow_dispatch',ref:'refs/heads/main',event:{}}),false);
 assert.doesNotMatch(y,/secrets\./);assert.match(y,/contents: read/);assert.match(y,/github\.event\.pull_request\.head\.sha \|\| github\.sha/);
});

test('safe paging retains raw-page fullness after country filtering and explicit tyre evidence survives DTO',async()=>{
 const p=plan(new URL(ORIGIN+'/map-api/places?category=repair&box=49.84,40.38,49.89,40.44'),contains);
 const feature=(foreign)=>({type:'Feature',geometry:{type:'Point',coordinates:foreign?[44.51,40.18]:[49.8671,40.4093]},properties:{country_code:'az',name:'Independent',brand:'SOCAR',operator:'Operator',categories:['service.vehicle.repair.car'],datasource:{raw:{'service:vehicle:tyres_repair':'yes','service:vehicle:alignment':'no',shop:'tyres',private:'discard'}}}});
 const r=await safeResponse(Response.json({type:'FeatureCollection',features:Array.from({length:20},(_,i)=>feature(i>0))}),p,contains,'SyntheticOnlySecretValue');
 const d=JSON.parse(new TextDecoder().decode(r.body));assert.equal(d.features.length,1);assert.equal(d.hasMore,true);assert.equal(d.features[0].properties.brand,'SOCAR');assert.equal(d.features[0].properties.datasource.raw['service:vehicle:tyres_repair'],'yes');assert.equal(d.features[0].properties.datasource.raw.shop,'tyres');assert.equal(d.features[0].properties.datasource.raw.private,undefined);assert.equal(d.features[0].properties.datasource.raw['service:vehicle:alignment'],undefined);
});

test('TEST public adapter accepts only anonymous discovery, pinned TEST config, no privileged key or mutable API',async()=>{
 const vm=await import('node:vm'),source=fs.readFileSync(new URL('../test-providers.js',import.meta.url),'utf8');
 const calls=[],window={location:{origin:ORIGIN}};const key='sb_publishable_SyntheticNotActualCredential01';
 vm.runInNewContext(source,{window,fetch:async(u,opts)=>{calls.push([u,opts]);return {ok:true,json:async()=>({project:'xnhxneziasqthkhhntkv',publishableKey:key}),text:async()=> '[]'};}});
 assert.deepEqual(Object.keys(window.AUSTA_SUPABASE),['rpc']);
 await assert.rejects(window.AUSTA_SUPABASE.rpc('delete_all',{}));
 await assert.rejects(window.AUSTA_SUPABASE.rpc('discover_public_providers',{owner_id:'attacker'}));
 const c=new AbortController();assert.equal((await window.AUSTA_SUPABASE.rpc('discover_public_providers',{south:40.38,west:49.84,north:40.44,east:49.90}).abortSignal(c.signal)).data.length,0);
 assert.equal(calls.length,2);assert.equal(calls[1][0],'https://xnhxneziasqthkhhntkv.supabase.co/rest/v1/rpc/discover_public_providers');assert.equal(calls[1][1].credentials,'omit');assert.equal(calls[1][1].headers.apikey,key);assert.equal(calls[1][1].signal,c.signal);assert.equal(calls[1][1].headers.Authorization,undefined);
 const wrong={location:{origin:'https://production.invalid'}};vm.runInNewContext(source,{window:wrong});assert.equal(wrong.AUSTA_SUPABASE,undefined);
});
