# Manual protected TEST CAS workflow

## Delivered boundary

`.github/workflows/v355-hosted-cas.yml` has only workflow_dispatch. It has no PR, push, schedule, workflow_run or automatic retry trigger. Hosted job binds repository, feature branch and reviewed SHA, uses the literal `austa-test-only` environment and a non-cancelling per-TEST concurrency group. The existing local-only `tests/postgres/test_publication_cas.py` remains byte-identical.

The no-credential review job checks environment metadata using the read-only automatic GitHub token: named environment exists, required reviewer configured, administrator bypass disabled and exactly one custom branch policy matching `feat/v355-automotive-map`. Missing/inaccessible metadata fails closed before DB credentials are used. The metadata checker does not read/create secrets.

Only the hosted execution step receives two encrypted secrets, after dependency installation in a clean venv. No PR-triggered workflow references either DB secret. The PR security workflow runs only the offline/synthetic and disposable-local tests of this runner. Those runs cannot connect to hosted Supabase.

## Runtime protections

The production entrypoint accepts no host, DSN, username, port, arbitrary CLI arguments or libpq environment override. It pins the previously verified TEST session pooler `aws-1-eu-central-1.pooler.supabase.com:5432`, database postgres, user `postgres.xnhxneziasqthkhhntkv`; transaction pooling port6543 is rejected. TLS requires verify-full using the CA certificate supplied through the encrypted environment secret. The normalized public certificate is validated, hashed and written only to a private temporary public-CA file; its file hash is rechecked. No password/connection string is written to any file or command line.

Each connection verifies transport/TLS and the server database/session identity, exact synthetic seed and approved RPC body before use. All three preflight connections require exactly the preserved revision3 disabled/nonconsenting publication, exact original three receipts and original data fingerprints. Receipt contents/old-record digest are verified and rechecked after execution. A different baseline, prior successful run, foreign record or incomplete configuration blocks with no mutation.

A calls only withdrawal(expected3), using unused run request0e4faef2-59dc-573b-aabd-873888191c8b. B calls the same operation with request63723c31-98e2-589a-9091-12a7331c00ff, but B **always rolls back**, including unexpected success or A rollback. The observer must prove B waits on A using pg_stat_activity, pg_blocking_pids and matching granted/ungranted pg_locks. A commits exactly once only after proof. Timeouts bound every wait. No proof means A rollback; lost commit response means BLOCKED/uncertain, no retry and no cleanup. An independent fourth connection verifies revision4, disabled/nonconsenting, receipts4, discovery0, unchanged old receipts and data fingerprints.

Error output is an allowlisted status/stage only, never raw exceptions/provider responses. The code contains no cleanup, DDL, Auth, media/Storage or deployment interface. Existing TEST records remain untouched until the protected manual run actually passes its baseline.

This is a SQL role-based PostgreSQL test, not ordinary A/B Auth login evidence. Broad TEST database credentials must never be made available to unreviewed PR code or unrelated jobs.

## Security/local verification

Offline security tests cover dispatch/environment/SHA binding, production/libpq/DSN override rejection, target and TLS identity, missing secrets, CA failure, redaction, protected-environment metadata and workflow secret isolation.

The new hosted protocol is exercised separately on disposable loopback PostgreSQL: success after lock proof; missing proof with no committed A or B change; and a genuinely committed A with a simulated lost commit response, reported uncertain with no retry. The local fixture uses a different database name and explicit test-only attestation; the production database-name/TLS checks are not disabled in the hosted entrypoint. No hosted credential is used by these tests.

## GitHub UI setup required

The connector in this session exposes no environment/secret creation or workflow-dispatch operation. These are the exact UI settings required; no new owner task approval is needed.

1. Repository **Settings → Environments → New environment**: create `austa-test-only`.
2. Configure **Required reviewers**, select the owner/reviewer, save. Disable **Allow administrators to bypass configured protection rules**. Under **Deployment branches and tags**, select **Selected branches and tags** and add only branch `feat/v355-automotive-map` (no wildcard/tag policy).
3. Under this environment's **Environment secrets → Add secret**, add:
   - `AUSTA_TEST_DB_PASSWORD`: existing **A-USTA-TEST** PostgreSQL password. Do not reset it and do not use a Supabase API/service-role key.
   - `AUSTA_TEST_DB_CA_PEM`: complete PEM root certificate from the TEST project's **Database Settings → SSL Configuration → Download Certificate**. This is a public CA certificate, not a private key. Do not alter SSL enforcement.
4. When the dispatch workflow has been registered on the default branch through a separately safe repository process, open **Actions → V355 approved TEST CAS withdrawal → Run workflow**, choose `feat/v355-automotive-map` and enter its exact reviewed HEAD as `approved_sha`. Review/approve the protected TEST job when GitHub presents the environment gate. This uses the standing TEST authorization; it is not another task scope request.

### GitHub registration constraint

GitHub's Run workflow UI requires the workflow file on the default branch. The new workflow is prepared on the existing PR branch only; main/PR293 have NOT been merged or changed to bootstrap it. No default-branch or deployment changes are implied by these setup instructions. Environment secrets alone will not make an unregistered branch-only workflow runnable. With the current no-merge/no-deploy scope, default-branch registration remains a separate technical blocker; do not bypass it by changing repository default branches or by adding hosted secret use to a PR-triggered workflow.

Official references:
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
- https://docs.github.com/en/rest/deployments/environments
- https://docs.github.com/en/rest/deployments/branch-policies
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/platform/ssl-enforcement

The actual hosted test is NOT certified by offline/local PASS. Keep PR293 Draft until all required hosted/live gates pass. No cleanup is authorized by this workflow.
