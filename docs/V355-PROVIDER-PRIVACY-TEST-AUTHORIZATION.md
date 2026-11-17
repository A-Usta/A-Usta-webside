# Exact owner authorization request — TEST only, not executed

Target: A-USTA-TEST `xnhxneziasqthkhhntkv`. No production permission. Read-only inspection confirms PostgreSQL17.11, canonical tables/RLS/column grants, two legacy provider SELECT policies, one media SELECT policy, canonical private provider-media bucket/policies, no dependent provider views. New map/privacy objects have not been applied in this task. Reverify live state immediately before any future write.

## Requested chain

1. Previously reviewed `20261114072012_v355_public_provider_discovery.sql` (SHA256 e654873b2ede0f4c393eda28a9e178fc26dcec7afbb8e3cfba9682eb593ebfd7), if absent and separately approved.
2. `20261114132329_v355_provider_location_privacy.sql` SHA256 `6819d31972685dd601cb8ada708748c75b99896c458ee543bd766a0e7dd4982a`.

Full new SQL and exact source patch included in owner package. Requires map consent table/RLS; guard rejects missing dependencies, existing/conflicting view/functions, unexpected SELECT policy inventory, disabled RLS or public/missing provider bucket. No blind all-migrations dbpush or replacing drifted objects. Both proposals are additive/staged contract changes; this privacy transaction does not alter/delete stored provider data.

**OWNER APPROVAL REQUIRED before either remote migration, Auth fixture or data mutation.** Requested synthetic scope after approval: two TEST Auth identities, their profiles/verified seller/provider fixtures through approved admin fixture setup, consent rows and canonical run-owned media/object fixtures. Do not weaken existing role/security/seller triggers. Use real anon/A/B JWTs for assertions, never a service-role actor for RLS proof. No real customers or service orders. Production is out of scope.

## Execution evidence required after approval

Verify target project/hash/column types/policy modes/role grants/deployed migration history before each write. Apply reviewed chain in order under a trusted migration role. Record public view owner,security_barrier,security_invoker=false and exact read-only grants; functions STABLE/SECURITY DEFINER/empty search_path/PUBLIC revoke; restrictive policy modes; Storage canonical path/link policy; security advisor. Public projection deliberately runs as trusted owner because private eligibility/consent cannot be exposed to an invoker view. Do not dismiss advisor warnings or grant base raw access to make a test pass.

HTTP matrix: anon/non-owner raw SELECT* and latitude/longitude/address/phone/details/filter/embedded routes yield no private rows; owner raw SELECT/update/returning succeeds; public projection exposes only approved public fields; non-owner view writes denied; owner edit/listing-detail compatibility; mobile null pin; map nationwide/Nakhchivan queries safe on every page; withdraw/deactivate/lose verification removes public location; media metadata and fresh authenticated Storage signing/download reflect current eligibility; canonical linked assets remain; orphan/traversal/wrong owner/reparent denied. Existing signed URLs/caches may survive their lifetime; do not claim retroactive revocation. Probe GraphQL if enabled. Record actual statuses,SQLSTATE and affected-row counts (200/204 zero rows is not proof of a bypass). No token/key in logs.

Explicit compatibility approval: existing raw contacts/addresses without verified public consent become private until reapproved; no automatic GPS/contact backfill. Public metadata remains. Old raw-reading clients need coordinated frontend refresh/release; no zero-downtime guarantee. Do not execute against production to discover impact.

## Non-destructive rollback

Transaction/preflight error: rollback and inspect, do not drop/recreate. After an authorized TEST application, keep the restrictive raw privacy gate and stored consent/data. Disable public projection/view SELECT and new map discovery if needed, or ship a reviewed forward fix; owner raw operations remain. Never restore the old public GPS policy as an automatic rollback. Keep files/rows for review; cleanup only run-owned synthetic fixtures after explicit scope approval. No existing table/bucket/user data deletion, Git reset, deployment or production operation.
