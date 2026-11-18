# GitHub Pages gateway release contract

Status: integration code implemented; production gateway is NOT deployed.
GitHub Pages cannot execute /map-api. SameSite=Strict guest cookies are deliberately
not relaxed to cross-site cookies. The map's public runtime config instead names
an exact approved HTTPS proxyOrigin and proxyPath=/map-api. Cross-origin clients
use credentials=omit and a short-lived, peer-bound guest HMAC token held only in
module memory. No token, provider credential or private account JWT enters URLs,
localStorage, sessionStorage, public config or the repository. Public guest
admission is not account authentication or a guarantee against denial of service.

The gateway accepts the exact Pages origin https://a-usta.github.io only when
AUSTA_MAP_PAGES_ORIGIN equals that value. No wildcard origin, CORS credentials,
arbitrary upstream, arbitrary proxy host, redirect or user-provided Origin is
trusted. GitHub Pages origins are account-wide: another repository under that
same origin is the same security principal; path scoping is not an origin boundary.
Headerless/foreign-origin API calls and missing/forged/cross-peer tokens are denied.
CORS is only the browser policy; signed guest admission and persistent atomic
budgets remain the actual server controls. Public guest tokens can be obtained by
public visitors; daily/global budgets, not origin secrecy, bound provider costs.

## Configuration prepared, no production mutation

The existing Worker https://austa-map-test.austahelper.workers.dev is the explicit
source-published Pages gateway default. When /A-Usta-webside/ on the exact Pages
origin has no runtime-config.json (HTTP404 only), config.js selects that HTTPS
endpoint without a browser key. Other origins/repos, malformed configs and other
HTTP failures do not activate this fallback. Thus a source-based Pages publish
of the approved PR does not require an untracked generated runtime file merely
to connect the external map. No production Pages publish occurred in this task.

This deliberately shares the existing Worker ledger: global240/per-peer120
conservative units/day and all rates remain unchanged. A main-site request can
be rejected when TEST/review usage exhausts that same budget. It is not unlimited
production capacity. Do not clone/reset a namespace to bypass this shared budget.
No additional gateway resource, key, plan or domain was created or required.

The explicit runtime artifact producer remains available for a later authorized
endpoint change (see assets/map/runtime-config.example.json). The separately
reserved austa-map-api.austahelper.workers.dev is OPTIONAL future isolation, not
a claimed existing deployment or a new prerequisite. Its deployment would require
owner authorization and a deliberate provider-wide credential/budget policy.

READ-ONLY production schema check (project yafpnqcoyvoclmxdlxxc) found both
public.discover_public_providers(...) and public.provider_map_publications absent.
Therefore production A-USTA provider markers are BLOCKED even though the frontend
RPC integration is preserved. Do not query raw/private listing/profile GPS as a
fallback, fabricate consent or copy TEST fixtures. An independently authorized,
reviewed V355 discovery/privacy/CAS rollout is needed before those production
markers can function. Existing reviewed migration sources remain in this PR;
no new migration or production schema change was made in this task.

The optional isolated production gateway mode is API-only. The main site never
loads the TEST preview or TEST Supabase adapter.
The main site keeps its existing AUSTA_SUPABASE client and discover_public_providers
RPC. No auth, publication, service-order, DB/RLS/Storage or profile-GPS contract is
changed. Guest provider reads still use the consent/active/verification-gated DTO.
All fuel brands are eligible; source coverage is not guaranteed. Bounded pages
and the cap notice require viewport narrowing rather than claiming complete data.

## Evidence boundaries

Offline Chromium uses intercepted HTTPS Pages/Worker origins, explicitly synthetic
POIs/tiles and public provider DTOs. It tests desktop/mobile, external API routing,
no third-party cookies, memory token, all four categories plus internal filters,
markers, pagination, popup/directions and no storage token. Actual workerd/SQLite
CORS, HMAC, peer binding, authorization, quotas and restart persistence are tested
separately. These are not new live Geoapify evidence. No live provider call is
allowed in this completion. Prior real data/visual and TEST RLS evidence are reused.

Rollback: restore prior code/config, retain the namespace, object name, durable
signing identity and admission ledger; revoke the Pages-origin option to disable
cross-origin admission. Do not refund reservations or alter RLS/grants.
