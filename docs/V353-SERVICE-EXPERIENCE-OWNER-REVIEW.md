# V3.5.3 — xidmət təcrübəsi və Home təqdimatı

## Baseline və əhatə

PR #290 artıq merged-dir. Main HEAD `ba3eb6207bbc7104ed2040d444e8c551d7b724eb`; tree `84799a54e41841a09602195840621ffe2137d70d`. Təmiz `feat/v353-service-experience` worktree/branch bu baseline-dan yaradılıb; əvvəlki dirty/staged worktree-lər saxlanılıb. Git transport-un əvvəlki 403 məhdudiyyətinə görə public Git API ilə signed commit metadata hash-i yoxlanaraq lokal object təmin edilib; source təxminlə qurulmayıb, reset edilməyib. Başlanğıc açıq PR inventarı ayrıca evidence-dədir.

Dəyişikliklər xidmət təqdimat adapteri/CSS, iki read-only category-name export-u, final bootstrap və dar regressiya qoruma əlavələridir. Header/utility/global search/advanced filter, Account/Auth, marketplace cards, seller/listing/media lifecycle, video core, campaigns, promotion/footer/legal, backend/DB/Render source-u dəyişmir.

## Canonical kateqoriya auditi

Aktiv mexanik sual mənbələri index.html daxilində V54 `Q` (29 ad) və V55 `FORMS` (7 ad)-dır. V55-in müqavilə/zəmanət formaları mexanik kateqoriya deyil; digər 5 forması ilə birlikdə **34 fərqli sual forması** var. Adlar `Object.freeze(Object.keys(...))` ilə mövcud public API-yə yalnız oxunan name array kimi əlavə olunur. Suallar, seçimlər və funksiya gövdələri dəyişmir; UI-də ikinci sual registry-si saxlanmır. Mövcud canonical adlar (məsələn, Karopka/Fren sistemi/Elektrik) yenidən adlandırılmır; olmayan ayrıca Asqı kateqoriyası uydurulmur (Asqı mövcud Təmir formasında seçimdir).

V54: Sükan sistemi – Hidravlik; Filtr təmizlənməsi; Bufer təmiri; Benzin nasosu təmiri; Elektrik; Çilingər; Fara təmiri; Tuning; Kuzov; Görünüş; Açar təmiri; Avtoyuma; Mühərrik; Karopka; Fren sistemi; Təkər; Razval; Balans; Akkumulyator; Katalizator təmiri; Press təmiri; Polirovka; PPF / Wrap; Malyar; Dəmirçi; Yağ dəyişimi; Kondisioner; Proqramlaşdırma; Diaqnostika.

V55 əlavə mexanik formaları: Usta çağır (problemi dəqiqləşdirmək üçün mövcud ümumi forma), Turbo təmiri, Forsunkaların yuyulması, Təmir, Alışdan əvvəl yoxlama. Qapı açılması → Açar təmiri, Stage 1/2/3 → Tuning kimi əvvəlki aliaslar orijinal handler-lərdə qalır; UI-də ayrıca duplicate kateqoriya yaradılmır. Köhnə panelin qeyri-mexanik hüquq/xaricdən sifariş düymələri picker-in “Digər mövcud xidmətlər” hissəsindən orijinal düymənin click-inə ötürülür.

## İcra və accessibility

Original şəkilli Usta kartı əvvəlki handler vasitəsilə generic V55 formunu açır. Təqdimat adapteri həmin form node-unu yadda saxlayıb seçim ekranını göstərir. Seçim mövcud `AUSTA_V54.openService`/`AUSTA_V55_PROTECTED.openProtected` API-sinə gedir. Yeni submit handler, endpoint, order payload, auth yoxlaması və ya order state yaradılmır. V54/V55 formaları yenidən qurulmur; geri dönüşdə eyni DOM node və onun input/file/onsubmit state-i bərpa edilir. Bağlananda draft references silinir; localStorage-a əlavə draft yazılmır.

Kateqoriya seçimləri keyboard Enter/Space ilə işləyən role=button control-larıdır. Bu, köhnə window-capture handler-lərin plain button text-ni ikinci dəfə tutmasının qarşısını alır; həmin protected handler-lər dəyişdirilmir. Escape, fokus sərhədi və bərpası, background inert və native close/back saxlanır. Service layer-in original 2147483647 z-index-i saxlanır: Account üzərində görünür, mövcud native Auth dialog.showModal top layer-i isə onun üzərindədir. Auth aktiv olanda service focus trap/inert yenilənməsi dayandırılır; Account/Auth mənbələri dəyişmir. Ağ/light-gray formalar, green primary, accessible contrast, responsive 3/2-column kateqoriya grid, mobile bir sütun questionnaire. Debug-only başlıqlar gizlənir, müştəriyə aid sual/field/result container silinmir.

Evakuator/Yükdaşıma click-ləri əvvəlki V32 `directTransport` axınına gedir. Field node, ID, options, min/max, type, validation, hesablamalar və submit funksiyası eynidir. GPS barədə gələcək implementasiya/debug mətni faktiki vəziyyəti izah edən təqdimat mətni ilə əvəz olunur; GPS/route/price uydurulmur.

## Home cleanup və şəkillər

Home-only Premium block, functions toggle/panel və image-based listing grid artıq render olunmur. Category routing üçün istifadə olunan original nodes/IDs/handlers saxlanır; onlara bağlı header düymələri və category Premium/VIP imkanları qalır. Shared loaders/aliases silinmir və rewrite edilmir. Köhnə #austaAllFunctions linki yeni service picker-ə, #austaV107ListingCategories linki mövcud header navigation-a yönələn scroll-a adaptasiya edilir; footer source/design dəyişmir. Video host/card/action source-u olduğu kimi qalır; redundant bölmələrin aralıqları aradan qalxır.

Üç original service kart node-u və CSS image assets dəyişmir: `assets/austa-home/usta-profilleri.webp`, `evakuator.webp`, `yukdasima.webp`. Heç bir yeni stock/icon/text-only kartla əvəzlənmə yoxdur. Test/visual evidence actual computed background-image URL-lərini müqayisə edir; canonical asset source-u dəyişməyib.

## Təhlükəsizlik və əvvəlcədən mövcud blocker-lər

1. Aktiv V32 transport form submit-i lokal storage axınıdır; bu milestone onu real backend order integration kimi təsdiqləmir. Ayrıca icazəli integration/security task-ı tələb olunur.
2. Cargo başlığı 150–300 kq göstərsə də original `v32Kg` input max=3000 və price calculator >300 üçün legacy məntiq saxlayır. Bu uyğunsuzluq burada biznes-rule dəyişməklə ört-basdır edilmir; ayrıca owner qərarı lazımdır. Yeni tutum/qiymət müqaviləsi elan edilmir.
3. Native xidmət media bridge-i bəzi form inputlarını şəkil kimi təqdim edir; seçim saxlanması test olunur, live upload/persistence bu scope-da təsdiqlənmir. Sualların initial image/video file acceptance müqaviləsi dəyişmir.
4. service_orders.vehicle_id ownership riski əvvəlki ayrıca təhlükəsizlik məsələsidir. Auth/RLS/provider assignment/status/accept/reject/cancel/start/complete dəyişmir.
5. TEST backend/TLS/media məhdudiyyətləri səbəbindən real sifariş submit/live provider E2E PASS iddiası verilmir. Production sorğusu/sifarişi/hesabı yaradılmayıb.

## Qoruma və testlər

İki export-un dəqiq reverse-normalization-u mövcud V54 question-bank SHA-256 və V55 protected-dispatch SHA-256 gözləntilərini saxlayır. Heç bir blanket istisna və yeni sual/funksiya baseline hash-i yoxdur. Export xaricində bir byte dəyişmə köhnə qoruma/mutation testlərini qırır. Yeni mutation sübutu V54 sualını və V55 dispatch nəticəsini dəyişəndə guard failure göstərir.

Lokal nəticələr: frontend 2153 PASS, DB/RLS 471 PASS, fokuslanmış 119 PASS; suite-lər üst-üstə düşür. 12 yeni browser testində 6 viewport, bütün 34 canonical form snapshot-u, required/choice/type/accept müqavilələri, geri dönüşdə synthetic text/file selection, transport estimates/field retention/error validation, duplicate overlay, close/Escape və exact protected-source scope yoxlanır. İki original Chromium testi frontend suite-də dəyişmədən icra edilir. İlk test fixture encoding/mutation targeting səhvləri fixture-də düzəldilib; assertion-lar skip və ya zəiflədilməyib.

## Rollout / rollback

Yeni PR Draft saxlanmalıdır. Sahib 6 ölçüdə Home/3 xidmət/before-after şəkillərini təsdiqləməlidir. Bu UI milestone production-ready transport/order təsdiqi deyil. Merge/deploy/SQL yoxdur. Geri dönüş presentation asset/suffix və iki read-only export əlavəsinin reviewed revert-idir; data migration və DB rollback tələb olunmur.
