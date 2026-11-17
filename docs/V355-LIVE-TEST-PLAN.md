# Bounded Geoapify Azerbaijan live TEST plan — NOT EXECUTED

## Key / restrictions before any request

Browser fetch and Leaflet anonymous-CORS tile requests go directly to api.geoapify.com / maps.geoapify.com. No backend proxy. Both declare strict-origin-when-cross-origin: expected Referer https://a-usta.github.io/ (no repository path); expected Origin https://a-usta.github.io. Exact owner dashboard Referer expression and combination behavior must be checked before live execution. A Pages-path-required Referer pattern may fail. Proposed origin-only anchored regex for OWNER approval: `^https://a-usta\.github\.io/$`. Do not modify restrictions or switch to unsafe-url without approval. CORS response policy is not key authorization. Countrywide code makes no automatic key changes.

Use an owner-authorized secure test runner environment value GEOAPIFY_BROWSER_KEY or hidden local terminal entry. Never chat/source/PR/HAR/traces/screenshots. Runner injects AUSTA_MAP_SETTINGS before page scripts. Static Pages cannot directly read environment variables; no source or build secret injection has been activated. Browser-delivered keys are visible to users, so restrictions are essential. Truly private key storage needs a separately reviewed proxy. For localhost use a separate exact-origin development key; do not weaken the Pages key to '*'. An isolated Pages-origin browser harness must block ALL production traffic before any session or mutation. No deployment just to test.

## Budget and automatic stop

Authorized ceiling: 30 EXTERNAL HTTP attempts TOTAL (includes every tile, redirect/retry, failed attempt), 60 Geoapify credits, stop before crossing either. One tab/user, no auto retries, no bulk pagination/crawling. Unknown endpoint/cost, stale or unavailable provider usage, 401/403/429, usage reset, unexpected redirect or key restriction failure => stop and report. Do not disable key restrictions to continue.

Prepared test-only module: tests/helpers/geoapify-live-guard.cjs. No network/credentials in it. Wire permit(url) before dispatch of EVERY api/maps Geoapify route, one global serial chain >=1second apart. Disable service workers and prefetch; block unhandled Geoapify hosts and endpoints, no API browser cache bypass loops. Do not log URL query/key. Reserve before request, never refund failures: Places(limit<=20, bounded rect, offsets0/20/40) conservative3credits, geocode1, tile0.25. These reservations deliberately exceed the documented small Places price. max(reserved, provider usage delta)+nextCost must stay <=60 and attempts<=30. Guard unit tests are mocks of the ledger, NOT live API evidence.

readUsage must be a supported authorized provider-usage reader returning {credits,observedAt} with <=10s fresh observation. No supported reader/credentials are available here; its absence makes the guard fail closed. Do not fabricate usage or silently substitute zero. Owner's present zero is baseline information, not a continually fresh reading. If no supported fresh usage route exists, live execution remains BLOCKED until an approved alternative is reviewed. Capture final provider-reported usage as well as reservation ledger; dashboard lag must not be represented as zero consumption. Separate keys in A-USTA project share the same quota; no concurrent users during measured run.

## One proposed batch (conditional on all guards)

- Seven geocodes (7requests): Baku urban, Nakhchivan, Quba, Lankaran, Shaki, Agdam, Khinalig rural. Source failure/ambiguous result recorded, never guessed business coordinates. National sample names are TEST cases, not app allowlist.
- Six category Places queries (6requests): use selected <=0.5degree rectangles across those areas; EV, fuel, wash, repair, tyres and alignment (last two inspect explicit raw tags). Each limit20. Reuse repair evidence rather than duplicate needless requests. One batch does not validate every category in every district; report untested combinations.
- Up to two name/pagination/fallback requests where earlier sample empty (2requests), preserving original bounded query.
- At most12 tile attempts for one fixed viewport; no repeated pan loops. If map incomplete at cap, report partial tiles. Optionally one approved negative-origin denial request, total<=28. No automatic retry budget expansion. Credit reservation for this batch remains below60; actual observed usage is separately required.

Record sanitized endpoint/path, category/bounds or geocode term, HTTP status, raw count/country evidence/tag evidence, selected name+coordinates/place_id, provider usage delta and screenshot. Distinguish PASS(app behavior), DATA GAP(empty/missing raw tag), FAIL(contract/runtime) and BLOCKED(no permission/key/usage). No invented opening hours, ratings, air-filling/balancing capabilities. Real data must come from actual responses, not fixture screenshots.

Official references: https://myprojects.geoapify.com/help/api-keys/ ; https://www.geoapify.com/pricing-details/ ; https://apidocs.geoapify.com/docs/places/ ; https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/ ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy . No paid service activated.
