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
