# V3.4 homepage/footer audit and design

Baseline main 27e92185ed3f88d98830b8b75531417a98c5baba; tree 01662644a621385c30366ad640d1a72607d2675c (contains merged V3.3D.3). Separate worktree; prior staged Account work preserved.

References inspected: owner Turbo.az homepage (three pages), Mercedes-Benz dealer (three pages). Use density, neutral surfaces, price/title hierarchy, promotion scale and organized footer only. No Turbo branding, legal text, phone, dealer claims, artwork or listings copied.

Existing contracts: #home, #austaTopUrgentV24, #austaV107FunctionsToggle, category buttons, #austaV22VideoGrid, #austaV151Marketplace; AUSTA_V151_MARKETPLACE.openCategory and AUSTA_CATEGORY_FILTERS.normalize; canonical vehicle catalog and vehicle_sale_brand_counts RPC; existing rotating category campaigns. Existing footer has placeholder contacts and repeated anchors. Brand catalog currently follows footer. Auth/Account, Usta forms, V159/163/164, backend and SQL must remain byte-identical.

Design: compact neutral search delegating to existing filters, three visible service entry points (mechanic delegates to original button; two transport handlers unchanged), denser existing category tiles, unchanged video functionality, restrained Premium card typography. Full-width light promotion with real mobile website screen inside original generic CSS device, actual website QR, upcoming stores. Four footer groups, original Azerbaijani information/help page, canonical searchable multi-column brand directory reparented inside footer without replacing its API/events or counts.

## Missing owner inputs / publication gates
- Verified legal operator identity, support and commercial contacts, privacy retention/legal basis, request process, moderation/payment terms: no invented contacts or obligations. Legal sections explicitly pending approval; not binding legal documents. No contact submission falsely claimed.
- No published app IDs, developer program entitlement or licensed official artwork supplied. Apple terms allow badge only for available apps while program member: https://developer.apple.com/app-store/marketing/guidelines/ . Huawei badge tied to app link: https://developer.huawei.com/consumer/en/doc/appgallery-connect-guides/agdlink-getlink-agc-0000001164321881/ . Google official hub: https://partnermarketinghub.withgoogle.com/brands/google-play/google-play/lockups-icons-badges/ . Therefore official download artwork is NOT rendered pending permitted assets; neutral upcoming store names shown. No fake icons or download links. This requested visual item remains BLOCKED, not complete. Config supports later approved local badge + published HTTPS destination; never activate automatically or guess an app ID.
- QR uses current working GitHub Pages website, not unlaunched a-usta.az. Destination is public site; tests decode locally without invoking production API mutations.

No production/backend/Auth/Storage/SQL changes. Owner-review PR only. Legal/contact and official-badge publication remain gated; no merge/deploy authorized.
