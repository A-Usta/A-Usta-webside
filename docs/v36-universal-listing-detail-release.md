# V3.6 universal listing detail release

## Release order

1. Review and apply `supabase/migrations/20261118100000_v36_listing_detail_metrics.sql` to the production Supabase project.
2. Confirm the four V3.6 RPCs are exposed and the `austa_private` schema remains outside the Supabase API exposed-schema list.
3. Publish the GitHub Pages commit after the database migration is available.

The Pages client uses the existing Supabase browser client and publishable key. No Geoapify key, Supabase service-role key, Worker secret, CORS wildcard, or new Pages secret is needed for listing detail. This migration has only been applied to the disposable A-USTA-TEST project; production remains untouched.

## Data behavior

- Public numbers are assigned once per source listing and remain stable. The initial backfill covers all existing listing sources and initializes views to zero.
- A legacy vehicle or marketplace listing with a current price receives one rollout-time “initially recorded” price entry. The database does not invent unknown earlier price changes.
- Listing edits update `updated_at` only when a non-timestamp field changes.
- Authenticated views deduplicate by authenticated user. Anonymous views deduplicate by the browser's persistent UUID. Both are counted at most once per listing in 24 hours and capped at 60 listings per visitor in that window. Anonymous clients can clear or rotate local storage; this is replay/refresh protection, not an IP-based anti-bot guarantee.
- Report submissions are authenticated, owner-excluded, unique per reporter/listing, and stored in a private RLS-enabled table. Reporter data is not exposed to public clients.
- Favorites continue to use `listing_favorites` RLS. Promotion choices continue to use the existing owner-authorization and package UI; package selection does not charge or activate a promotion.

## Production verification

After the migration and Pages release, verify one existing public listing from each source, a newly published listing, a price edit, a repeated view within 24 hours, and an authenticated report. Do not run the live Geoapify regional QA as part of this release; it is unrelated to listing detail and consumes a separate quota.
