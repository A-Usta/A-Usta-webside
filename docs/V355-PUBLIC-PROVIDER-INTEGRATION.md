# V3.5.5 — provider privacy, schema and security audit

Baseline main `90b196b7b115c0d00925e18d60cda8471ff9abf6`, tree `20f1d4f2dc2bd63ea65405a6bfb931f61ab09dee`. PR #290 (V352), #291 (V353), #292 (V354) merged. No dependent unfinished PR is imported. Prior worktrees preserved. Original local unfinished V355 folder was unavailable after session recovery; this fresh candidate is revalidated from the fetched exact baseline; old PASS counts are not reused.

Production `yafpnqcoyvoclmxdlxxc`: READ-ONLY catalog inspection only, no user rows copied. TEST `xnhxneziasqthkhhntkv`: no mutations in this task. SQL runs only in isolated PGlite fixtures. No production migrations, Auth, Storage, Render or backend changes.

## Actual contracts

- `profiles`: canonical backend roles customer/mechanic/shop/tow/cargo/admin, `is_active`; private GPS/phone exist, owner-only SELECT plus admin policy. Never a public directory source. Registration alone is not verification.
- `service_provider_listings`: canonical public listing identity (`id`), owner, provider_type **usta/service only**, status, seller_profile_id. Existing active-public RLS is broader than map eligibility. Existing raw listing latitude/longitude/phone/address lack map-publication consent; do not import them.
- `seller_profiles`: matching owner and business type, active + verified required. Official status/internal reviewer fields must not appear in map DTO. Existing seller eligibility guards remain unchanged. Null seller linkage/legacy active listings are not enough for map publication.
- `service_provider_media`: parent/owner relationship and active/owner read contracts. Existing provider Storage path-policy concerns remain outside this change. No raw storage paths, unapproved cover URLs or media bucket changes are introduced. Authorized listing imagery remains available through the existing public profile/detail flow. Inline map-image hydration is **not enabled** without a reviewed narrow public media projection; do not bypass authorization to fill it.
- Service assignment uses the existing profile/provider roles and order state machine. `Xidmət sifariş et` closes map and clicks the original Usta entry. It does not assign to the selected provider or call a competing booking API. Profile opens original `AUSTA_LISTING_DETAIL.open(id,'service_provider')`. No service-order code/contract changes. The existing service_orders.vehicle_id ownership concern is deferred.

## New opt-in contract (PROPOSED, NOT APPLIED)

Migration `20261114072012_v355_public_provider_discovery.sql`, generated via Supabase CLI `migration new`, creates only a separate **publication consent/metadata** table linked to the existing listing. This is not a duplicate provider identity table. No backfill or production data mutation.

Owner supplies explicitly public business name, city/district service area, optional public work contact, supported service labels and explicit consent. Fixed business location requires public work address and valid coordinates. Mobile service area requires NULL coordinates and NULL street address; it has a list result and no fabricated pin. UI warns against home/private contact data and makes the existing public profile link clear. Versioned consent and timestamp are server-controlled. No existing GPS is prefilled.

`provider_map_publications` RLS: authenticated owner only, with immutable consenting_owner/listing_id and listing ownership predicate in USING + WITH CHECK. No anon table grants. Anonymous discovery occurs only through bounded DTO function. Existing listings/roles/verification remain authoritative. Owner reassignment invalidates former owner's consent immediately. Revocation is enforced in each new lookup; previously seen/downloaded public data cannot be retroactively erased from another person's device.

`discover_public_providers` public RPC: anon/authenticated EXECUTE explicitly, PUBLIC revoked; stable read-only SECURITY DEFINER, empty search_path, qualified tables, bounded area and name lengths, max40 rows, statement timeout. Definer is necessary to evaluate private profiles/seller eligibility without granting clients SELECT on private fields. INVOKER would either return no providers or require unsafe broader grants. Compensation: only hand-selected opt-in DTO fields, strict active/verified/type/owner/role/is_active joins, no dynamic SQL, no phone/GPS reads from profiles, no raw verification fields, no owner IDs and no mutations. It is intentionally public for eligible consented rows. Review advisor output in a separately authorized TEST deployment before production; no claim that advisor/live HTTP passed.

## Remaining publication gates

- Owner approval of location-publication contract/consent wording, SQL and provider licensing/cost controls.
- Apply the reviewed migration in an authorized disposable TEST project and verify actual PostgREST owner CRUD/RLS, anonymous DTO, revocation, advisor warnings and session switching. PGlite tests do not prove Supabase HTTP deployment.
- Authorized external key and real POI/category/tile coverage. Tire/alignment and inline media limitations are material.
- Existing broad active-listing RLS and provider Storage policy concerns are documented, not silently changed.

## Safe rollout/rollback

No production application in this task. Later: preflight exact columns/constraints/function-name conflicts and migration dependencies; never overwrite a conflicting object. Validate first in TEST with two synthetic users. No existing table grants/policies/triggers are relaxed. Only after separate owner approval may migration and browser-key configuration be released.

Non-destructive rollback: withdraw public EXECUTE on the new discovery RPC and disable map configuration/UI bootstrap through a reviewed revert. Preserve the consent table and original provider/listing data for recovery; do not drop tables or media, do not undo unrelated migrations. Re-enable only after a reviewed fix. Raw old profiles remain private.
