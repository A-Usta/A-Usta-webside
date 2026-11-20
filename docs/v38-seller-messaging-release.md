# V3.8 universal listing detail and seller messaging

## Implementation contract

- Listing public number, deduplicated views, real `updated_at`, and price history continue to use the reviewed V3.6 metrics RPCs. V3.8 does not create replacement counters or alter source listing tables.
- Seller registration time is returned by `austa_get_listing_seller_registered_at(source,id)` only for a currently public listing. It returns only the account creation timestamp; it does not expose email, auth ID, or profile columns.
- Conversations are unique per listing and buyer. The seller ID is resolved from the published listing by `austa_private.v36_listing_exists`; clients cannot submit a seller or sender ID. Messages use a client request UUID for retry idempotency and `auth.uid()` as sender.
- Browser roles have no direct access to private message tables. Authenticated RPCs validate participation on every operation. Polling refreshes open threads every eight seconds and inbox unread state every twenty seconds; no Realtime publication setting is assumed.

## Migration and environment

Migration: `20261120120000_v38_seller_messaging.sql`.

It is additive: two private tables, indexes, participant RLS policies, and narrowly granted RPCs. It requires the existing V3.6 listing metrics helper/table and controlled migration-owner read access to `auth.users`. No existing listing rows, Storage buckets, RLS policies, payment contracts, or promotion fields are changed.

Apply to the confirmed TEST project only after reviewing the project ref and running `tests/db/seller-messaging.test.cjs`. This repository environment did not have hosted TEST user credentials; hosted create/send/read and browser upload flows must be separately exercised with two approved TEST accounts before release. No production SQL was run.

## Rollout order

1. Confirm target project ID and database version; require the V3.6 metrics objects to exist and the migration role to have `auth.users` SELECT.
2. Apply the migration to TEST, then verify function ACLs, RLS flags, active-listing registration timestamp, and two-user A/B CRUD/isolation using synthetic accounts.
3. Release the static frontend only after the RPCs are present. Keep the V3.6 detail and existing contact paths available if the rollout is rolled back.
4. Smoke test one active listing from each source, account date display, buyer-to-seller message, seller reply, unread badge, read transition, and duplicate request retry.

## Rollback

Before any production release, stop new V3.8 message entry points and allow in-flight RPCs to finish. Revert the frontend first. Keep message tables and data in place for recovery; do not drop them as an automatic rollback because that would irreversibly delete conversations. Any later retention/drop operation requires separate data-retention approval and backup verification. Production migration and deployment remain unperformed.
