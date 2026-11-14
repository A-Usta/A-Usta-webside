# Owner authorization request — TEST ONLY, not executed

Exact target: A-USTA-TEST `xnhxneziasqthkhhntkv`. No production access or authorization. Read-only metadata inspection: PostgreSQL17.11; profiles, seller_profiles, service_provider_listings present; provider_map_publications absent; discovery overloads zero. Existing profile-security, role-change, provider promotion, seller eligibility and updated-at triggers remain untouched. Revalidate all dependency column types/RLS/grants immediately before approved execution.

Requested file: `supabase/migrations/20261114072012_v355_public_provider_discovery.sql`
SHA-256: `e654873b2ede0f4c393eda28a9e178fc26dcec7afbb8e3cfba9682eb593ebfd7`

**OWNER APPROVAL REQUIRED before applying this file or creating HTTP test fixtures.** Preparing or committing SQL does not authorize its execution.

Exact full SQL and delta against reviewed aad331a are included in the owner package. It remains a single transaction. Local PGlite validation is not a Supabase HTTP PASS.

## Inventory and dependency order

1. Existing auth.uid()/auth.users, anon/authenticated roles, public schema grants; existing RLS-enabled profiles(id UUID,role text,is_active boolean), seller_profiles(id/owner_id UUID,business_type/status/verification_status text), service_provider_listings(id/owner_id/seller_profile_id UUID,provider_type/status text). Inspect current eligibility triggers before generating synthetic fixtures; do not weaken them.
2. Add provider_map_publications (PK/FKs, explicit public consent/fields, owner RLS and authenticated-only table grants), immutable identity/server timestamps trigger, bounds/area indexes.
3. Add narrow STABLE SECURITY DEFINER discovery RPC with empty search_path, timeout, explicit public DTO, joins preserving active profile+matching owner/type verified active seller+active listing+consent owner snapshot. Revoke PUBLIC EXECUTE, explicitly permit anon/authenticated DTO only. No raw profile-location grants.
4. Compared with prior proposal, RPC adds default countrywide boolean, result_offset integer, category text. Local calls still support prior six arguments by defaults. National search requires >=2-character name, offsets0/40/80, whitelist category before LIMIT40, stable ID order; public mobile areas return no pin. Existing migration has not been applied: edit is a proposal replacement, NOT an upgrade path for a deployed old overload. If any object exists at execution, preflight rejects; stop, inspect and prepare a separate reviewed upgrade. Never blindly recreate/drop.

No vehicles, service orders, assignment, Account, Storage or existing policy changes. No data backfill from profiles, private coordinates or production users.

## After separate approval: real HTTP/RLS checklist

Verify exact TEST project before EACH write; secure TEST credentials only. Apply only this hash-matching file, not all historical/bootstrap migrations. Capture grants/RLS/function owner/search_path/signature/advisor. Synthetic A/B fixtures through approved existing eligibility setup; do not use user-editable auth metadata as verification. No service orders submitted.

Use real REST authenticated A/B JWT and TEST publishable key (not service-role) for assertions. POST RPC is /rest/v1/rpc/discover_public_providers. Example body: {"south":38.3,"west":44.7,"north":41.95,"east":50.8,"query":"synthetic name","area":"","countrywide":true,"result_offset":0,"category":"all"}. Local search countrywide=false keeps <=0.5degree bounds.

Test anonymous raw table access denied; public RPC only narrow consent DTO; A own create/update/withdraw; B cross-user select empty, update/delete zero affected, spoof insert denied; immutable listing/owner; unverified/inactive/mismatched seller excluded; name search across districts and Nakhchivan; category before LIMIT; offsets bounded; mobile coordinates/address null; owner reassignment/withdraw immediately excluded on fresh query; stale auth switching suppressed. Record ACTUAL status/body/affected rows (a 200/204 with zero rows is not a bypass). Sanitize tokens, keys, URLs. Run security advisor and investigate definer warnings.

## Non-destructive rollback / stop rules

Transaction errors roll back; inspect before retry. Existing-object/dependency mismatch => STOP, no drop/recreate. To disable public discovery after an approved TEST application, revoke EXECUTE on the NEW nine-argument function from anon/authenticated and disable map bootstrap; keep consent table/data for owner review. No existing tables/policies/triggers removed. Owner fixture cleanup must be limited to run-owned synthetic IDs. No production migration, release or paid activation authorization is requested here.
