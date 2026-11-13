# V3.5 — kompakt ana səhifə və inteqrasiya olunmuş footer

## Baseline və əhatə

PR #287 13 noyabr 2026-da merge edilib. Yoxlanmış main: `197c8eaec423f1fac5a6656202c2b10bb15d7ba1`, tree `58566d679f97a47b79eec6a6272da1b434c3be70`. Bu tree PR #287-nin son `8495c8030e9cad4bae8e2ced843da4f10d1208bd` namizədi ilə eynidir. Ayrı `feat/v35-premium-homepage` worktree/branch yaradılıb; əvvəlki çirkli worktree-lər qorunub. PR #287 yenidən açılmır və dəyişdirilmir.

Bu mərhələ təqdimat qatıdır. V3.4 renderer/config/əlaqə və hüquqi mətnləri dəyişməyib. İki dar V3.5 asset əlavə edilir: layout CSS-i və mövcud düyünləri yenidən yerləşdirən composition script-i. Index-in mövcud inline skriptləri dəyişməyib; yalnız iki asset reference əlavə edilib. Yeni dependency yoxdur.

## Referens → A-USTA qərarları

| Sahib referensi | V3.5 tətbiqi | Qorunan sərhəd |
|---|---|---|
| Turbo.az üst hissəsi: sıx axtarış və birbaşa Premium kartlar | 1240 px mərkəzi axtarış/Premium sahəsi, 42 px desktop inputlar, sıx header, axtarışdan dərhal sonra dörd sütun kart | Başqa markanın loqosu, qırmızı identik panel, copy və artwork götürülmür; A-USTA yaşıl/ölçülü qırmızı brendi saxlanır |
| Kompakt tətbiq/footer referensi | Desktop 148 px telefon, solda “Hər şey bir tətbiqdə!”, bir sıra planlaşdırılan store kartları, sağda real QR | Mövcud genuine A-USTA preview və QR faylları bit-identical; aktiv download/deep link yoxdur |
| Cari A-USTA-nın geniş axtarış və aralıqları | Şaquli boşluq azaldılıb; bütün orijinal xidmət düymələri və kateqoriyalar saxlanıb | Original search normalize/delegation dəyişməyib |
| Cari böyük telefon | Telefon bütöv kadrla xeyli kiçildilib; QR oxunaqlı saxlanıb | QR quiet zone və həqiqi məqsəd URL-i qorunur |
| Ayrılmış məlumat sütunları | Promotion və footer eyni açıq-boz səth, eyni alignment, kiçik separator və sıx sütunlar | Mövcud sibling DOM müqaviləsi, 16 link, əlaqə config-i, email pending, WhatsApp-only saxlanır |

Altı ölçü: 1920, 1536, 1366, 900, 768, 390. Premium 4 desktop, 3 dar tablet, 2 mobil sütundur. 213 marka desktop 7, tablet 5, mobil 3 sütunda göstərilir; mobil collapse və gizli marka yoxdur. Mobil marka düymələri və footer keçidləri ən azı 44 px hədəflidir. Orijinal uzun adlar wrap edir; say yoxdursa mövcud dash/retry qalır.

## Loader və DOM təhlükəsizliyi

- Orijinal `austaV151Marketplace` bütöv halda axtarışdan sonra köçürülür; kartlar, sentinel, retry və event listener-ləri əvəz edilmir. Orijinal loader, pagination, eligibility, media, dedup və query-lər həmin qaydada işləyir.
- Premium başlığı məlumatdan asılı olmadan yerini bildirir. Əlavə boş/xəta izahı yalnız orijinal loader/retry/end və grid vəziyyətindən alınır. Yeni API çağırışı, siyahı, qiymət və say yaradılmır. Məlumat yüklənərkən boş nəticə iddiası göstərilmir.
- Kateqoriya açıldıqda header-in V3.5 Home scope-u söndürülür; mövcud kateqoriya dizaynı və kanonik kart renderer-i dəyişmir.
- Account/Auth, şəxsi avtomobil/servis, xidmət sifarişləri/provider, video feed, listing upload/edit/publish, backend/SQL və production konfiqurasiyası dəyişməyib.
- V3.4 tarixi guard-ları dəqiq iki yeni asset SHA-256 və dəqiq suffix ilə genişləndirilib. Köhnə assertions saxlanır, icazəsiz asset/bootstrap mutasiyası yenə rədd edilir; blanket directory istisnası yoxdur.

## Məlumat və nəşr sərhədləri

Full-app browser QA yalnız local fayllar və TEST `xnhxneziasqthkhhntkv` oxu sorğularına yönəlib. TEST-də aktiv Premium elan yoxdur. Buna görə real səhifə screenshot-ları boş/loading vəziyyətini dürüst göstərir. Kart ölçü/qiymət/metadata təqdimatı ayrıca kanonik renderer-dən istifadə edən, açıq “QA — sintetik düzülüş testi, real elan deyil” nişanlı browser fixture-də yoxlanılır. Bu fixture məlumatları tətbiqə, TEST DB-yə və production-a yazılmır və real elan kimi təqdim edilmir.

Təcrid CSP-si kənar şəkilləri bloklaya bilər; belə resource xətaları real backend verification kimi PASS deyil. UI və şəbəkə nəticələri paketdə ayrılır. Üç orijinal xidmət girişinin formaları altı ölçüdə açılıb, heç bir sifariş göndərilməyib.

Store artwork hüquqları/app linkləri hələ təsdiqlənmədiyindən orijinal neytral device vizualları və “Planlaşdırılır” statusları qalır; rəsmi badge təqlidi yoxdur. Domen/email aktivləşdirilmir. V3.4.4 hüquqi təsdiq qapıları, məxfilik/kommersiya baxışı və disclaimer-in hüquqi statusu dəyişməyib.

## Owner review və geri dönüş

Yeni PR Draft olmalıdır. Sahib altı viewport-un native before/after screenshot-larını və referens müqayisələrini təsdiqləməlidir. Texniki test PASS hüquqi və ya production release icazəsi deyil. Merge/deploy edilmir. Geri dönüş üçün yalnız bu composition asset-ləri/references və onların dəqiq test patch-i ayrıca reviewed revert ilə götürülə bilər; DB rollback lazım deyil. Əlaqəsiz worktree-ləri reset etməyin.
