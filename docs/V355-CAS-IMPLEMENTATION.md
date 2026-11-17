# PR293 publication CAS and recovery

## Implemented contract

Application writes use `v355_apply_map_publication`, never direct upsert/update. All new writes check authenticated ownership and the expected revision. The listing row serializes first inserts and changes. Publish locks eligibility dependencies; discovery independently enforces current eligibility. Withdrawal is allowed while ineligible. Absent-row withdrawal creates a disabled, nonconsenting revision-1 tombstone, so a concurrent publish(expected=0) cannot undo it. Tombstone fields are inert placeholders, never discovered publicly.

Receipts are necessary: a committed write followed by a lost response cannot be safely distinguished from an uncommitted write by version alone. The receipt and publication commit in one transaction. `(owner_id,request_id)` is unique; request-key locks serialize retries even across listing IDs. Different payload reuse fails, exact replay returns the original outcome without reapplying it. Current ownership is checked before receipt replay. Historical success does not assert current publication state; the UI rereads it after recovery. Receipts have RLS and no application SELECT/write privilege. They retain only already-public submission fields, not tokens/private profile GPS. No automatic retention purge: deleting receipts would weaken replay guarantees. Retention requires a separately designed expiry/tombstone contract.

An uncertain frontend request is kept in memory, scoped by Supabase client and user, and freezes new edits. Recovery requires an explicit click and resends the identical request UUID and arguments. Closing/reopening the dialog preserves it within the page; page reload discards memory and reloads authoritative state. No consent payload/token is persisted in browser storage. Old expected revisions are never silently rebased. The UI lists owned inactive listings as well so withdrawal does not depend on current eligibility.

The existing profile trigger body/owner is preserved. Its search_path becomes empty and direct application execution is revoked. Other V355 definer functions already have empty search_path, schema-qualified dependencies and narrow public DTO/boolean contracts; they are unchanged.

## Migration and rollback

Order: `20261114072012` → `20261114132329` → `20261117090000`.

No hosted SQL has been applied for this change. TEST application requires owner approval. Production is untouched and unauthorized. The additive revision backfill does not change existing public content/consent. Migration preflight rejects partial/conflicting objects and missing privacy/profile dependencies atomically. REST schema reload is notified at commit.

Deploying the RPC client before the migration fails closed. Old clients fail closed on denied direct writes after migration. This is intentional; no legacy writer bypass is permitted. Rollout requires migration before frontend activation, with caches considered. To contain a problem, revoke authenticated RPC execution and disable publication UI, retaining revisions, receipts and privacy gates. Prefer a tested forward fix. Do not drop receipts/revisions, restore direct writer grants, or restore public raw-location reads as a generic rollback. A full inverse migration is not certified.

## Verification boundaries

`tests/postgres/test_publication_cas.py` uses real PostgreSQL and distinct backend PIDs, creates a unique local-only database and drops only that database. It never deletes a cluster or accepts a hosted hostname. The fixture models prerequisites and both existing V355 migrations are executed unchanged. CI uses a disposable PostgreSQL 17.11 service, no production/TEST secrets. Unit/browser contract tests complement, never replace, PostgreSQL concurrency tests.

Local backend build/typecheck and 272 tests passed. Real PostgreSQL 17.11: 15 tests passed. DB contracts: 508 passed. Local browser startup is blocked by Unix socket restrictions; CI browser results must be verified separately. No hosted results may be inferred from these counts.

## Hosted release hold

- Gate1: TEST Auth A/B metadata verified read-only. Both confirmed and not deleted. Previous two Storage objects have zero metadata rows; this is NOT independent Storage API/physical absence proof. Ordinary A/B sessions and approved run-scoped mutation/cleanup are still required.
- Gate2: local real PostgreSQL PASS; actual TEST migration + hosted security exercise require separate approval. Existing TEST has no application CAS RPC.
- Gate3: runtime API key/domain restrictions/project quota/billing cap and real live desktop/mobile evidence are not supplied. Browser-local pacing is not a project-wide billing safeguard. No paid activation is authorized.
- Gate4: source order/fail-closed compatibility described above; production compatibility is not freshly certified against production. No production connection, migration, deployment or merge.

Keep PR293 Draft until every required hosted/live gate is satisfied. PR294 is out of scope.
