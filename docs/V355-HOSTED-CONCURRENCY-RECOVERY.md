# Hosted CAS concurrency recovery

The existing TEST run is preserved. No new hosted write, fixture cleanup, migration, Auth/Storage/media operation or production access is authorized by this document.

## Preserved TEST baseline

Project identity reverified: A-USTA-TEST / xnhxneziasqthkhhntkv / PostgreSQL17.11.
Run d58f846f-c077-4b00-a7dd-d224170074fb.
Publication listing825fdd09-3ccf-4e4f-be8c-2015ee38ea25; owner c3572e93-bfbf-4174-9e49-a4403b1146b0; exact marker AUSTA-V355-CAS-d58f846fc0774b00a7ddd224170074fb; revision3; enabled=false; consent=false; consent_at=NULL. Discovery0.

Preserved receipt IDs:
- d6305824-0b3e-51c2-9946-1d480c3f7b69 (revision1, enabled=true)
- 97325289-598d-5a1a-bf72-c9a85ca33f26 (revision2, enabled=false)
- b3ebf67d-2c5e-57b5-b7b9-0619012c56e6 (revision3, enabled=false)

Profiles/sellers/listings/media/Storage metadata fingerprints still match the original baseline. Synthetic seller/listing intact. Old Storage metadata count0 does not certify physical/API absence. SQL role-based owner/non-owner reads are not ordinary A/B Auth logins.

## New deterministic proof

`Contracts.test_controlled_lock_observation_before_commit` opens three directly controlled connections. A performs an RPC and holds the transaction open. B starts a competing RPC with the same expected revision. The observer verifies all of:

- Three distinct backend PIDs.
- B wait_event_type=Lock in pg_stat_activity.
- A in pg_blocking_pids(B).
- A granted transactionid lock matched to B ungranted lock in pg_locks.
- B still pending immediately before A is released.

Only after those assertions does A commit. B must return40001; only A advances revision/receipts. Timeouts bound observation, lock and statement waits. Failure rolls back A to release its lock; no backend termination or cluster deletion. Missing overlap fails the test.

Fresh disposable PostgreSQL17.11 proof: A PID27, B PID28, observer PID29; wait_event transactionid; both lock proofs true; release after observation; B40001; final revision2. This is local evidence, not hosted certification. Previously successful tests were not rerun locally; only the new targeted test ran. Normal PR CI will validate the updated test suite.

## Exact proposed hosted continuation — approval required

A supported connection path to independently controlled simultaneous TEST PostgreSQL sessions is required. Existing SQL connector calls returned distinct PIDs without observable overlap; they cannot be treated as interactive transaction handles. No dblink/postgres_fdw/pg_background extension is installed. No extension or credential is created or read to bypass this limit.

Use the existing publication; do not delete/recreate it. Require its exact baseline and original receipt IDs before starting. Verify TEST hostname, TLS certificate/hostname and project identity on each connection. Use A/B/observer sessions and the observation protocol above.

Transaction A: authenticated owner A withdrawal(expected3), request b3ebf67d is NOT reused. Proposed new request ID0e4faef2-59dc-573b-aabd-873888191c8b, previously allocated but never used; commit produces revision4, still disabled/nonconsenting, and exactly one additional receipt (total4).
Transaction B: same owner, competing withdrawal(expected3), unused request63723c31-98e2-589a-9091-12a7331c00ff. It must be observed waiting before A commits, then reject40001 and create no receipt.
Observer: read-only pg_stat_activity/pg_locks, bounded timeout. No successful hosted mutation is performed until separately approved. No host wildcard, TLS bypass, password reset or automatic secret provisioning is permitted.

If owner authorizes this continuation, it fits the previous limit of one publication and sixteen run receipts but still needs the latest explicitly requested approval for additional hosted writes/credential use. The supported secure credential channel and execution environment must be identified before requesting a secret; never put it in chat, source, argv or logs.

## Cleanup boundary

No cleanup performed: current owner instruction explicitly preserves the one publication and three receipts. After confirmed hosted concurrency, prior cleanup authorization covers only this run's exact records, with an updated exact receipt-ID inventory including the approved new receipt. Revalidate marker/owner/revision and receipt payloads; delete only the exact run records, then use an independent read-only transaction to check counts, discovery, fingerprints and seller/listing preservation. On any mismatch stop and preserve state. Do not broaden cleanup to a listing-wide or owner-wide delete.

Gate1 ordinary Auth/Storage, Gate3 account restrictions/live QA and Gate4 final release remain open. PR293 remains Draft; no deployment or merge.
