# V3.4.4 — hüquqi mətn və məxfilik üzrə sahib baxışı

Başlanğıc: 535cdbacedd80b0e2ba5a1f18ebdeafb4cda14d3, mövcud Draft PR #287. Bu sənəd hüquqi uyğunluq rəyi, production release və ya müqavilələrin qüvvəyə minməsi deyil.

## Hazırlanmış məzmun

info/index.html-də 16 mövcud destination/ID saxlanır. Haqqımızda, reklam, istifadəçi razılaşması, məxfilik, qaydalar, elan qaydaları və şikayətlər tamamlanıb. Orijinal Azərbaycan dili copy-si yazılıb; başqa bazarın sənədi köçürülməyib. CSS, menu script-i, footer/mobil banner/QR/kataloq/Account/Auth/xidmət axınları dəyişməyib. Şirkət/əlaqə mövcud vahid konfiqurasiyadan gəlir; email hələ aktiv deyil.

İstifadə layihəsi A-USTA-nın platforma əməliyyatlarını müstəqil satıcı/icraçı və müştərinin rolundan ayırır, öz üzərinə ayrıca götürdüyü xidmətlərin ayrıca açıqlanmasını tələb edir. Hər seller/elan/təmir yoxlanılıb, nəticə zəmanətlidir, bütün məsuliyyət istifadəçidədir, bütün xidmətlər pulsuzdur və ya ödənişlər sığortalanıb kimi iddialar yoxdur. Moderasiya/etiraz prosesi mövcud və tam işlək prosedur kimi təqdim edilmir.

## Məxfilik iddialarının kod əsası — yalnız oxu auditi

| Axın | Yoxlanmış mənbə | Mətnin həddi / hələ bilinməyən |
|---|---|---|
| Auth, profil | index.html: mövcud Supabase createClient; backend/a-usta56/src/routes/auth.ts | Sessiya, email/profil sahələri; aktiv provider və saxlama rejimlərinin tam hosted auditi yoxdur |
| Satıcı yoxlaması | assets/marketplace/seller-verification.js: APPLICATION_FIELDS/DOCUMENT_FIELDS | Təqdim edilən biznes/sənəd məlumatları; bütün profillərin təsdiqi və ya şəxsiyyət yoxlamasının keyfiyyəti vəd edilmir |
| Açıq elan/media | assets/marketplace/listing-lifecycle.js; backend/a-usta56/src/routes/listing-media.ts; index.html listing render/upload | Görünmə statusu ilə açıq elanlar; şəxsi servis əlavələri ilə eyniləşdirilmir |
| Şəxsi avtomobil | assets/account/vehicle-data.js V/R/A field listləri | VIN, nişan, yürüş, tarixçə; fərqli avtomobillərin məlumatı birləşdirilmir |
| Şəxsi əlavələr | vehicle-data.js upload/download/removeAttachment | Metadata/sahiblik yenidən oxunur, cacheNonce/no-store; əvvəlki nüsxə/keşin retroaktiv ləğvi zəmanəti yoxdur |
| Sifariş/təyinat | backend/a-usta56/src/routes/service-orders.ts; mövcud müştəri/provider panelləri | Təsvir, qiymət sahələri, status, müştəri/provider məlumatı; həmişə passiv vasitəçilik iddiası yoxdur |
| Məkan | index.html geolocation çağırışları; service-orders.ts latitude/longitude yoxlamaları | Forma/icazə istifadə olunduqda məkan; hamı üçün daimi izləmə iddiası yoxdur |
| Diaqnostika | backend/a-usta56/src/diagnostics/foundation.ts | Sorğu ID, metod, marşrut, status, xəta tipi; bütün infrastruktur loglarının anonim olduğu deyilmir |
| localStorage/sessionStorage | index.html austa_language, V164 social state; vehicle-data.js submission journal | Sessiya/seçimlər/təkrar göndəriş identifikatoru; browser təmizləmə server silinməsi deyil |
| İnfrastruktur | index.html GitHub Pages/Supabase/Render/skript-media mənbələri; backend config/server.ts/config/supabase.ts | İnteqrasiya adları koddandır; ölkə, DPA/alt-emalçı, hüquqi əsas və ötürmə təminatı nəticəsi çıxarılmır |

Kodda köhnə lokal modullar və kənar resurslar da var. Aktiv/inert skript yoxlamaları onları fərqləndirir; yalnız mənbə axtarışı tam cookie/telemetriya/retention auditi deyil. Bu tapşırıqda heç bir SDK, Auth, RPC, SQL, DB, RLS, Storage və backend düzəlişi edilməyib. Mətn həmin qeyri-müəyyənliyi gizlətmir.

## Nəşrdən əvvəl məcburi qərarlar

| ID | Status | Dəqiq tələb |
|---|---|---|
| L1 | OWNER / LEGAL APPROVAL REQUIRED | Operatorun hər axında faktiki rolu; öz reklam/ödənişli xidmətləri üzrə açıqlamalar; məcburi hüquqi identifikasiya və ünvan məlumatlarının tətbiqi |
| L2 | LEGAL REVIEW REQUIRED — material nəşr blokeri | Sahib VÖEN göstərilməməsini istəyir, kodda göstərilmir. Elektron ticarət haqqında Qanunun 5.3-cü maddəsi satıcı/təchizatçı üçün identifikasiya/əlaqə məlumatlarını nəzərdə tutur. Bunun A-USTA-nın konkret fəaliyyətinə tətbiqini hüquqşünas həll etməlidir. “Heç vaxt hüquqi açıqlama tələb olunmur” nəticəsi çıxarılmır; heç bir real vergi nömrəsi bu sənəddə yoxdur. Tələb tətbiq olunarsa sahib ayrıca qərar verməlidir. |
| L3 | OWNER / LEGAL APPROVAL REQUIRED | Yekun istifadə, moderasiya və etiraz qaydası; qəbul/bildiriş mexanizmi, versiya/qüvvəyə minmə tarixi və mübahisə proseduru |
| L4 | OWNER / LEGAL APPROVAL REQUIRED | Məlumat kateqoriyalarının hüquqi əsasları; faktiki provayder/alt-emalçı və ölkə/ötürmə yoxlaması, razılıq və mümkün qeydiyyat öhdəlikləri |
| L5 | OWNER APPROVAL REQUIRED | Məxfilik sorğusunu qəbul edən məsul şəxs, təhlükəsiz identifikasiya və emal prosesi; retention/silinmə/ehtiyat nüsxə cədvəli; cookie/analitika seçimi və insident proseduru |
| L6 | OWNER APPROVAL REQUIRED | Reklam formatlarının kommersiya əlçatanlığı, tarif/vergi, müddət, ölçmə/hesabat, ödəniş/ləğv/geriödəmə və məzmun nəzarəti; heç bir rəqəm uydurulmayıb |
| L7 | OPERATIONAL VERIFICATION REQUIRED | WhatsApp-a müraciət qəbulunun faktiki işləkliyi/məsul şəxs; a-usta.az alınmayıb, email inbox aktiv deyil. Domain/email aktivləşməsi ayrıca tapşırıqdır. |
| L8 | LEGAL REVIEW REQUIRED | Dəqiq footer disclaimer-in qanuni hədləri; istifadə layihəsi qeyri-istisna edilən hüquq/öhdəlikləri saxlayır, blanket exemption təqdim etmir |

Mətn hazırlığı: **READY FOR OWNER REVIEW**. Hüquqi nəşr/merge/release: **BLOCKED** — L1–L8-in uyğun təsdiq və yoxlamaları tamamlanmayıb. Avtomatlaşdırılmış testlər hüquqi təsdiq deyil. Draft status qorunmalıdır.

## Rəsmi mənbələr və tətbiq sərhədi

13 noyabr 2026 tarixində rəsmi mənbələrə baxılıb. Mətnlər qanunlara uyğunluğun təsdiqi kimi təqdim edilmir; göstərilən məsələlərin hüquqşünas tərəfindən qiymətləndirilməsi üçündür. Mənbələrdən uzun hüquqi mətn köçürülməyib.

- Elektron ticarət haqqında, xüsusən maddə 5 və 7: https://e-qanun.az/framework/10406 və https://frameworks.e-qanun.az/10/f_10406.html
- Fərdi məlumatlar haqqında, o cümlədən məlumat subyekti/ötürmə məsələləri: https://e-qanun.az/framework/19675
- İstehlakçıların hüquqlarının müdafiəsi haqqında: https://e-qanun.az/framework/9479

## Rollout / rollback

Yalnız bu dar mətn/test/sənəd patch-i mövcud PR-a verilir. Nəşrdən əvvəl hüquqi qərarları və real contact/cookie/retention yoxlamalarını tamamlayın, sonra ayrıca sahib icazəsi alın. Yeni hüquqi qəbul mexanizmi bu patch-də qurulmur. Məlumat bazası asılılığı yoxdur. Geri dönüş lazım olsa bu incremental fayllara ayrıca reviewed revert tətbiq edin; başqa şəxsin worktree-sini reset etməyin. Domen/email/production dəyişməyib.
