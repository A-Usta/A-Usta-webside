# V3.5.5 direct map integration — same PR293

Baseline: feat/v355-automotive-map /67fa102df4c80785caa423779018b19f12176406 /tree061dfd93e45f0284676fe70b45adc839eb663cca. Remote Draft/unmerged and local clean state verified before editing. No standalone test page added,linked or published. No competing map or PR.

## Architecture audit and targeted corrections

| Existing path | Finding | Correction |
|---|---|---|
| config.js → window.AUSTA_MAP_SETTINGS | Re-evaluation replaced the settings object; arbitrary settings were spread | One frozen configuration,explicit browser-key field,invalid/Supabase secret/publishable key rejection;empty default |
| data.js → window.AUSTA_MAP_DATA | No duplicate-load guard;repeat script could create a second queue/cache behind the existing map closure | Preserve the same adapter API identity on repeat load |
| request() completed cache | Parallel identical calls before completion each attempted an external request | One in-flight operation per canonical Geoapify query;per-subscriber cancellation;completed60s/max30cache retained |
| internal public discovery RPC | Simultaneous identical queries could call twice | Share only the in-flight RPC for the same arguments/client;no completed authorization-result cache |
| auth/close/query cancellation | Existing epochs removed stale UI but lacked shared consumer lifecycle | Last-subscriber cancellation aborts parent;clear() aborts all pending work;epoch/client checks retained |
| publication.js global export | Re-execution replaced API identity | Singleton guard;existing owner form/write/consent logic unchanged |
| network failure path | Redirect behavior/default cache not explicit;RPC thrown exceptions could escape | redirect:error,cache:no-store,credentials:omit;fixed sanitized errors,not raw URLs/server text |
| map.js / Leaflet / entry / markers | Existing singleton,epoch/list synchronization and dedup groups already present | Retained unchanged;no extra initialization/listeners/DOM/card |

New subscribers reuse active requests only. One aborted consumer cannot cancel another active consumer. If all abort,the pending entry is removed and parent is aborted. Old completions cannot overwrite current-epoch cache. Provider RPC results are never cached between completed searches,so new searches reevaluate consent/eligibility under server RLS. Auth session changes still clear the dialog and request epoch.

## Browser-compatible authentication — deliberate existing contract

Geoapify's documented browser GET query-key method is retained for JSON and visible image tiles. This avoids introducing an unverified header-only CORS flow or a second proxy/controller. The standalone page's header-only variant is NOT incorporated into the application. That page will not be published.

A real key is **not in Git**. config.js contains only an empty default. An approved isolated test runner may preload `window.AUSTA_MAP_SETTINGS={geoapifyBrowserKey:<protected runtime value>}` before the existing config.js executes. No second configuration script/controller needs to be mounted in the application. For a future separately approved Pages release,a restricted **browser** key may be injected into the existing config asset in the deployment artifact,without committing it. This is not performed now.

A browser key is necessarily visible to that browser in client code/network requests;it is not a server secret. Query auth places it in the intended Geoapify request URL. Do not record full request URLs,HAR,traces,console diagnostics,init-script arguments or screenshots containing a key. App errors and the test guard ledger do not expose the URL/key. Domain/Referer restrictions must remain. Never use a service-role/server/unrestricted credential. If the owner requires a key that is secret from the browser itself,a separately reviewed backend proxy would be needed;none is introduced or claimed here.

Official primary references:
- https://github.com/geoapify/geoapify-openapi-specs#authentication — browser query authentication and header alternative.
- https://apidocs.geoapify.com/docs/geocoding/ — forward geocoding browser API.
- https://apidocs.geoapify.com/docs/places/ — bounded Places API.

Observed/documented transport policy remains:

```text
Origin: https://a-usta.github.io
Referer: https://a-usta.github.io/
Owner restriction: ^https://a-usta\.github\.io/$
```

The exact provider-side rule/current key validity/live CORS acceptance have NOT been certified. No restriction weakened. Real key,authenticated provider usage reader and validated rule access remain unavailable in this environment. Live Geoapify requests0;provider credits NOT MEASURED.

## Nationwide map and privacy preserved

Azerbaijan country overview,Nakhchivan,free-text city/district/settlement/village/business geocoding,bounded map-area search and nationwide provider-name paging remain unchanged. No hardcoded small city allowlist or unbounded nationwide Places call. Fuel,charging,wash,repair categories retain genuine source IDs;tyre/alignment require explicit source tags. Missing source records are not proof that a region has no businesses.

Same canonical public provider RPC/explicit-consent contract,RLS,active/verified identity and public DTO retained. No profiles/raw provider GPS lookup,no invented mobile pin/no approximate-area directions. Existing list/marker synchronization,Google Maps handoff and conservative source grouping retained. Original homepage service cards/images,Account/Auth,service orders,listings,video,header/footer/backend and SQL are unchanged in this increment.

## Strict controlled live validation plan — not executed

### First probe,existing owner allowance only

1. Verify exact current candidate,TEST-only browser isolation,approved Origin/Referer rules and securely injected browser key. Keep recording/tracing/network URL logging disabled. No production data.
2. Provide an approved actual provider usage reader with cumulative credits+timestamp,fresh<=10seconds. A stale initial0usage screenshot or local estimate is insufficient. Confirm current endpoint cost upper bounds. Missing prerequisites fail closed.
3. Use existing tests/helpers/geoapify-live-guard.cjs with `maxRequests:2,maxCredits:2`. New optional limits can only tighten the existing30request/60credit ceiling;invalid/higher limits reject. No loosened security gate.
4. Open only the existing application/map module in the isolated runner. Basemap stays unloaded. Call the existing AUSTA_MAP_DATA.geocode once through the application's area-search action or the runner;no temporary public page. Route all outbound Geoapify requests through the guard;abort any unexpected endpoint,tile,retry or redirect.
5. At most one explicit Geocoding GET;reserve/account for an OPTIONS if the browser actually emits one. Current query-key request has no custom authentication header and normally needs no header preflight,but do not ignore an observed OPTIONS in the HTTP ledger. No second business operation uses the unused slot. No auto-retry/manual repeated click. Stop on success or failure.
6. Record only host/path,method,status,actual count,fresh account credit delta and sanitized success/coverage metadata. Never the URL/query key/header/session. No uncontrolled Google Maps browser session;directions URL may be asserted/intercepted without loading third-party maps.

The transport guard does not itself run a browser or read account metrics. The test runner must count real network events,including preflight/tiles,and refuse a dispatch that cannot fit. Browser caching/transport may differ;fail closed on accounting uncertainty. No existing missing-secret/usage condition is bypassed.

### Later coverage batch — prepare only,separate execution approval

Keep total<=30externalHTTPrequests and<=60actual/reservedcredits,stop at earlier limit,serialize<=1logicalrequest/second and count any OPTIONS. Sample Bakı,Sumqayıt,Gəncə,Quba,Şəki,Qəbələ,Mingəçevir,Lənkəran,Naxçıvan with9bounded geocoding+9representative Places calls;optional visible tiles only from remaining budget. Cover all6external category families by distributing categories across areas,not exhaustive cross-product. If preflights consume the remaining slots,skip optional tiles/remaining samples. Check fresh account usage before each permit and verify actual credit accounting after completion;concurrent account consumption can stop the batch earlier. Local conservative cost estimates are not provider measurements. Free plan only,no upgrade.

This plan is NOT authorization to spend the broader budget now. Only the previously approved first2HTTPslots are current permission;even those remain unexecuted without safe prerequisites.

## Regression / release decision

Focused connection tests cover request coalescing,independent/all cancellation,singleton config/adapters,secret-type rejection,cache freshness and sanitized errors. Existing browser tests add repeat-load and simultaneous-search assertions without removing earlier assertions. Historical exact fingerprints updated only for the three reviewed map files. Backend/DB/full frontend/original Chromium results and exact changed-source hashes are in owner package. Isolated synthetic tests are not live Geoapify/RLS HTTP proof.

**Production NO-GO.** Remaining:secure key/restriction/usage access and actual source coverage;previous TEST two-user Auth/Storage isolation and security-advisor gates;separate release/privacy compatibility review. Existing downloaded/cached public copies cannot be retroactively revoked. service_orders.vehicle_id issue remains separate,unchanged.

No new migrations,remote SQL,production configuration,paid services,merge or deployment. Keep PR293 Draft. Rollback only this increment's map/test source to reviewed67fa102 while preserving the existing provider privacy candidate and TEST gates;never restore public raw GPS permissions.
