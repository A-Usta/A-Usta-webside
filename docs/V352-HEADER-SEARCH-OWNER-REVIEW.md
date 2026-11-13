# V3.5.2 — Header, axtarış və elan girişi

Baseline: main `1765a62a3a91de5e948a0177d1fd5f4173103011`, PR #289 merged; tree `bfc8d408b7929e58ae7637d986a1b7559e3701d0`. Ayrı təmiz worktree/`feat/v352-header-search-filters-polish` branch; əvvəlki staged işlər toxunulmadan saxlanıb. Git transport əvəzinə GitHub/public Git API metadata istifadə edilib; signed baseline commit object hash-i dəqiq yoxlanıb, source təxminlə qurulmayıb.

## Təqdimat

Utility: Dəstək/Yardım → geniş mövcud globalSearch → yaşıl #176244 action → mövcud idarəetmələr → avatar/Hesab. 14px yazılar, 40px control hündürlüyü. Original ID/node/listener-lər saxlanır. Mobil sətirlər uyğun wrap olur; location control da saxlanır. Ayrı Seçilmişlər header destination-u yoxdur; saxta yeni feature əlavə olunmur.

Qırmızı #D92D20 əsas menyuda original 14 kateqoriya kartından sıra oxunur. Mövcud düymələr faktiki enləri ölçülərək mümkün qədər nav-a, qalanları disclosure-a yerləşdirilir; resize/font/language dəyişikliklərində hesablanır. Orijinal click routing-i, Escape və focus saxlanır.

Avatar mövcud `AUSTA_SUPABASE` client-in `auth.getUser()` nəticəsi ilə yalnız həmin istifadəçinin `profiles.avatar_url` sahəsini owner ID ilə oxuyur. Auth sisteminə alternativ yoxdur; hesab/session/password/RLS dəyişmir. Loading/logout/error dərhal boz fallback edir; epoch/client yoxlamaları köhnə async nəticəni rədd edir. HTTPS URL, credentials-siz, no-referrer image, broken-image fallback; signed/public URL yaradılmır, email/ad göstərilmir. Profil şəkli yalnız mövcud RLS-in icazə verdiyi owner lookup-dan alınır.

## Filtr müqaviləsi auditi

2026-11-14 Bakı tarixində production `yafpnqcoyvoclmxdlxxc` və TEST `xnhxneziasqthkhhntkv` yalnız `information_schema.columns` SELECT ilə yoxlanıb. Heç bir məlumat/DDL/Auth/Storage yazılmayıb. Aşağıdakı bütün sütunlar hər iki mühitdə mövcuddur.

| UI | public.vehicle_listings | Mövcud query |
|---|---|---|
| Marka / Model | brand / model text | normalize, ilike; catalog brand→model reset |
| Qiymət | price numeric | gte/lte |
| İl | year integer | gte/lte, integer validation |
| Yeni / Sürülmüş | vehicle_condition text | eq new/used, technical registry choices |
| Şəhər / Region, Rayon | region / district text | escaped ilike; vahid municipality ID facet uydurulmur |
| Ban növü | body_type text | escaped ilike; saxta enum yoxdur |
| Yanacaq / Qutu | fuel_type / transmission text | eq; existing technical registry |
| Mühərrik həcmi | engine_volume numeric | gte/lte |
| Yürüş | mileage integer | gte/lte, integer validation |
| Rəng | color text | escaped ilike; saxta enum yoxdur |
| Kredit / Barter | credit_available / barter_available boolean | eq true/false |

Yeni controls original Home form daxilindədir. Orijinal submit artıq FormData-nı `AUSTA_CATEGORY_FILTERS.normalize('cars',...)` vasitəsilə `openCategory('cars',filters)`-ə verir; nəticələrdə original V154-E query `applyQuery`-ni sort/slice-dan əvvəl çağırır. Submit/reset handler-i, query builder, API və DB dəyişmir. Boşlar nəzərə alınmır, mənfi/integer/range və choice validation saxlanır. Reset əlavə sahələri də silir və paneli bağlayır. Brand dəyişəndə model reset mövcud handler-lə işləyir.

Mövcud route filter vəziyyətini callback/pagination içində saxlayır; reload üçün URL/query serialization yoxdur. Yeni history/URL contract əlavə edilmir. Null texniki sahəli legacy elanlar explicit filtrə uyğun gəlməyə bilər; bu, mövcud SQL predikat semantikasıdır. Live nəticə sayı və yeni test elanları uydurulmur.

## Reklam auditi

Aktiv remote kampaniya setup-ı yoxdur; setCampaigns yalnız mövcud engine/testlərdədir. Üç slot üçün bir açıq `Reklam sahəsi` rezerv elementi verilir; olmayan kommersiya kampaniyaları rotasiya olunmur. Mövcud singleton engine timers/visibility/focus/hover/reduced-motion/pause/dispose istifadə edilir. Home host-larında previous/next düymələri DOM-dan götürülür; gələcək çoxlu approved banner üçün pause saxlanır. Yeni timer yaradılmır. Gələcək real assets task-ı `AUSTA_CATEGORY_CAMPAIGNS.setCampaigns(slot, reviewedItems)`-i bu bootstrap-dan sonra çağırmalıdır; URL/media/date eligibility engine-i dəyişməyib. Mənbə olaraq sponsor/asset/link yoxdur.

## Elan girişi auditi

Original header Add handler → `AUSTA_V153C.open` → original `austaV153COverlay`/`austaV153CCategory` → CATEGORIES tərəfindən mövcud fields render-i → validation/preview və mövcud Auth/seller yoxlamaları → staged persistence/media/activation. V3.5.2 original select-i və seçimlərini saxlayır; yalnız əlaqəli kömək mətni/aria-describedby və header/category-label/select CSS əlavə edir. `austaV153CFields`, seller-intent/verification, upload, preview, save və publish handler-lərinə toxunulmur. Yeni category picker/flow yaradılmır.

## Yoxlama sərhədləri

Yeni Chromium testləri: 6 viewport, original node/handler/color/overflow/category-order yoxlamaları; original normalize/applyQuery predicate müqaviləsi; validation/reset/model dependency; static reserved ads və synthetic-only multi-campaign timer/pause/reduced-motion; owner avatar/stale/logout/language; original listing select event preservation; exact protected-file scope və independent mutation guard.

Full-app native screenshots TEST-only mapping və production block ilə çəkilir. Authenticated avatar race və listing select testləri isolated fixtures-dir; canlı authenticated upload/publication E2E kimi təqdim edilmir. Heç bir production elan/sifariş/hesab yaradılmır. Account/Auth/service/backend/vehicle/campaign engine, footer/promotion/Premium/video mənbələri dəyişmir. Mövcud service_orders.vehicle_id riski ayrıca əvvəlki məsələdir; bu işdə dəyişmir.

Owner visual review tələb olunur. Yeni PR Draft; merge/deploy yoxdur. Rollback gələcəkdə bu presentation adapter + suffix və dəqiq guard əlavələrinin reviewed revert-idir; migration/DB rollback tələb etmir. Mövcud hüquqi/email/domain approval gate-ləri dəyişmir.

## Yekun lokal nəticələr və canlı-read sərhədi

Frontend 2141 PASS, DB/RLS 471 PASS, fokuslanmış 107 PASS (suite-lər üst-üstə düşür, saylar toplanmır). İki original Chromium testi tam frontend run-da icra olunur. Yeni 11 Chromium testinə resize zamanı menu yenidən bölünməsi və profil oxuma error fallback-i də daxildir.

Real tam-app brauzerindən müşahidə olunan GET vehicle_listings sorğusunda status=active/listing_type=sale ilə əlavə mileage, engine_volume, fuel_type, transmission, body_type, vehicle_condition, credit_available, barter_available və region predikatları həqiqətən yaranır. Bu runner-də həmin brauzer sorğusu `net::ERR_CERT_AUTHORITY_INVALID` səbəbindən BLOCKED-dir. Eyni müşahidə olunmuş query normal TLS doğrulayan curl vasitəsilə yalnız TEST-də HTTP 200/boş nəticə qaytarıb; bu, brauzer TLS uğuru və ya matching real fixture coverage iddiası deyil. TLS yoxlaması production/client kodunda dəyişdirilmir.

Native vizual QA əvvəlki harness-in isolated TEST proxy kontekstini istifadə edir; orada ignoreHTTPSErrors yalnız QA kontekstidir, production ayarı deyil. Kənar stock media intentional CSP ilə bloklana bilər; console resource/CSP xətaları tətbiq JS pageerror-u ilə qarışdırılmır. Signed-in avatar, stale session və elan select event testləri synthetic isolated browser fixtures-dir; real login/upload/publish əməliyyatı yoxdur.
