# Cloudflare TEST execution — 18 November 2026

Status: implemented and API deployed; release remains Draft pending complete live QA.
TEST URL: https://austa-map-test.austahelper.workers.dev/
Worker: austa-map-test. SQLite namespace: 0d83909e0db94a478c33b7bdb7ac47fe.
Initial deployment: 924a46b2eded49fbb21bebe54dd41a9d.
Current hardened deployment: ea54f8054d6946a59f73a2b0db962a76.
Migration remains austa-map-test-v1; the namespace and usage are retained.

## Actual verified evidence

The connector verified GEOAPIFY_SERVER_KEY as secret_text without reading its
value. Existing Worker and subdomain were used; SQLite-backed DO binding was
created through the Worker upload API. No account plan, billing, production
Render/Supabase/Pages or domain setting was changed. No browser key was revoked.
Workers/SQLite DO are Free-compatible; subscription listing requires Billing Read
not exposed by this OAuth connection. No paid-plan activation was requested.

Real Cloud Browser opened the deployed frontend and loaded actual Geoapify Baku
tiles and Places through the same-origin proxy. At the observed 1363x936 viewport:
18 loaded real PNG tiles, 12 actual markers, no tile error. Returned named sample:
5 fuel and 7 wash markers; EV/repair were absent from this first combined page.
These are bounded viewport results, not city totals or evidence of absence.
Azpetrol popup showed its real source name/address and coordinates
40.3912458,49.9086713. Clicking directions opened Google Maps with those destination
coordinates. Google may label a nearby POI differently; source accuracy is not
certified by this test. No private Google account screenshot was saved.

Nakhchivan shortcut moved the map; the first search was canceled, then explicit
retry returned 2 named fuel markers, Cərci Petrol and Ana Petrol. No fake markers
were added. The cancellation is a live observation, not silently relabeled PASS.
Desktop Baku and popup JPEGs are key-free actual browser captures. Exact 1536px,
390px mobile and complete nine-region visual/interaction QA are still pending.

Terminal HTTP requests to the workers.dev endpoint returned 403 / error code 1010;
local Chromium navigation returned ERR_EMPTY_RESPONSE. The separate Cloud Browser
was able to load the real application. No UA/IP/TLS/security bypass was applied,
and no Cloudflare dashboard login was retried. This is a client-path limitation,
not evidence that deployment or the public site is universally unavailable.

## Offline security proof

Nine Node tests include actual Miniflare/workerd SQLite, concurrent admission,
global daily budget exhaustion across identities, cookie reset and issuance caps,
HMAC peer-binding, cache-hit authorization, coalescing, full runtime restart with
persistent usage/session/cache and strict endpoint/query/response checks. Boundary
checks cover all nine AZ samples and neighboring-country rejection. Provider
payloads in these tests are synthetic and are not live visual evidence.

Existing frontend, Python proxy and DB contracts are kept. The new CI workflow
runs only offline tests on PR events; bounded real QA is explicit workflow_dispatch
on the exact feature branch with no secrets or deployment. The live report labels
regional API samples separately from Baku visuals and never claims full regional
visual certification from API counts alone.

## Remaining gates

Complete exact-width real desktop/mobile captures, all nine regional live searches,
markers/filter/directions/error/empty state interactions and provider restrictions.
Do not increase caps, delete the namespace or change the object identity to force
PASS. Global admission remains 240 conservative credits/day, 120 per peer, with
rate/caching/session guards; actual project dashboard billing has not been read.
The older browser key remains usable until separately verified rotation/revocation.
Production GitHub Pages routing is not activated by this isolated TEST deployment.

Additional real observations: Gəncə, Azərbaycan address search returned the real city; selecting it and retrying Places returned 16 named markers (15 fuel, 1 wash). Some Ganja tiles were denied by the preserved 48-reservation browser cap, so this is PARTIAL visual coverage, not a complete tile PASS. Bare Gəncə originally returned similar Baku POI names; server geocoding now appends country context. A unit regression reproduced JSON waiting behind proxy tile fetches; queue and network deadlines were separated without removing cancellation, network deadlines or caps. Headerless live API navigation returned {"error":"ORIGIN"}. Browser Rendering screenshot API returned 422 Network connection closed / possible DNS failure; it did not yield a 1536px or mobile image. The source may not be certified as full live regional/responsive QA from these partial results.
