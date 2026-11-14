# V3.5.5 — external map provider assessment

Reviewed 14 November 2026. Selected adapter: Geoapify raster tiles + Places + Geocoding, displayed with pinned local Leaflet 1.9.4 (BSD-2-Clause). No provider account, billing, paid plan or production configuration was created/activated. No demo or third-party API key was borrowed. This workspace has no authorized Geoapify browser key: **live discovery/tiles are BLOCKED**, not PASS.

Official references:
- https://www.geoapify.com/pricing/
- https://www.geoapify.com/pricing-details/
- https://www.geoapify.com/terms-and-conditions/
- https://myprojects.geoapify.com/help/api-keys/
- https://apidocs.geoapify.com/docs/places/
- https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/
- https://www.geoapify.com/places-api/

## Fit and limits

Geoapify supports commercially usable maps, named POIs and locality/business-name queries with bounded spatial filters. Official pricing advertises a free plan with 3,000 credits/day, up to 5 requests/sec and required attribution; API 10 is listed at USD 59/month for 10,000 credits/day. Taxes, actual account terms and future prices must be checked before activation. Terms reserve suspension/overage rights; do not assume an unlimited or guaranteed zero-cost production service. Owner must approve provider terms, restrictions and operational spending controls before activation. No paid service is authorized by this PR.

Attribution links for Geoapify and OpenStreetMap are rendered; Leaflet attribution remains. Provider documentation permits caching Places data. This implementation uses only a bounded 30-entry, 60-second memory cache for external data and clears it on close/auth changes. Internal public-provider data is fetched fresh, never persisted to localStorage. No bulk POI import, tile prefetch, public OSM tile or Overpass fallback.

Request model: explicit Search/Find Area only; map pan/zoom never automatically issues a Places/RPC search. Maximum 20 external results per page, three explicit pages (60 raw rows); internal 40 rows/page, three pages for explicit national name search. No automatic pagination. Bounding extent <=0.5 degrees each axis. Local external-query budget 20 requests/minute; eight-second fetch timeout and AbortController. Tile requests update when idle; stop after 128 tile starts per map opening. These client controls are usability/cost bounds, not global anti-abuse or billing guarantees. Provider account-level protection/quotas are a release gate.

Example estimates, not a traffic forecast: 50 tiles/session ×0.25 credits + one <=40-result search (up to ~2 credits) + one simple geocode (~1) ≈15.5 credits/session; 100 sessions/day ≈1,550 credits/day, 300 ≈4,650. Credit costs depend on returned results/usage; unused daily quotas do not make unlimited monthly capacity. Use owner-approved budget and monitoring before release. No plan was purchased.

## Category coverage

| UI | External contract | Coverage caveat |
| --- | --- | --- |
| Elektrik doldurma | service.vehicle.charging_station | Source coverage varies; no live charging availability claimed |
| Yanacaqdoldurma | service.vehicle.fuel | No fuel prices invented |
| Moyka | service.vehicle.car_wash | No opening hours/ratings invented |
| Avtoservislər | service.vehicle.repair.car | Generic repair, no inferred specialist capability |
| Təkər | repair query plus explicit raw service:vehicle:tyres=yes evidence | No dedicated category; may return zero even when nearby shops exist |
| Razval / Balans | repair query plus explicit raw service:vehicle:alignment=yes evidence | Tag availability unverified; NOT comprehensive alignment/balancing coverage |

The last two categories fail closed. A business name containing a keyword does not prove its services. Coverage must be tested with real authorized API responses before production; a curated/contracted provider dataset may be required. No external point is labeled A-USTA-verified.

## Activation checklist

1. Owner creates/authorizes an appropriate Geoapify project and accepts its terms separately.
2. Provide an approved browser/public key; restrict it to authorized website referrers/origins and account limits. A CORS header alone is not key access protection.
3. Review quota enforcement/overage terms; no auto-upgrade/paid activation without authorization. Do not place secret/service-role keys in browser settings.
4. Populate existing `AUSTA_MAP_SETTINGS.geoapifyBrowserKey` through a separately approved configuration change; default remains empty.
5. Re-run real discovery, geocode, tile, outage and category coverage tests, especially tire/alignment evidence. Verify attribution and no production mutations.
6. Obtain owner visual/release approval. This PR is Draft and **NO-GO for production** while these gates remain.
