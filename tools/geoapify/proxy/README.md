# Server-only Geoapify core — inactive, offline verified

The production backend does not import this package. The frontend has an optional
secret-free same-origin proxy mode, and a guarded TEST host factory is prepared. It opens no
listener, loads no environment credential, starts no deployment, changes no
Supabase database and has no public token-issuing endpoint. Do not label it a
live or production-certified integration.

## Security contract

`Proxy.handle(Principal, route, query_pairs)` is a server-side library boundary.
The WSGI adapter rejects foreign Origin and requests lacking both approved
Origin and same-origin Referer metadata. Native same-origin GET fetch normally
omits Origin, so that legitimate case is accepted only with approved Referer
and a verified principal; cross-site fetch metadata is rejected. Origin and
Referer are never authentication. An injected host `authenticate(environ)` must
verify an actual server-side session and return a stable pseudonymous principal
with at most 15 minutes remaining validity. Never construct it from an unsigned
header, caller-supplied ID, IP address, JWT claims without signature validation,
or an unmetered anonymous public token issuer. Existing guest access must be
preserved by a reviewed, bounded edge/session admission flow; do not silently
replace it with mandatory account login. That host integration is not supplied
by this inactive core. Browser requests cannot supply a server
API key, upstream URL, endpoint, category expression, limit or arbitrary filter.

The credential is provided directly to the server core from a secret manager.
The response contract contains only sanitized public GeoJSON or validated PNG;
raw provider errors, datasource objects and secret-bearing responses are denied.
No credential is emitted by this package. No raw query, location search text,
principal, token, URL or upstream exception is logged. The deployment host must
also disable query/access-body/trace logging; this library cannot configure the
host's access logger or reverse proxy.

Only `/places`, `/geocode` and `/tile` are admitted. They map to fixed Geoapify
HTTPS hosts and paths. Places requires one of the four approved categories or
`all`, a narrow <=0.5-degree viewport, at most three limit-20 pages and an
optional bounded name. Geocode forces countrycode:az and limit 5. Tile zoom is
12–18, coordinates must intersect the admitted viewport. TLS certificate and
hostname verification are enabled; redirects, environment HTTP proxies, >2 MB
bodies, unexpected MIME/shapes and provider echoes of the key are rejected.
HTTP client debug logging is explicitly disabled and TLS key logging through
SSLKEYLOGFILE is rejected before creating the TLS context.
The transport uses eight-second socket timeouts and deadline checks between
connection/request/header phases and during streaming. A host-level hard request
deadline and bounded DNS resolver are also required: Python socket timeouts alone
do not bound every system resolver implementation.

## Geography prerequisite

`Boundary` requires a SHA-256-pinned GeoJSON Polygon/MultiPolygon supplied by a
trusted operator. It validates rings and uses both exterior and hole geometry;
Nakhchivan must be a separate polygon. Viewport centers must be inside that
boundary, within a bounded Azerbaijan envelope. Border-crossing viewports may
extend outside the polygon: returned Places points must pass BOTH countrycode
and polygon/viewport checks; geocode results must pass countrycode and polygon.
This is deliberately not a claim that a rectangle is Azerbaijan's boundary.

**A real cartographic AZ boundary is now bundled and pinned; it is not an
authoritative legal/survey boundary.** The original core unit tests use an
explicit synthetic two-part polygon with a hole; integration tests additionally
check the real dataset and all nine selected locations. Before
live activation, review the provenance/license, accuracy and SHA of an actual
AZ boundary, including Nakhchivan, Qarabagh, border villages and coastline. A bad
operator-supplied polygon cannot be corrected by hash pinning alone.

## Durable atomic admission

`Store` uses a private SQLite file with WAL, FULL synchronous mode and BEGIN
IMMEDIATE. All processes on ONE host must share this same durable local volume.
Independent-worker tests prove concurrent admission cannot overspend. This is
not a distributed multi-host quota implementation: never start a replica with
its own store. Multi-host deployment requires a shared transactional admission
service before it can pass release review.

Initialization is explicit and exclusive, in a pre-existing owner-only 0700
directory; files are owner-only 0600. Request processing opens mode=rw, refuses
missing/symlink/permissive files and never recreates a lost ledger. Policy is
persisted and worker configuration mismatch fails closed. Atomic daily global
and per-principal reservations survive process restart. Defaults are **60 global
credits/day, 30 per principal/day**, **60 global requests/minute, 20 per principal**.
Units are quarter-credits; Places reserves 3 credits, geocode 1, tile .25. These
are conservative reservations, not provider account usage. Failed upstream
attempts remain charged. Client identities cannot bypass the global cap.

All authorized requests, including cache hits and coalesced waiters, consume
request-rate admission. Public Places and tiles use a bounded 64-entry cache
(60/300 seconds), hashed canonical identities and durable cross-worker leases.
Stale lease owners cannot overwrite newer cache results. GeoJSON is rebuilt
before caching. Geocode responses are never cached or coalesced; each attempt
gets its own admission identity so precise address queries/results are not
persisted in the cache. Cache is public-POI only, never an authorization cache.
Every cache hit still requires a current verified principal. The host must
protect the ledger and backups; exhausting/corrupting the volume stops traffic.

## Host integration checklist — still blocked

Before an isolated live test, provide:

1. A separate TEST server key, stored only on the TEST server, restricted by
   provider-side known egress IP and independently tested for denial elsewhere.
2. Review the bundled real AZ cartographic boundary and pinned digest for the
   intended deployment; provenance and limitations are in BOUNDARY.md.
3. An isolated HTTPS TEST host with one durable admission volume and no other
   unmetered use of that key. Deployment is not performed by this package.
4. A verified session/authenticator integration and strict request/header/time
   limits, TLS termination, disabled sensitive logging, process supervision,
   storage capacity monitoring and backup/restore policy preserving usage.
5. Activate and live-verify the implemented same-origin frontend proxy/session
   flow on that TEST host. Historical direct-browser mode remains TEST-only. No
   server secret belongs in runtime configuration or a Pages artifact.
6. End-to-end provider schema/tile compatibility, denied unauthenticated and
   forged-header calls, rate/daily-cap tests, and real nine-region desktop/mobile
   QA with screenshots that contain no request URLs, keys or personal data.

Only after these pass can the direct-browser credential be retired. Rotate and
revoke the old browser key and independently verify its denial. Do not restore
it during rollback: disable external data while retaining safe A-USTA results.
No rotation or account setting change has been performed here.

Run the offline suite from the repository root:
`python3 -B -m unittest discover -s tests/geoapify -v`
It is also included in frontend full regression through
`tests/geoapify-proxy.test.cjs`. All network/provider/auth inputs in this suite
are synthetic; SQLite and concurrent processes are real.

The frontend regression also runs a real Chromium, zero-provider-egress browser
contract test against a synthetic WSGI bridge. It exercises native Origin-less
same-origin GET, a synthetic HttpOnly session cookie (not readable in JavaScript),
401 without that session and 403 without Origin/Referer metadata. It is not a
live provider, national geometry, full UI or deployed authenticator proof.

## Integrated TEST path

The same-origin frontend now supports the public runtime contract
`{proxyPath:"/map-api",allowedOrigins:[approvedOrigin]}` with no browser key.
Places, geocode and bounded blob-backed tiles use the proxy and its signed guest
session. There is no direct-provider fallback in proxy mode. Existing browser-key
mode remains for historical TEST compatibility until replacement is live and
the old key can safely be retired.

The real pinned geoBoundaries AZ ADM0 dataset is bundled, with Nakhchivan and
all nine QA sample points verified; see BOUNDARY.md. The inactive TEST WSGI
host factory, guest issuer, zero-cost infrastructure constraints and activation
prerequisites are documented in TEST-HOST.md. No host is deployed by this code.
