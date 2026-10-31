# Reviewed manual database migrations

The repository had no SQL migration directory, migration runner or deployment
convention at the P1.2A base (`dc035b49ed50a2f9f89eeced2cb307e64161ab51`). This
folder introduces timestamped, reviewable SQL without wiring automatic execution
into the app, CI, npm scripts or deployment. Production application requires a
separate review/authorized operation. Do not run a production migration as part
of these tests.

## P1.2A seller eligibility guard

`20261101000000_p12a_seller_eligibility_guard.sql` changes only these existing
trigger functions via `CREATE OR REPLACE`:

- `public.austa_validate_vehicle_seller_profile()`
- `public.austa_validate_marketplace_seller_profile()`
- `public.austa_validate_service_seller_profile()`
- `public.austa_validate_auto_dealer_seller_profile()`

A non-null association must match seller id, listing owner, the existing business
type rule, `status='active'` and `verification_status='verified'`. Official
approval is not required. Null associations return immediately as before.

The migration preserves trigger OIDs/names and their original firing columns:
Vehicle/Marketplace/Auto Dealer use INSERT or UPDATE OF seller_profile_id,
owner_id; Service/Usta additionally uses provider_type. Unrelated updates,
including a status-only publish update, do not acquire a new seller validation
hook. Explicitly assigning seller_profile_id to itself **does** revalidate.
Existing revoked/pending associations are not deleted/detached or backfilled.

### Restricted-column dependency and function security

The supplied functions were SECURITY INVOKER but SELECTed seller_profiles.owner_id.
That column is intentionally not SELECTable by browser roles. An isolated
PostgreSQL test reproduces `42501` even for an otherwise eligible owner.

The four functions therefore use SECURITY DEFINER with empty search_path,
fully-qualified lookups and an authenticated-owner comparison before their
private lookup. Missing-JWT calls from untrusted roles fail closed; privileged
SQL/service-role callers retain their existing path. They return only NEW, never
seller/private verification fields.
No public column grants are widened. Existing function owners and ACLs are
preserved; production function owners must be trusted/controlled roles.

The transactional preflight aborts before changing functions if a binding/event
column/body has drifted or a function owner lacks authoritative seller-read access.
The preflight accepts only whitespace-normalized fingerprints of the supplied
original bodies or this exact hardened version, so future custom guard checks
are not silently overwritten.
Do not bypass these checks, change ownership or grant public access merely to
force application. Review the actual deployment role/ownership if they fail.

Promotion functions/triggers, all approval/rejection/review functions, composite
FKs, RLS, grants, Storage, UI and frontend managed-field stripping are unchanged.
Reapplication is idempotent. No trigger is dropped or recreated by the migration.

## Isolated SQL tests

From the repository root:

```sh
npm ci --prefix tests/db --ignore-scripts --no-audit --no-fund
npm test --prefix tests/db
```

The pinned PGlite dependency runs PostgreSQL/PLpgSQL locally in WebAssembly. It
uses no production URL, credentials or external database. The fixture models the
needed tables/RLS/column grants and transcribes the supplied production trigger,
promotion and review function bodies; it is not a full production schema dump.
Approval/revoke execution is exercised; the unchanged rejection function's
private helper implementation was not supplied and is not invented or executed.

An existing isolated dependency installation may be selected with
`P12A_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite`.

The two required negative mutation runs change only the in-memory SQL passed to
the isolated database; migration files are not modified:

```sh
P12A_MUTATION=status node --test --test-name-pattern=ineligible tests/db/seller-eligibility.test.cjs
P12A_MUTATION=verification node --test --test-name-pattern=ineligible tests/db/seller-eligibility.test.cjs
```

Those commands must fail on the intended eligibility cases. Normal tests must
pass with P12A_MUTATION unset. No seller-selection UI is included in this phase.

## P1.2A.1 owned eligible seller discovery

`20261101010000_p12a1_owned_seller_discovery_rpc.sql` introduces only
`public.get_my_seller_profiles()` with zero input arguments. Repository RPCs use
semantic snake_case names; the supplied production discovery inventory reports
no existing owner-read RPC. The migration also rejects an unexpected same-name
function/overload or drifted body/return contract before replacement.

The smallest selector contract is **eligible profiles only**: ownership derives
exclusively from `auth.uid()`, with `status='active'` and
`verification_status='verified'`. Official approval is not required. The explicit
seven-column table DTO is id, business_type, display_name, status,
verification_status, official_status, official_scope. It contains no owner,
reviewer, application, legal, tax, document or rejection data. All four business
types are returned; source compatibility remains enforced by P1.2A listing guards.
Existing stale associations are preserved by the future P1.2B sparse-edit path,
not by expanding this discovery surface to ineligible profiles.

The STABLE PL/pgSQL function is SECURITY DEFINER with empty search_path and
fully-qualified objects. Missing auth UID raises SQLSTATE 28000 even for a
privileged SQL caller. PUBLIC/anon execution is explicitly revoked and
authenticated execution granted. A postcondition rejects inherited anon access.
The creating role (or preserved existing function owner on reapplication) must
have all eight internal SELECT privileges and authoritative RLS-bypass/table-owner
access. Apply through a trusted controlled owner; do not grant private columns or
weaken the preflight to make application succeed.

No seller table grants, RLS policies, existing guards, review workflow or runtime
UI are changed. No migration is executed automatically. Production application
requires separate review/authorization; P1.2B remains paused.

Tests run actual local PostgreSQL through the existing pinned PGlite package:

```sh
npm ci --prefix tests/db --ignore-scripts --no-audit --no-fund
npm test --prefix tests/db
```

Negative mutation proofs modify only SQL strings in a fresh in-memory database:

```sh
P12A1_MUTATION=owner node --test --test-name-pattern='cross-user isolation' tests/db/owned-seller-discovery.test.cjs
P12A1_MUTATION=status node --test --test-name-pattern=ineligible tests/db/owned-seller-discovery.test.cjs
P12A1_MUTATION=verification node --test --test-name-pattern=ineligible tests/db/owned-seller-discovery.test.cjs
```

Each mutant must fail its intended data-isolation/eligibility assertions. Run the
normal suite without P12A1_MUTATION afterward. The isolated fixture is a synthetic
model of supplied production contracts, not a full production schema dump.

Existing-function preflight also requires the catalog security mode, volatility,
language and configuration to match the reviewed state: SECURITY DEFINER, STABLE,
plpgsql, and only explicit empty search_path. PostgreSQL serializes that setting
in proconfig as `search_path=""`; missing settings and nonempty paths are rejected.
Security metadata drift is never silently repaired. Isolated drift tests commit
the incompatible state before migration, then verify its full pg_proc row remains
unchanged after the failed migration transaction is rolled back.
