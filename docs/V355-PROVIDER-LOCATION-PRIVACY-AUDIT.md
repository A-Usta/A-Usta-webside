# V3.5.5 provider location privacy — audit and local remediation

Baseline PR#293 / feat/v355-automotive-map / 6282c9a3de966a6491e8ab70f93b5eee3fbf1b3f, tree5c35a22f1de1da8a72cf8410b4ecd57fb904b94f. Remote PR Draft/unmerged verified. Missing transient checkout was recovered from that exact Git object in a new clean worktree; old dirty Phase1 work was not reset/overwritten. TEST metadata only: xnhxneziasqthkhhntkv. No production data/schema access or remote mutations.

## Root cause and contract

Legacy provider RLS permits the whole active row, not selected public fields. All provider columns (including raw latitude/longitude,address,phone,message_contact,details,owner_id) are readable to anon/authenticated under the two active-public SELECT policies. Details JSON can carry extra private fields. Hiding fields in a card does not restrict PostgREST/GraphQL/joins/filters. Active status is not consent.

The proposal uses a RESTRICTIVE owner-only raw SELECT gate. Original owner reads, INSERT/UPDATE RETURNING, edit/detail hydration and staging/activation writes stay on the same base table. Existing permissive policies are retained but cannot override the restrictive gate. Public consumers use a trusted-owner SECURITY BARRIER view with explicit columns and visibility predicates. Owners see their original private fields; everyone else receives location/contact only from the separate consent row, never raw listing/profile coordinates. Column revocation alone was rejected because it also breaks legitimate owner SELECT*/RETURNING and existing editor contracts. A table rename/write-through view/independent publication controller was rejected as unnecessary lifecycle risk.

| Privacy class | Canonical data / authorization |
|---|---|
| Private provider GPS/address/contact | Existing profiles and raw service_provider_listings; authenticated owner/admin where existing profiles policies allow, privileged authorized backend. Raw provider listings owner-only for browser roles |
| Public business location/contact | Explicit provider_map_publications public fields with current owner match,enabled+consent+timestamp/version,active verified eligible listing. Never inferred from active status or copied from raw fields |
| Approximate service area | Explicit public_area; mobile records have null precise coordinates/address. Legacy raw region/district are not assumed safe public text |
| Approved map location | Existing narrow discover_public_providers RPC from consent table. Nationwide/Nakhchivan search unchanged; revocation/deactivation/verification loss excludes fresh results |

## Exposure inventory (current TEST metadata + repository source)

| Path | Before / remediation / evidence limits |
|---|---|
| service_provider_listings direct REST, explicit GPS SELECT, SELECT*, filters/counts/embedded joins | Confirmed broad column grants + active-public policies. New restrictive gate yields zero rows to anon/non-owner. Public view masks private/contact/identity/JSON and uses approved public-location values only |
| Public listing loaders | index.html two active public list reads changed only relation literal to public_service_provider_listings. Routing/category/status/filter/order/pagination logic unchanged |
| Listing-detail fresh parent reads | assets/marketplace/listing-detail.js uses view only for service_provider, twice as before. Canonical source/__austa_table stays service_provider_listings. Owner projection retains private fields for editor; other categories unchanged |
| My Listings / preserveDetails / saveProvider / media staging / UPDATE RETURNING | Raw table queries already owner-scoped. No publication/controller/backend changes. Restrictive owner gate preserves these operations |
| Dormant findListingById table loop | Unreachable after canonical lookup delegation; not a live bypass. Raw RLS would also deny unauthorized data |
| provider_map_publications / discover_public_providers | Existing unapplied V355 contract, unchanged. Owner RLS and definer projection verified locally; not remotely certified/applied |
| profiles | Anon no column grants; auth owner/admin SELECT policies. GPS,private phone remain private; not copied to map/view |
| provider_profiles / KYC | Anon no grants; auth own/admin policies. Audited KYC RPCs enforce own/admin and return status/reason, not GPS/FIN/document data. Not modified or invoked |
| provider_services / find_matching_providers | Raw provider_services no anon/auth grants. Matching definer is service-role-only; backend requires authenticated own pending order, returns bounded distance/radius, not exact GPS. Existing authorized assignment contact path reads profile id/full_name/phone/avatar/role, not GPS. No service-order contract or code changes |
| service_provider_media | No GPS/contact columns, but owner UUID/storage path public with active parent. New read policy requires canonical path/current listing owner/link and verified public eligibility (owner exception). UPDATE parent ownership check prevents reparenting own media to another provider |
| provider-media Storage | Private bucket confirmed. Existing SELECT depended on raw parent and would break when parent becomes owner-only. Narrow definer predicate preserves linked eligible public assets and owner staging; restrictive provider-bucket guard defeats other permissive SELECT rules. No bucket/data mutation; other buckets unchanged |
| Views / generic public routines | No existing dependent location/provider views in inspected TEST. Generic SQL/JSON RPC inventory has no arbitrary public provider-row reader. All relevant public/private routine signatures/ACL/definitions inspected as metadata |
| Supabase GraphQL/PostgREST alternate selections | Same PostgreSQL role/RLS and explicit projected columns must apply. Local SQL negative tests cover raw/filter/JSON routes; actual live REST/GraphQL HTTP remains BLOCKED until approved TEST application |
| Storage paths / old downloads / media content | Public assets still contain opaque owner/listing IDs in the existing canonical path (not credentials/GPS). Files/EXIF/video metadata and visual content were not read or sanitized; they may disclose location and need a separate media-content review. Existing signed URLs/copies cannot be retroactively erased by new RLS |
| Local/browser caches | Canonical detail rereads server projection; previously fetched public records/copies cannot be revoked retroactively. Fresh query after revocation hides location/contact; no claim of instantaneous erasure on all existing screens |

Full TEST SELECT/ALL policy modes inspected: vehicle-history guards on storage are RESTRICTIVE and do not act as permissive all-bucket leaks. Other bucket policies remain scoped; no unrelated Storage rules changed. No real provider/customer row or object content read or copied.

## Proposed objects / minimal runtime changes

New migration20261114132329_v355_provider_location_privacy.sql: trusted public eligibility boolean; raw restrictive SELECT owner gate; explicit read-only barrier view; media read/update authorization; narrow canonical linked-file predicate; provider-bucket restrictive SELECT guard. No new provider ownership model/table, backfill,deletion or data transformation. Existing map migration must precede it.

Runtime: two public list relation literals and one provider-specific detail relation expression. No CSS/design change. Owner writes and other category reads retain canonical relations. Test fixtures recognize the read-only projection; historical guards admit only exact SQL/runtime fingerprints and exact literal normalization. No directory exclusions, removed assertions or skipped tests.

## Compatibility and rollout gates

Legacy raw addresses/phones/GPS have no independently verified public-location consent contract in this audit. They are retained privately, NOT automatically backfilled. Without opt-in, public listing title/name/services/media remain but raw phone/address/location no longer appear. Approved existing public values require owner review/republication using the explicit public fields before rollout. This impact is explicit, not a silent production revocation. No existing publication was modified remotely.

The change requires coordinated migration + matching frontend release: old cached clients using raw public rows fail closed/empty until refreshed. Zero-downtime/old-client compatibility is not claimed. Owner must approve rollout/cache/maintenance handling after TEST verification; no raw fallback is permitted. Never roll back by restoring public raw SELECT.

## Local security/regression evidence

Local PGlite tests first reproduce the leak on synthetic legacy records, then apply both proposals. They verify anonymous/non-owner raw access and inference denied; owner update/RETURNING retained; public detail private JSON/contact hidden; business consent values distinct from raw GPS; mobile area has no pin; withdrawal/deactivation/verification loss; linked Storage/public media and owner staging; reparent rejection; barrier/grants/search_path; map/nationwide privacy; negative and mutation tests. Mutations dropping the restrictive raw gate or exposing raw latitude in the view make negative assertions fail, then safe definitions are restored. Broad permissive Storage mutation cannot bypass the restrictive gate.

Chromium desktop/mobile consumes actual detail module/renderer and safe-projection fixture, verifies two fresh projection reads and post-revocation reload. Synthetic adapter/browser fixtures are NOT live HTTP/RLS proof. Service-order backend and whole index outside two relation literals are byte-identical to baseline; focused tests assert this.

Exact final counts,CI and source manifest are in owner package. Actual Supabase HTTP/RLS/advisor tests remain BLOCKED; no remote objects created.

## Remaining risks / decision

**Production NO-GO.** Required: owner-authorized TEST migration chain, anon/two-user HTTP + Storage tests, deployed view/function owner/ACL/advisor review, public-business consent impact approval, old-client rollout handling, media metadata/content assessment, production dependency comparison in a separately authorized stage. Existing service_orders.vehicle_id and potential authorized matching-distance inference are separate service security concerns; not silently changed. Geoapify key/budget/restriction gates remain unchanged; no paid service or live Geoapify calls.
