# V3.5.5 interactive service map and navigation — owner review

Baseline: Draft PR293, feat/v355-automotive-map, a05b2ff881fd4b88025d26a1066bce85efd8346b; tree4ab5813313f9f9fc3f88e4e6d6e9b14e9686bcb4. Verified clean, original unrelated dirty workspace preserved. Continue same PR; no merge/deploy/production or paid service.

## Behavior

Existing Geoapify/OSM external POIs and eligible explicitly published A-USTA providers share the existing Leaflet map. No login is required for external requests or anonymous discovery RPC. Fuel,EV,wash,repair are native source categories. Tyres/alignment are shown only with explicit source tags; a generic repair result is not specialist proof. Existing Azerbaijan geocoding (city,district,settlement,village/business) and bounded current-area search, nationwide A-USTA name search/paging,Nakhchivan overview remain intact. Source coverage is not guaranteed in every village. No fake POIs added.

List selection centers/zooms its actual marker, highlights marker and selected result, opens its name tooltip and detail. Marker selection highlights the corresponding result. The focus-induced map movement does not discard results or launch more discovery requests. Approximate mobile service areas stay list-only: no fabricated pin,private address or route. Detail displays actual name,category,available public address/phone and source. External public phone is optional and syntax-validated; no invented contacts or availability.

**Marşrut qur** uses an HTTPS Google Maps URL with api=1, encoded validated numeric destination and dir_action=navigate. Origin is deliberately omitted; Google Maps obtains/asks for starting location. Unknown sources,nonfinite/out-of-range/string coordinates and A-USTA non-business locations cannot generate a route. A-USTA coordinates come only from the existing approved public discovery DTO, never profiles/raw provider GPS. No internal turn-by-turn engine or automatic assignment. Google determines app/browser handoff,location permission,route preview/navigation availability. Desktop/Android/iOS-UA Chromium checks verify actual link click/new browsing context and exact request URL, not physical native-app turn-by-turn operation.

Reference: https://developers.google.com/maps/documentation/urls/get-started (universal URL; missing-origin handling; dir_action behavior). No Google API key or routing API introduced.

## Free-plan request control

No discovery is run automatically on map open,pan,zoom or marker selection. Existing explicit bounded Places searches remain max20 results/page,3pages,0.5degree geographic span; geocoding5results,countrycode:az; JSON cache60seconds,max30entries; max20 JSON attempts/minute. No countrywide Places download.

Basemap now requires **Xəritə fonunu yüklə** activation. Only visible tiles requested: keepBuffer0,updateWhenIdle,true retina duplication disabled. JSON and visible tile starts share a serialized 300ms minimum spacing and60request/minute browser-local limit; at most48 tile reservations per page lifetime. Tile unload/dialog close abort queued/inflight images. No prefetch/service worker. Missing key,quota,outage,cancel show honest states while independent provider list remains usable.

These are browser-local safeguards, NOT a shared-account 3000-credit/day guarantee or a live usage meter. Multiple visitors/tabs can consume project quota; exact provider credit accounting and Origin/Referer restrictions still require controlled live validation and operational review. No paid plan activated; zero live Geoapify requests in this task. The prior <=30request/<=60credit fail-closed live guard remains unchanged; never run live tests without secure key and fresh provider usage evidence.

## TEST metadata and real HTTP scope

Authorized target only: xnhxneziasqthkhhntkv, A-USTA-TEST, PostgreSQL17.11. Existing migration history confirms v355_public_provider_discovery (20261114140206) and v355_provider_location_privacy (20261114140209). Neither reapplied. Read-only metadata confirms owner postgres,explicit SELECT-only anon/auth projection ACL,security_barrier=true/security_invoker=false,restrictive raw owner gate,owner publication RLS,private canonical provider media Storage guard; helper/RPC empty search_path and no PUBLIC execution. No schema changes/new migrations.

Actual anonymous HTTP: raw provider SELECT200/0rows; public projection200/0rows; private publication401; nationwide RPC200/0rows. These are live empty-state smoke checks, NOT seeded two-user isolation proof. Existing synthetic A/B Auth password attempts400; two valid sessions unavailable. No service-role/admin key provisioned; no custom JWT signing,Auth SQL inserts,unverified signup or RLS bypass attempted. Two-user owner/nonowner CRUD,consent lifecycle,Storage signing/upload/download/withdrawal remain **BLOCKED**. Requires securely provisioned confirmed synthetic TEST A/B accounts and approved fixture setup; never keys/passwords in chat/source/package. No production accounts/data accessed.

Security advisor reports the trusted-owner public view ERROR and anonymous/authenticated definer RPC WARN notices. They are not waived by local tests. Existing design deliberately uses an explicit projection because invoker mode cannot access private eligibility/consent while retaining owner-only raw RLS. Deployed definition/owner/ACL inspected; local negative/mutation tests cover masks,ownership,revocation. Actual seeded HTTP/RLS/Storage validation plus owner security review are still required; production NO-GO. Other pre-existing advisor notices are inventoried, not silently changed.

## Verification and limits

Full frontend,DB/RLS,focused real Chromium/URL/queue tests and same-PR CI results are supplied in final owner package. Six native viewport sizes1920,1536,1366,900,768,390: genuine Chromium screenshots show clearly named synthetic fixtures and unloaded basemap. They are UI evidence, not live Azerbaijani businesses or Geoapify coverage. Google handoff is intercepted for safe deterministic testing; physical Android/iOS navigation remains unverified. All original homepage service images/handlers,Account/Auth,services,listings,header/footer/backend unchanged.

Production **NO-GO** until Geoapify secure key/restriction/credit live checks,seeded TEST HTTP/RLS/Storage,advisor review and coordinated privacy-contract rollout pass. Previously downloaded public copies/caches cannot be retroactively revoked. Self-authored text/media metadata may contain location; no claim of file/content sanitization. Existing service_orders.vehicle_id ownership concern remains separate and unchanged.

## Rollback

No database migration in this increment. Roll back only this map UI increment to the verified privacy candidate if necessary; preserve already applied TEST privacy gates/consent data. Never restore public raw GPS grants to make old clients work. Production rollout and any migration remain separately authorized. Stop for owner review; keep PR Draft.
