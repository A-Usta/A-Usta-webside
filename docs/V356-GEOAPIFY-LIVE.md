# Manual Geoapify integration test

Only the new geoapify job in the existing registered `.github/workflows/v355-hosted-cas.yml` manual launcher receives the owner-provisioned repository secrets GEOAPIFY_BROWSER_KEY and GEOAPIFY_ALLOWED_ORIGINS. It has workflow_dispatch only, read-only repository permissions, fixed canonical repository/feature branch, exact reviewed SHA input and non-cancelling concurrency. Dependencies/Chromium install and offline review precede secret assignment. No PR-triggered workflow receives these secrets. Actions are pinned by commit SHA. No DB/hosting/cloud deployment token is used.

GEOAPIFY_ALLOWED_ORIGINS accepts a JSON array or a comma/whitespace-separated list of HTTPS origins (not URLs with repository paths); equivalent root trailing slashes normalize to the same origin, including `https://a-usta.github.io`. It may contain future reviewed origins; buying a-usta.az is not required. Secrets are never retrieved through the connector, printed, put on argv or uploaded. The existing build-map-runtime-config.cjs generates real configuration only in a private owned temporary directory. That directory is removed in finally. No forensic string-erasure claim is made.

The separately generated key-free preview contains only local map/Leaflet assets, a disconnected Supabase stub and no runtime-config.json. The uploaded directory is this public preview plus a fixed-shape sanitized result: status, counts, budget, fixed diagnostic stage/reason, attempt count, numeric HTTP statuses and known region names only. No raw response, URL, point names, runtime config, screenshot, HAR or trace is uploaded. This is a portable test artifact, not a deployed Pages site. It contains no real key and cannot itself prove live integration.

Protocol: fixed HTTPS Geoapify endpoints, TLS verification, redirects denied, timeouts and bounded body reader. First require actual HTTP401/403 for invalid both domain headers; accepting this unauthorized-domain request stops all further tests. Also probe missing headers and each mixed valid/invalid header independently. A200 for these additional probes is recorded as an unresolved restriction limitation, with PARTIAL result, nonzero exit and merge_ready=false. Regional evidence may still be collected under the approved source/budget, without falsely labelling the key wholly unrestricted. All four rejection probes must pass for protocol PASS. Unexpected HTTP statuses stop execution. A200 blocked only by CORS never proves access protection. No restriction is edited automatically. Then actual provider CORS must permit the approved origin. The fixture page uses the existing Pages base path but every repository asset is intercepted locally: production is never contacted or changed. A mobile real Leaflet dialog loads actual permitted Baku tiles/Places through a controlled provider-response relay. Six narrow regional Places queries cover Baku, Ganja, Shaki, Lankaran, Qarabagh/Agdam and Nakhchivan, requesting the four categories together, limit20 each. Real returned data is processed through unchanged application adapters/filter/directions logic. Empty categories are reported as empty, never replaced with synthetic live points.

The relay normalizes the existing equivalent all-category request (repair parent plus redundant repair.car child) to four parent categories, preserving limits and bounds. Provider responses and CORS are checked, not fabricated. Test transport uses approved Origin/Referer headers explicitly; this is a controlled integration probe, not a hosted website or proof that header restrictions prevent non-browser header spoofing. Whole-region basemap/visual QA remains NOT_CERTIFIED; the bounded protocol PASS never declares merge readiness.

Hard ceiling:30 provider attempts and60 conservative reserved credits, including negative tests and tiles, with serial1-second admission and no retries. Existing application guards and the separate fresh-usage/accounting test helpers remain byte-identical. This new explicitly owner-authorized bounded integration protocol does not read authoritative account statistics, certify total project usage, change billing/limits or replace earlier accounting gates. Only local attempt reservations are reported. Unexpected status, TLS/shape/CORS/egress/budget failure stops the protocol. Missing-header acceptance never becomes PASS or merge-ready; it is carried through the regional evidence as PARTIAL. This changes evidence collection, not application or provider access protections. Browser context cannot forward arbitrary hosts; Supabase is disconnected. Temporary configuration cleanup is filesystem-only, not hosted data cleanup.

## Execution/registration boundary

The GitHub connector has no dispatch API. The already registered v355-hosted-cas.yml entry can dispatch its feature-branch version without changing main. On feat/v356-live-automotive-map, original review/hosted CAS jobs fail their existing v355 branch condition and are skipped. Only the new geoapify job can run; it has no DB credentials/environment. The old CAS jobs and geoapify job are separately branch/SHA bound. Security tests check both sides of that boundary. The workflow input description is clarified; no existing CAS RPC/protocol/timeout/secret scope is relaxed.

Actions → the existing **V355 approved TEST CAS withdrawal** workflow (file v355-hosted-cas.yml) → Run workflow → select **feat/v356-live-automotive-map** → approved_sha exact reviewed HEAD. Confirm the run contains only the **geoapify** job, with CAS jobs skipped. Do not choose feat/v355-automotive-map for this test. Artifact v356-key-free-map-test has3-day retention. A successful result certifies only the bounded protocol fields, not all regional visual QA, A-USTA hosted data or release readiness. Browser/API dispatch still requires an available authenticated GitHub control path; missing dispatch capability is not another owner authorization request.

Official restriction guidance: https://myprojects.geoapify.com/help/api-keys/ . Allowed origins/referrers protect access; CORS alone does not. No live PASS may be inferred from the synthetic transport security test or owner-reported secret existence.

## Security decision — 18 November 2026

The headerless 200 is an unresolved release blocker, not a CORS success. The
provider's official API-key help says browser keys are visible and CORS only
controls browser response reading. Its React Native tutorial explicitly says
Origin/Referer restrictions do not protect native requests and recommends a
backend for stricter Places control:

- https://myprojects.geoapify.com/help/api-keys/
- https://www.geoapify.com/tutorial/maplibre-react-native-geoapify-map-tiles/

This explains the observed class of bypass. The exact account-side rule and
whether Geoapify can require headers still need provider confirmation. No
Geoapify account setting, billing setting or key has been changed here.

The current direct-browser integration must stay TEST-only. Do not publish the
real runtime configuration to Pages. A successful bounded API protocol is not a
production-security certificate; even HTTP rejection for all four probes would
not prove protection against forged headers from a non-browser client.

### Provider support request (sent 18 November 2026)

Sent through the connected Gmail account to the official support address
info@geoapify.com, without credentials. No provider reply has been received
or treated as approval.

Subject: Require rejection of headerless requests for restricted browser API key

We are validating an Azerbaijan automotive map in an isolated test environment.
For the same restricted key and /v2/places request, invalid Origin+Referer,
invalid Origin+approved Referer, and approved Origin+invalid Referer return 401.
With both headers omitted the response is 200. No API key is included here.

Can you confirm whether missing headers intentionally bypass these restrictions,
whether a setting can require and validate both headers, and whether allowed-IP
rules are enforced for headerless requests? Please clarify AND/OR semantics when
IP, Origin and Referer rules are combined, and availability of a hard daily
credit stop. We understand CORS is not authentication and headers are forgeable
outside browsers. If browser rules cannot prevent unauthorized credit use, we
will use a server-held key behind a metered proxy. Please confirm the supported
configuration before we publish.

### Server-only transition prerequisites

A proxy is required if the existing key cannot satisfy the release access-risk
gate. Adding a proxy while leaving that key valid in clients does not fix the
bypass. This repository has an existing production backend; attaching an
untested route to it or putting the browser key there would not constitute a
safe isolated test deployment. No proxy is registered with that backend here.

Before enabling an isolated proxy, provision a separate server-only key in a
TEST secret store and an isolated HTTPS test host with known egress IP. Configure
provider-side IP restrictions and confirm rejection from another IP, including
headerless and forged-header requests. Never ship this key in runtime config.

Implement fixed Places/geocoding/tile routes, without accepting upstream URLs,
keys or arbitrary query parameters. Validate narrow viewport and Azerbaijan
geometry (a bounding rectangle alone includes neighboring countries); filter
Places/geocode results to AZ. Bound tile coordinates/zoom to the admitted
viewport. Reject duplicate parameters, redirects, unexpected MIME/GeoJSON/PNG,
large streams and timeouts. Keep TLS verification enabled. Use shared atomic
per-client/global admission and persistent daily reservations that survive
restarts and multiple workers, plus bounded cache and in-flight coalescing.
An in-memory counter is insufficient for the daily release budget. Fail closed
when the budget store is unavailable. Redact URL query and raw provider errors
from logs. Test SSRF, header forgery, parallel budget exhaustion, restart,
coalescing, cache isolation and cancellation before connecting the frontend.

After isolated end-to-end verification, remove the browser runtime key from all
artifacts, replace client requests with the proxy contract, and revoke the old
browser key. Verify old-key denial independently. Roll back by disabling the
external layer while preserving the A-USTA provider list; never restore the
exposed browser key. Production activation remains outside this PR's authority.

### Extended QA coverage

The bounded manual runner now samples nine locations, adding Sumqayit, Quba and
Khinaliq to the previous six. The unchanged hard limits remain 30 requests and
60 conservative reserved credits, with one request per second. Reaching a cap
stops the protocol; it does not increase the budget or fabricate coverage.
These API samples are not full city totals or regional visual/geocoding proof.
The isolated Chromium layout suite now covers 1920, 1536, 1366, 900, 768 and 390px.
Its screenshots remain explicitly marked synthetic, even though Chromium is real.


## Blocker-resolution implementation — 18 November 2026

The support thread and incoming Geoapify mail were checked; there was no reply.
No duplicate inquiry was sent. The previous 18-request live run remains historical
API/Baku evidence; it is not new proxy or full regional visual evidence.

An inactive server-only implementation now exists under `tools/geoapify/proxy/`.
It includes a WSGI boundary, strict upstream construction and response rebuilding,
pinned multi-polygon/hole validation, persistent atomic quarter-credit admission,
rate limits, durable public-response caching and fenced cross-worker coalescing.
The real local SQLite ledger and independent processes are tested offline.
See its README for the exact single-host/shared-volume deployment constraint and
mandatory production/TEST host integration requirements. The frontend and
production backend remain unchanged. No authenticated TEST proxy endpoint,
server-only key, verified session integration or real pinned AZ border has been
configured. Therefore headerless abuse of the old browser key is still NOT
resolved, and full nine-region live visual QA is BLOCKED pending these inputs.

The offline proxy suite is included in frontend regression and the existing
PostgreSQL Security CI without any new secret reference or deployment step.
Synthetic provider/auth/geometry tests cannot clear the live release gate.


## Current frontend integration (18 November 2026)

The earlier inactive-core notes are superseded for source integration: the
existing map now supports same-origin `/map-api` runtime configuration without
a client Geoapify key. Places, geocoding and bounded blob tiles use the real
proxy contract. Signed, expiring, peer-bound guest sessions preserve public map
access without creating an A-USTA Auth user or requiring account login.

The bundled real geoBoundaries ADM0 dataset covers all nine selected points and
Nakhchivan; its license, pinned SHA and precision limitations are in
`tools/geoapify/proxy/BOUNDARY.md`. Public phone details and explicit tyre/alignment
tags are retained through safe DTO rebuilding. The original A-USTA public RPC,
search, filters, category options, pagination, routing and transport flows remain.

The guarded TEST host factory, hash-locked Gunicorn entry point and example
protected configuration are prepared, not deployed. Native Chromium integration
tests exercise the actual WSGI/SQLite/HMAC session path at desktop/mobile sizes
with synthetic provider payloads. All screenshots or results from that fixture
would be synthetic, not evidence of real map tiles/POIs. No new live provider
request, API-key rotation, paid resource, production change or deploy was made.

Render returned `no workspace selected`; its resource inventory cannot be read
until a workspace is selected. Only My Workspace was listed, but no selection
or service mutation was made. A separately configured TEST server key, verified
HTTPS ingress and already-available durable quota volume remain external gates.
A free ephemeral filesystem is not a durable ledger; no paid disk is activated.

Alfiya's older 15 November reply confirms dashboard-only usage reporting, no
guaranteed ten-second latency, zero-credit OPTIONS and one-credit geocoding.
Her 18 November security follow-up has no reply at this check. No duplicate
mail was sent. The old browser key must not be revoked until the live replacement
has been independently verified; therefore revocation remains intentionally
unperformed. Nine-region real-provider desktop/mobile screenshot QA remains
NOT CERTIFIED, and the PR stays Draft.
