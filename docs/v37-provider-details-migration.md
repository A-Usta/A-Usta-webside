# V3.7 provider detail migration: rollback and impact

The V3.7 migration only replaces the projection of `public.public_service_provider_listings`. It does not add or alter tables, listing rows, media objects, grants, RLS enablement, or policies. Owner rows still receive their original complete `details`; anonymous and non-owner access remains behind the V3.5.5 eligibility gate and receives only the explicit V3.7 public allowlist. Phone and location remain consent-gated.

## Rollback

To remove V3.7 fields from public details, execute `supabase/rollback/20261119210000_v37_service_company_public_details.sql` as a forward corrective SQL action. It restores the V3.5.5 public projection and grants while leaving owner data intact. Public service-company cards/details will no longer receive the V3.7 subtype fields until the V3.7 migration is reapplied.

Do not delete the Supabase migration-history row to roll back. In shared environments, record the corrective change as a new forward migration. The V3.7 SQL itself uses `CREATE OR REPLACE VIEW` and is safe to reapply; applying it through the migration runner still creates a distinct migration-history entry.

## Risks and scope

- Deploying before frontend code may leave the extra allowlisted detail fields unused; it does not expose raw JSON keys.
- Rolling back the view removes public subtype detail fields but does not delete listings, images, or company data.
- RLS and policy definitions are intentionally unchanged; any policy change needs a separate reviewed migration.
- The migration requires the V3.5.5 provider view, RLS, and `v355_provider_public_visible(uuid)`; it fails closed if these prerequisites are missing.
- V3.7 was applied only to approved TEST project `xnhxneziasqthkhhntkv`. Production project `yafpnqcoyvoclmxdlxxc` was not modified.
