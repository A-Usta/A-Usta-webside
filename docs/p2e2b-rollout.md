# P2.E.2B candidate: deployment and recovery boundary

This migration is additive and defaults to **disabled**. This document is not
authorization to apply it, deploy either process, or enable cutover.

## Guarantee

Durable backend-mediated admission and managed before/after evidence accounting.
Direct Supabase writes, whole-bucket physical bytes and exactly-once external I/O
are excluded. Unknown external outcomes remain charged, potentially indefinitely.

## Future production sequence (requires separate authorization)

1. Apply the migration and verify owners, empty search paths, execution grants,
   private table access and unchanged existing policies.
2. Deploy compatible web and backend; verify every serving instance converged.
3. Deploy the independent worker using `node dist/authority/worker.js`, with the
   existing backend secret configuration. Do not start it from the web process.
4. Run the controlled `austa_e2b_validate_legacy` procedure while disabled, after
   old instances have stopped writing. Review unknown references. The procedure
   reads Storage catalog observations; caller-declared sizes are not used.
5. Verify the reconciler heartbeat and legacy inventory. A privileged, separately
   approved cutover sets `enabled` and `cutover_at`; the control constraint requires
   validated legacy inventory and a recorded reconciler heartbeat.
6. Verify explicit active enforcement. Mixed versions are never described as
   providing the durable guarantee.

Unknown legacy debt blocks new uploads only on the affected order. Existing data
is not deleted. Seeding is deliberately not executed inside the migration.

## Recovery

The worker holds count/bytes for unknown writes. Absence, elapsed time, caller
abort, transport errors and process termination are not proof of no write.
Matching downloaded bytes/digest permit transactional finalization. Mismatches
remain held for investigation; no destructive automatic compensation occurs.

The service role cannot write private proof records. Exceptional operator release
requires a privileged review of a provider's terminal-no-write evidence, matching
the reservation/request, with the artifact SHA-256, reviewer and review time
recorded in `terminal_no_write_proof`. Do not manufacture such a record from an
object-not-found result. The release RPC still checks generation/state and refuses
to refund an already attached path. No HTTP administration endpoint exists.

Unresolved rows are never age-deleted. Terminal operation keys are retained
indefinitely by this initial implementation (therefore at least 30 days). A later
retention change must preserve the promised replay horizon and live usage.

## Rollback

Disable new durable admission through a separately approved operation. Preserve
private rows, finalize/status access and the reconciler until outstanding writes
settle. Reverting to an E.2A-only backend suspends the durable guarantee. Do not
drop accounting tables to roll back a web/backend release.

## Verification limits

PGlite tests exercise transactional functions and concurrent logical backend
callers, but are not a multi-session PostgreSQL lock-scheduling proof. A staged
multi-session PostgreSQL verification is required before production cutover.
The unrelated listing service-role SELECT finding remains a separate follow-up.
