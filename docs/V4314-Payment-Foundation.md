# V4.3.14 — maliyyə auditi və provayder blokerləri

## Audit nəticəsi

- PR #319 branch tarixçəsi və əlçatan `main`/əvvəlki commit-lər yoxlanıldı. Köhnə web sifariş formalarında `paymentMethod` seçimi/payload sahəsi var; bu, ödəniş təsdiqi, pul hərəkəti və ya üçtərəfli hesablaşma deyil.
- Cari repo-da maliyyə funksiyası kimi yalnız V4.3.3 elan tanıtımı üçün pending payment intent mövcuddur. O, provider çağırmır və elanı ödənişsiz aktivləşdirmir.
- TEST Supabase `xnhxneziasqthkhhntkv`: `public.service_orders`, `public.service_order_assignments` cədvəlləri mövcuddur. Wallet, balance, commission, settlement, top-up, payout və service-payment ledger cədvəli/RPC-si tapılmadı. Yeganə uyğun tətbiq RPC-si `austa_create_promotion_payment_intent`-dir.
- Merchant hesabı, bank sandbox credential, seçilmiş provider, tokenization SDK, split settlement/submerchant API və verified webhook müqaviləsi repo və TEST DB auditində tapılmadı; Render məxfi env dəyərləri yoxlanmadı.

## Bu branch-dəki təhlükəsiz əsas

- `service_orders.payment_method` yalnız `card`/`cash` saxlayır; başlanğıc `payment_status=unconfigured` olur. Seçim heç bir ödənişi uğurlu saymır.
- Komissiya tarif cədvəli boşdur və default `active=false`; mövcud faiz uydurulmayıb.
- Wallet cədvəli, owner read RLS, append-only ledger, token-only kart metadatası, pending top-up intent və provider event idempotency cədvəli əlavə edilir.
- Komissiya rezervi, settle və cancel-release funksiyaları yalnız `service_role` üçündür, `FOR UPDATE` lock-lardan və unikallıq/idempotency məhdudiyyətlərindən istifadə edir. Tarif, sifariş məbləği, wallet və accepted provider assignment yoxlanır. Card settlement provider adapter gəlməyənə qədər rədd edilir.
- TEST-də migration və idempotency düzəlişi tətbiq olunub. Read-back: 0 tarif, 0 wallet, 0 ledger sətiri; browser role-ları rezerv funksiyasını çağıra və provider tokenini oxuya bilmir; yalnız masked kart metadatası oxuna bilər.
- Wallet kabineti serverdən balans, rezerv, settle edilmiş sifariş qazancı, tutulmuş komissiya və son 50 ledger əməliyyatını oxuyur. Kart əlavə etmə və balans artırma UI hazırda bağlı status göstərir; kart nömrəsi və CVV tətbiqdə və DB-də toplanmır.
- Backend `paymentReadiness` fail-closed, webhook HMAC verifier exact raw bytes üzərində signature müqayisəsi edir. Heç bir provayder seçilmədiyi üçün checkout/top-up webhook endpoint-i və canlı pul axını yoxdur.

## Sifariş/settlement inteqrasiyasında qalan iş

TEST migration-ı mövcud sifariş status keçidlərinə DB trigger-ləri ilə qoşur: usta qəbulunda komissiya rezervi, təsdiqlənmiş qiymət dəyişəndə rezerv fərqinin yenilənməsi, tamamlanmada bir dəfə tutulma, ləğvdə rezervin azad edilməsi. Bu keçidlər sifariş statusu ilə eyni transaction-da işləyir. PGlite regresiyası qəbul, repricing, completion, cancellation, paralel eyni request id, təkrar settle/release, dəyişdirilməz ledger, aktiv tarifin yoxluğu, balans çatışmazlığı və kart provayderinin yoxluğunu yoxlayır.

Aktiv tarif seed edilməyib. Buna görə yeni qəbul olunan sifariş üçün balans rezervi tarif və kifayət qədər wallet balansı konfiqurasiya olunana qədər fail-closed qalır. Card checkout, top-up və tokenizasiya UI-da bağlıdır. Ümumi HMAC verifier testlidir, amma seçilmiş banka uyğun webhook endpoint/adapter, provider event mapping və sandbox sınağı yoxdur. Bu mərhələdə provider-backed ödəniş və üçtərəfli bank hesablaşması BLOCKED-dir.

## Bankdan tələb olunacaq məlumatlar

Seçilmiş bank/provider üçün A-USTA MMC adından:

1. Merchant/acquirer müqaviləsi, hüquqi şəxs sənədləri, VÖEN, hesablaşma IBAN və TEST merchant ID.
2. Sandbox host, client ID/secret və API versiyası; TEST kartlar və 3-D Secure qaydaları.
3. Marketplace/agent modelinə icazə; usta alt-merchant onboarding/KYC və üçtərəfli split settlement dəstəyi.
4. Komissiya/wallet hold, ustaya payout, payout cədvəli və bank hesabı dəyişmə doğrulaması.
5. Hosted checkout və tokenization API; server tokeni, saved-card silinməsi, SCA/3DS, PAN/CVV-nin A-USTA serverindən keçməməsi.
6. HMAC/asimmetrik webhook imza qaydası, raw-body canonicalization, event ID/retry qaydaları və sandbox webhook secret.
7. Void/cancel, partial/full refund, chargeback/dispute, duplicate webhook, gecikmiş/uyğunsuz settlement proseduru.
8. AZN settlement, provider fee, holdback/reserve, limitlər, transaction idempotency və payout API imkanları.

Bu məlumatlar və real komissiya tarifi təsdiqlənmədən live ödəniş açılmır. Production və EAS build istifadə olunmayıb.
