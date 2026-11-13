# V3.5.1 — yalnız header və reklam yerləşimləri

## Yoxlanmış baseline

PR #288 merge edilib. Hazırkı main: `f3d73ecc5ad3d88b48160b69fae862f359a9de00`; tree: `d7f8e3c35cfa8187d4e13de6dd0b45e553986a7c`. Tree V3.5 final `7cc55589a57789228bb3d8854f346a88f0688a7a` ilə eynidir. Ayrı `feat/v351-header-ads` branch və təmiz worktree həmin main-dən yaradılıb; əvvəlki çirkli worktree-lər toxunulmadan saxlanıb.

GitHub Git transport-u bu runner-də 403 qaytarıb. Baseline GitHub connector-u və public Git API ilə təsdiqlənib; rəsmi signed commit payload-ından alınan Git metadata-nın SHA-1-i tələb edilən commit ilə dəqiq yoxlanaraq lokal object bərpa edilib. Tətbiq faylı təxminlə qurulmayıb, köhnə commit seçilməyib və reset edilməyib.

## Mövcud control auditi

| Control | Mövcud contract | V3.5.1 davranışı |
|---|---|---|
| Səbət | austaHeaderCart / austaHeaderCartCount; orijinal boş panel handler-i | Eyni DOM node və listener, monoxrom görünən yazı; tam checkout iddiası yoxdur |
| Mesajlar | austaHeaderMessages; mövcud messages panelinə keçid və ya ilkin məlumat paneli | Saxlanır; yeni chat/realtime mesajlaşma yaradılmır və işlək sayılmır |
| Bildirişlər | austaHeaderNotifications; mövcud provider notification və ya boş status | Eyni handler və count node-ları |
| Dil | austaHeaderLanguage / menu / label; AZ/RU/EN/AR və mövcud seçim saxlanması | Orijinal wrapper/menu ilə köçürülür; görünən utility yazıları mövcud title yenilənməsini izləyir |
| Hesab | headerAccountLink, mövcud Account/Auth lifecycle | Eyni node və ID; native modal/auth məntiqi dəyişmir |
| Elan yerləşdir | austaHeaderAddListing; mövcud router və auth girişi | Sağda yeganə prominent yaşıl header action; handler yenidən yazılmır |
| Qlobal axtarış / məkan | globalSearch/Btn/Panel, locationPicker/Menu | Saxlanır, utility-də kompakt təqdim edilir; GPS sorğusu icra edilmir |
| Yardım | austaHeaderHelp mövcud handler | Sol utility-yə köçürülür; Dəstək mövcud info/contact səhifəsinə həqiqi keçiddir |
| Seçilmişlər | Ayrı header destination/handler yoxdur; kart favorites mexanizmi ayrıdır | Saxta yeni header düyməsi əlavə edilmir |

## Struktur və son sahib rəngi

Sıra: üst reklam → açıq-boz utility → qırmızı əsas menyu. Main fon **#D92D20**, A-USTA branding və menyu yazıları ağdır. “+ Elan yerləşdir” **#176244**, ağ mətnlidir. Utility-də rəngli emoji buttonları gizlədilir; qlobal axtarışın utility action-u neytraldır. Bu yalnız təqdimatdır; original icon/state node-ları silinmir.

Desktop-da beş əsas kateqoriya və qalanları native “Digər kateqoriyalar” disclosure-dadır. Daha dar ekranlarda menyu yığılır; bütün 14 seçim orijinal kateqoriya kartlarından oxunur və həmin kartın click-ini çağırır. Kateqoriya adları/route-ları yenidən tərtib edilməyib. Keyboard Enter/Escape, focus restoration və click-outside bağlanması yoxlanır. Native mobil tətbiq dizaynı yoxdur.

## Reklam auditi və dar extension

Mövcud AUSTA_CATEGORY_CAMPAIGNS API `marketplace_top`, `marketplace_left`, `marketplace_right` configuration və rotation-u dəstəkləyir, lakin category mount əvvəl yalnız iki side slot yaradırdı. Yeni opt-in `placements` array-i əlavə edilib. Default çağırış yenə eyni iki side slot yaradır; category CSS/routing dəyişmir. Eligibility, URL təhlükəsizliyi, tarix/priority, interval clamp, görünmə, hover/focus, pause, reduced motion və dispose alqoritmləri dəyişməyib.

Home üçün ayrı top host və side host həmin API-dən istifadə edir. Yeni kampaniya, advertiser logo, qiymət, imza, impression və remote konfiqurasiya uydurulmur. Mövcud A-USTA house/reklam-yeri copy-si göstərilir; bunlar paid advertiser müqaviləsi deyil. Eyni host-a təkrar mount slot dublikatı yaratmır. Category açıldıqda Home host-ları hidden olur və rotation görünmə qaydalarına uyğun dayanır; category-nin əvvəlki side placement-ləri ayrıca route əhatəsində qalır.

1920 px-də 140 px, 1536 px-də 110 px yan panellər qorunan 1240 px content xaricindədir. **1520 px-dən aşağı yan panellər gizlənir**: 1366/900/768/390-da mövcud axtarış/content eni dəyişdirilmir. Üst banner qalır. Heç bir ad content üstünə yerləşdirilmir və click-i örtmür. Top banner side slot-lardan ayrıdır.

## Qorunan əhatə və test sərhədləri

Axtarış/Premium/kart/category grid/video/mobil promotion/footer/legal səhifələri, Account/Auth, service order/provider, backend/Supabase/RLS/Storage/Render və production settings dəyişməyib. Index-də yalnız iki reference və comment əlavə edilir; mövcud inline handler-lər olduğu kimi qalır. Campaign engine-də yalnız opt-in yerləşim hunk-ı var.

Tarixi qoruma dəqiq suffix və üç asset SHA-256 ilə genişləndirilir; campaign hunk-ı dəqiq reverse-normalize ediləndə əvvəlki engine bit-identical-dır. Bütün köhnə assertions saxlanır; blanket directory istisnası yoxdur. İcazəsiz asset/bootstrap mutasiyaları yenə testləri qırır.

Full-app QA local + TEST `xnhxneziasqthkhhntkv` oxu mapping-i istifadə edir. Production `yafpnqcoyvoclmxdlxxc`-ə qoşulmur; hesab, elan, sifariş və kampaniya data-sı yazılmır. Mövcud utility ilkin panellərinin açılması, yer seçimi, dil, Account və elan girişinin saxlanması real Chromium ilə yoxlanır; bu, tam cart/chat/back-end E2E təsdiqi deyil. Kənar şəkil CSP məhdudiyyəti ayrıca qeyd edilir.

Native before/after 1920/1536/1366/900/768/390 çəkilir. Header-dən aşağı elementlərin computed ölçü/style-ları müqayisə edilir. Yeni header onların şaquli mövqeyini dəyişdirdiyi üçün raster crop-larda subpixel/1px yuvarlaqlaşdırma fərqi ola bilər; bütün alt hissələr üçün yalan pixel-identical iddiası verilmir. Account paneli ayrıca pixel müqayisəsində qorunur.

## Növbəti mərhələ və geri dönüş

Yalnız bu header/ad PR-ı Draft verilir. Sahib vizual təsdiq verməyənədək növbəti homepage bölməsi işlənmir. Merge/deploy yoxdur. Geri dönüş lazım olsa V3.5.1 iki header asset/reference, placements opt-in hunk və onun dəqiq test əlavələri reviewed revert ilə götürülə bilər; DB migration/rollback lazım deyil. Mövcud hüquqi və platforma təhlükəsizlik qapıları dəyişməyib.
