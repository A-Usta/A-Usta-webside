# A-USTA Cloudflare TEST map

This adapter ports the existing Python contracts into Workers JavaScript and
SQLite-backed Durable Objects. It never imports the production backend or
changes Supabase. Only https://austa-map-test.austahelper.workers.dev is accepted.
The real source map frontend and API are served together. This labelled isolated
preview disconnects Supabase and therefore does not certify live A-USTA provider
rows; the source frontend's existing publication/RPC paths remain unchanged.

## Security and persistence

The provider key is read only from env.GEOAPIFY_SERVER_KEY, a Worker secret.
No client key, HAR, trace, provider URL or sensitive request log is produced.
Uploads retain existing secret_text bindings and never read their values.
No browser credential, Cloudflare token or production secret is required in CI.

MapAdmission is one bounded coordination atom for the TEST project's global
credit budget (60 requests/minute), not a claim to unbounded multi-tenant scale.
All requests use the fixed austa-map-test-v1 object name. SQLite transactionSync
atomically reserves conservative credits before fetch: Places=12, geocode=4,
tile=1; global daily cap=240, per-peer principal=120; total network=60/minute,
JSON=20/minute, session issuance=20 global and 2/peer/minute. UTC daily rollover
never refunds failed requests. New cookies retain the HMAC-derived peer identity.
This is an anonymous guest abuse budget, not an authenticated account quota.
Cloudflare's CF-Connecting-IP is trusted only at its own Workers ingress; arbitrary
X-Forwarded-For is ignored. Cross-zone Worker subrequests share Cloudflare's
special peer address; a same-account malicious Worker/operator is outside this
public-client threat model. Global budget remains independent of peer churn.

An expiring HMAC guest cookie is Secure/HttpOnly/SameSite=Strict, peer bound,
and verified in the object. Origin/Referer and Sec-Fetch-Site are additional
checks, never the credential. Headerless API requests fail, native same-origin
GET without Origin requires acceptable Referer and valid session. No account
JWT is sent to the proxy. No new Auth users are created.

The existing SHA-pinned AZ geometry including Nakhchivan is bundled at build.
Both AZ country code and polygon membership filter responses. Four fixed Places
categories, <=0.5 degree viewport, bounded pagination/tiles and exact query keys
are enforced. No arbitrary upstream host, redirect, query key or endpoint is
accepted. TLS verification uses the platform default and cannot be disabled.
Response stream limit is 2MB with a 9.5-second abort, strict GeoJSON DTO rebuilding
and PNG CRC/chunk validation. Unknown metadata and unsafe text are discarded.

Cache hits require authorization and rate admission. SQLite-backed leases
coalesce requests across workers and fence stale completions; cache is bounded
at 32 entries. Geocoding is not cached. The object stores no raw peer IP, search
text, session token or provider key; its independent signing secret stays private.
Do not change the object name, replace its namespace, delete storage or reapply a
new-class migration to reset usage. A code rollback must retain the namespace,
policy and ledger. A policy mismatch fails closed; no automatic quota reset.

## Local verification and build

Run npm ci --ignore-scripts and npm test in this directory. Miniflare/workerd is
pinned in package-lock.json and uses actual SQLite storage. Test outbound provider
payloads are synthetic and not live QA evidence. Tests cover independent requests,
concurrent global budget exhaustion across identities, per-principal cap exhaustion, persistence after runtime
restart, signed/peer-bound cookies, coalescing and cache-hit admission, session
issuance caps, endpoint/query/bounds/response denial and real AZ geometry.

python -B tools/geoapify/cloudflare/build.py OUTSIDE_NEW_DIRECTORY builds only
key-free modules. No runtime-config or secret is read. Generated assets/boundary
modules are build outputs, not a duplicate committed source tree.

The GitHub workflow runs only offline tests for PR events. Live QA requires an
explicit workflow_dispatch on the exact feature branch and a fixed TEST URL;
it has no secrets, migrations, cleanup or deployment step. Its report distinguishes
regional API samples from actual Baku visual interactions and does not certify
full nine-region visual QA. Budget/rate errors remain failures/partial evidence;
limits must not be raised or object identities changed to force a pass.

## Deployment receipt and live gates

API upload accepted 18 November 2026 for existing Worker austa-map-test.
Current deployment ID: ea54f8054d6946a59f73a2b0db962a76 (initial: 924a46b2eded49fbb21bebe54dd41a9d).
Migration tag: austa-map-test-v1. Namespace: 0d83909e0db94a478c33b7bdb7ac47fe.
API verified use_sqlite=true, secret_text binding retained, workers.dev enabled.
No paid plan, billing, domain, production resource or browser-key rotation was
requested or activated. SQLite DOs are Free-compatible; account subscription
listing is unavailable to this OAuth scope and account billing was not changed.
Official limits/pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/

Current live evidence is recorded separately in docs/V356-CLOUDFLARE-TEST.md.
A successful upload is not a certificate of provider restrictions, live coverage,
mobile visuals or production GitHub Pages routing. Keep PR Draft until the
remaining release gates have actual evidence. The older browser key is not revoked.

Country context is appended to bare geocoding text (unless already present), after a real Gəncə query returned Baku POIs but Gəncə, Azərbaycan resolved correctly. This changes query disambiguation, not stored coordinates or source data. JSON network deadlines remain 8 seconds after actual dispatch; a separate 20-second queue deadline prevents premature tile-queue cancellation and late queued requests. The 48-tile browser reservation cap is retained. Dev-tool overrides pin patched undici 7.30.1 and sharp 0.35.5; npm audit reports zero vulnerabilities.

Session bootstrap accepts only a bounded empty body with a two-second read deadline; it never buffers an unbounded request. Public /health exposes only aggregate reservations and cache count, not identities or credentials. Existing schema/policy mismatch fails closed.

Before the workflow exists on main, GitHub hides its workflow_dispatch UI. The only pre-merge alternative is an explicit owner-added austa-map-live-qa label event on PR #296, the same repository and exact feature branch. Synchronize/open events do not invoke live requests. The owner login, action, label, PR number, head repository and branch are checked, and checkout pins the event head SHA. No secrets are passed to either PR or dispatch jobs. This is a bounded manual TEST action, not an automatic hosted test on pushes. Partial live coverage fails its release gate and is saved honestly in the artifact.
