# V3.5.5 Azerbaijan-wide discovery — review only

Baseline: PR #293, aad331a7d4ebf763cd29ce5053493ba00c8ece48. No new PR, production access, migration execution, paid activation or deployment.

## Implemented

- Countrywide initial view includes mainland Azerbaijan and Nakhchivan. Its rectangle is a viewport/rough discovery extent, NOT a legal boundary polygon. No places/RPC prefetch when opened. Missing tiles do not create fictitious points.
- Free-text Azerbaijan geocoding, without a hardcoded city list or the former locality-only type restriction. City, district, settlement, village and business-name locations can be selected where supported by actual source data. Country code must be az; foreign/missing-country results fail closed. A geocoder zero result is incomplete source coverage, not proof a location/business does not exist.
- Search visible area only after zoom/selection. Each Places query <=0.5 degrees per axis; 20 results/page, explicit More up to three pages (60 raw external results). No nationwide Places request or countrywide grid crawl. Foreign points filtered by returned country code; no unsupported combined country filter assumed.
- Business-name location lookup geocodes the entered business name, then the user selects its location and runs bounded name/category search. This is not an exhaustive national external business directory.
- Explicit countrywide A-USTA provider NAME search (>=2 characters) ignores initial Baku bounds; narrow SQL DTO, category before limit, stable listing-ID ordering, 40/page and at most three pages. Mobile public service areas remain list-only, no precise pins. Rough business-coordinate extent covers Nakhchivan; it cannot prove legal jurisdiction near borders, so no such claim is made. Owner-entered public area/consent remain canonical.
- Pan/zoom, changed input/category, manual location, geolocation and auth changes clear stale results/area selection and abort stale requests. Selecting a geocoded location sets its current service area after repositioning. Markers/list are rebuilt from the same deduplicated result groups. Provider consent and eligibility remain mandatory.
- Existing homepage's first three service card images, handlers, listing, Account/Auth, service orders, header, footer and video core are not edited.

## Validation / limitations

Local adapter/browser/DB fixtures cover Nakhchivan, Quba, Lankaran, Shaki, Agdam and a rural sample; geocoder name tests include Ordubad district and Khinalig village. These are synthetic application/SQL tests, NOT real returned businesses or live coverage claims. Browser tests cover six widths, original service entry delegation, sources, marker/detail, pagination bounds, denied permission and auth switch. Exact final counts/logs belong to owner package/CI.

Read-only TEST metadata confirms PostgreSQL17.11 and required existing tables. New publication table/RPC absent. No production project inspected in this continuation. Updated migration remains unexecuted. See exact TEST authorization document.

External live tests remain BLOCKED: no securely supplied key or exact restriction expression verified. No real data results invented. Tyre/air and alignment/balancing completeness remains UNVERIFIED: exact raw tags prove only the specific advertised service, not air filling or balancing automatically. Generic repair never implies either specialty. Provider inline media projection remains deferred for safe authorization review.

Free-plan tile burst/global quota issue from connection audit remains a release gate: the application still lacks a shared global tile+JSON scheduler. A separate prepared test guard limits all test dispatches and conservative credits, but is NOT a production traffic limiter. No paid upgrade or zero-cost unlimited-access claim.

**Production NO-GO. Keep Draft until real-data, budget/restriction and TEST HTTP/RLS checks pass.**
