# M7 TEST backend readiness

Audit date: 2026-11-21. This is a read-only readiness record; no TEST or production schema, rows, Storage objects, or Render settings were changed.

## Environment boundary

- The Supabase TEST project is `A-USTA-TEST`, ref `xnhxneziasqthkhhntkv`, status `ACTIVE_HEALTHY`, region `eu-central-1`, Postgres 17.11.
- Production is a separate project, `A-Usta`, ref `yafpnqcoyvoclmxdlxxc`. No production query that writes data was issued.
- The Render workspace selected by the owner contains one web service: `A-Usta-webside`, branch `main`, URL `https://a-usta-webside.onrender.com`. No separate TEST API service exists.
- A public TEST Supabase key exists, but no TEST client configuration is installed in local or EAS runtime. The secret TEST service-role key is not available in this work context and must never be copied into the mobile app or repository.

## TEST schema and policy audit

- The TEST project reports 13 applied migrations, with the most recent migration `v38_seller_messaging`. Its TEST bootstrap uses TEST-specific migration versions/names for several canonical bootstrap and personal-vehicle dependencies.
- The M1–M5 tables required by this branch are present, including listings/media, service orders/assignments, seller data, messages, `vehicles`, service records, and attachment metadata.
- All audited `public` application tables have RLS enabled. Owner-scoped policies are present for listing writes, favorites, service orders, vehicles, service records, and attachment metadata.
- All eight Storage buckets are private. `vehicle-service-evidence` accepts JPEG/PNG/WebP/PDF and caps objects at 10 MiB. Attachment policies re-check the vehicle owner and service-record relation.
- No M7 migration was found to be required from this read-only schema comparison, and no migration was applied.
- The Supabase advisor reports: one SECURITY DEFINER view; three functions with mutable `search_path`; 15 SECURITY DEFINER functions executable by `anon`; 39 executable by `authenticated`; leaked-password protection disabled; and 10 RLS-enabled tables without policies. Some findings may be intentional trigger/RPC or fail-closed internal schemas. The service-provider view's migration documents its SECURITY DEFINER design and field redaction. M8 should review each finding against intended grants and run authenticated negative tests before any changes.

## Separate TEST API deployment plan

Create a separate Render web service only after the TEST service-role secret has been entered securely in Render:

- Workspace: `My Workspace` (owner-selected).
- Repository: `A-Usta/A-Usta-webside`; branch: `feat/v40-mobile-app-foundation` (or the exact reviewed commit).
- Root directory: `backend/a-usta56`; runtime: Node; build: `npm ci --include=dev && npm run build`; start: `npm start`; health route: `/health`; region: Frankfurt to match the TEST database region.
- TEST-only environment: `SUPABASE_URL=https://xnhxneziasqthkhhntkv.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY` from this TEST project only, and `CORS_ORIGINS` containing exact local/TEST web origins. Render supplies `PORT`.
- The backend service-role value is absent here. Do not substitute the anon key or production key. No endpoint hostname has been invented.
- `CORS_ORIGINS` now accepts only explicit comma-separated HTTP(S) origins; when unset, the existing production origin allowlist remains unchanged.

The mobile app additionally needs `EXPO_PUBLIC_APP_ENV=test`, the TEST Supabase URL and public anon key, and `EXPO_PUBLIC_SERVICE_API_URL` set to the actual TEST API URL after deployment. These public values belong in the TEST EAS environment, not in source. A local/branch web app must also be configured for the same TEST project/API; the production website stays on production services.

## E2E gate

No User A/User B accounts or test rows were created. The E2E matrix remains blocked until there is an actual TEST API URL, the TEST server secret is securely configured, the TEST client env is available, and two disposable accounts can authenticate. Once available, run the owner/visibility, cross-user denial, listing/media, favorites, messaging, service-order/provider lifecycle, garage/history/attachment/reminder, business eligibility, logout, and session-restoration scenarios against both clients; verify persisted responses and clean only those test-owned records.

Native APK/Simulator execution also remains blocked by EAS authentication and missing local Android SDK/Xcode. JavaScript exports do not satisfy this gate.
