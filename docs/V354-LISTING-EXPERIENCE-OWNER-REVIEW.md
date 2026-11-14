# V3.5.4 — Elan yerləşdirmə: owner review

Baseline: `cbb4a8798fcb53a300a5b875579abafc2914c867` (PR #291 merged). V3.5.2 PR #290 is also merged. No overlapping current V3.5.2/V3.5.3 Draft PR exists. Implementation branch: `feat/v354-professional-listing-creation`.

## Scope

Only the existing listing dialog receives presentation changes. The original `AUSTA_V153C` controller, its category select, every field, media inputs, seller selector, edit hydrator, validation, preview and publication pipeline remain authoritative. No backend, database, Storage, Account, authentication, service, header, search, campaign, footer or video implementation changes.

The category cards derive from the actual controller registry, intersected with its select options. Thirteen existing local category images are reused; the dealer card uses neutral A-USTA typography because no approved dealer image exists. An obsolete localStorage-only Usta option injected by V48 is excluded from this presentation; the real canonical `usta` publication remains available. No service-order request category is introduced.

## Category-to-form coverage

| Registry key | Existing form | Existing persistence family |
| --- | --- | --- |
| cars | Avtomobil | vehicle_listings |
| rent | Rent a Car | vehicle_listings |
| parts | Ehtiyat hissələri | marketplace_listings |
| accessories | Aksesuarlar | marketplace_listings |
| moto | Moto / Moped / Skuter | marketplace_listings |
| special | Xüsusi texnika | marketplace_listings |
| bus | Avtobus | marketplace_listings |
| water | Su nəqliyyatı | marketplace_listings |
| caravan | Karavanlar | marketplace_listings |
| trailer | Qoşqu / Treyler | marketplace_listings |
| plate | Qeydiyyat nömrələri | marketplace_listings |
| service | Avtoservislər | service_provider_listings |
| usta | Usta profilləri | service_provider_listings |
| dealer | Avtosalonlar | auto_dealer_listings |

## Interaction contracts

- Adaptive sections show the original direct child nodes in place: basic, category details (when present), media (when mounted), contact/location. `Hamısı` reveals everything. No field clone, serialization or new persistence controller.
- Switching steps and returning to the same category retains the same input/File nodes. Selecting a different category with changed data asks for confirmation; the original category change then rebuilds its own form.
- Required hints mirror the original required map, independently checked by a test. Hints and inline errors add no new publication validation gate. Existing final validation remains authoritative. Original save errors reveal all sections.
- CREATE still uses the existing authenticated preview and confirmation; EDIT still uses its original save behavior and disabled category. Existing media ordering/deletion, file rules and upload progress are preserved, not reimplemented. No unsupported CREATE ordering or resume feature is promised.
- Keyboard focus is trapped in the listing dialog; native Auth/preview dialogs and the existing brand/model selector retain their own keyboard lifecycle. Background controls become inert and prior inert/scroll/focus state is restored.
- Category cards use keyboard-accessible role buttons to avoid legacy global button-text interception. Enter and Space work; no duplicate header or publish handlers are installed.

## Verification and limits

Final commands, counts, screenshot inventory, exact file hashes and CI evidence are included in the external owner-review package. Isolated fixtures exercise original controller declarations and existing security/publication suites. Native-resolution complete-application Chromium checks cover all 14 categories at 1920, 1536, 1366, 900, 768 and 390 pixels with TEST-only runtime configuration.

No production listing, account or order is created. A live authenticated upload/publication/edit round trip is not claimed: that requires an authorized connected test environment and synthetic eligible seller. Previously documented TEST network/backend limitations and unrelated legacy full-page exceptions are reported separately. Existing service-order ownership concerns remain deferred and unchanged.

## Review and release

Draft PR only. Owner visual approval is required before merge. Do not deploy or apply SQL. No migration exists in this change. Rollout: review the native screenshots and category coverage, verify CI, then use the normal separately approved merge/release procedure. Non-destructive rollback: revert only this PR's presentation/bootstrap/test changes; keep all listing data and media. No database rollback or cleanup is required.

## Local final results

- Frontend: **2159 PASS / 0 FAIL / 0 skipped**.
- Isolated DB/RLS contracts: **471 PASS / 0 FAIL / 0 skipped**; no remote SQL executed.
- Focused listing/media/seller/Account/service regression: **631 PASS** (overlaps frontend; not an additional independent total).
- Original Chromium: **2 original top-level tests PASS**, including 16 Dealer subtests (18 TAP assertions). Assertions and original test files unchanged.
- Six new presentation tests cover all 14 registry categories at desktop/mobile, original field identities, late media, retained files, edit hydration, native Auth, real brand/model picker, mutation guards and category-change cancellation.
- Complete-application read-only browser navigation: **84 PASS** (14 categories × 6 widths), no uncaught page exceptions; native before/after screenshots retained. Third-party image CSP messages and unavailable TEST network are isolated-environment limitations, not successful live-data verification.
- Static syntax/catalog gate PASS; 213 brands / 822 models.

The historical homepage/service protection tests now permit only the two exact new listing-presentation paths, each independently SHA-256 checked. All prior protected paths/assertions remain. File mutation and bootstrap mutation checks still fail on unauthorized changes. No blanket directory exception.
