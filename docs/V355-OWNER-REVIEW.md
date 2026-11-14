# V3.5.5 — owner review / production NO-GO

One unified map and one provider opt-in integration are implemented together. No fake production points. Fourth image-based `Yaxın xidmətlər` card reuses existing avtoservis imagery; original three cards, their images and handlers remain. Header/search/listing/Account/video/footer/backend runtime is unchanged.

Map supports sources, city/business search, category controls, manual coordinates, explicit current-location permission, native keyboard dialog, pan/zoom, marker selection, name labels/details, existing profile/service actions, directions and honest loading/empty/error states. Source labels and conservative grouping preserve both business identities. All external values render as text, not HTML.

Default external key is empty; no service activated. Public-provider migration is a proposal, not deployed. Therefore real external discovery and live new Supabase HTTP integration are BLOCKED; screenshots without a key show the actual unavailable state. Synthetic marker tests are labeled isolated fixtures and are not live-data evidence. Production remains NO-GO until owner approval and the gates in the two companion audits are completed.

Review package contains exact source/migration hashes, diff, complete local test/CI logs and six-width native screenshots. Do not merge or deploy automatically.
