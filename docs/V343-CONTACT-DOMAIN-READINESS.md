# V3.4.3 — təsdiqlənmiş əlaqə məlumatları və gələcək domenə təhlükəsiz keçid

## Cari vəziyyət

- Vahid public konfiqurasiya: assets/homepage/mobile-links.js → AUSTA_SITE_CONFIG. Şirkət adı, email, WhatsApp, dəstək mətni, cari website və gələcək domen yalnız burada idarə olunur. AUSTA_MOBILE_LINKS.website həmin konfiqurasiyadan alınır.
- A-USTA MMC; austa@a-usta.az; +994 99 234 27 62 sahibi tərəfindən təsdiqlənib. Email üçün mailto, WhatsApp üçün wa.me istifadə edilir. Zəng düyməsi yoxdur. VÖEN public konfiqurasiyaya daxil edilmir və göstərilməyəcək.
- “Yalnız WhatsApp vasitəsilə — bizə yazın, sizə köməklik göstərək!” dəqiq göstərilir. Email ünvanının göstərilməsi poçt qutusunun fəaliyyət təsdiqi deyil; emailVerified=false və gözləmə bildirişi saxlanır.
- Cari website/QR: https://a-usta.github.io/A-Usta-webside/ . QR PNG dəyişdirilməyib.
- Gələcək domen a-usta.az alınmayıb. domainOwned=false, customDomainActive=false. Domenin alınması təkbaşına saytı və email-i aktivləşdirməyəcək.
- Bu PR-da CNAME faylı, DNS/Pages custom-domain, email xidməti, Supabase, Render və production parametrləri dəyişdirilmir. Universal/Android App Links deaktivdir.

## Satınalmadan sonra ayrıca icazə ilə minimal keçid

1. Domeni sahibin nəzarətində olan hesabda satın alın və DNS idarəetməsinə çıxışı təsdiqləyin. Bu tapşırıq satınalma/ödəniş icazəsi deyil.
2. GitHub təşkilatının Pages domain-verification prosesində verilən TXT qeydini istifadə edərək sahiblik yoxlamasını tamamlayın. Qeyd adı/tokeni uydurulmur; GitHub-dan alınır. Verification TXT-ni qoruyun.
3. Sahib əsas URL-in apex a-usta.az, yoxsa www variantı olmasını təsdiqləsin. Yalnız ayrıca release icazəsindən sonra repository Pages custom-domain parametrini qurun; uyğun workflow CNAME tələb edirsə, həmin mərhələdə yaradın. GitHub domeni repo-ya əlavə etməzdən əvvəl trafik DNS-ni yönəltməməyi tövsiyə edir.
4. Cari rəsmi GitHub Pages təlimatına uyğun apex A/AAAA və ya ALIAS/ANAME, lazım olsa www CNAME qeydlərini DNS provayderində qurun. IP/token dəyərləri bu sənəddə sabitlənmir. Wildcard DNS istifadə etməyin. Bu addımlar indi icra edilməyib.
5. DNS/HTTPS sertifikatını, əsas/alternativ ünvan yönləndirmələrini və mövcud GitHub Pages keçidlərinin davranışını yoxlayın. HTTPS təmin olunandan sonra Enforce HTTPS qərarını tətbiq edin. /info/index.html, asset yolları, footer keçidləri, Account/Auth, media və backend origin/CORS/Auth redirect tələblərini ayrıca audit edin; avtomatik konfiqurasiya dəyişikliyi yoxdur.
6. Yalnız işlək yeni HTTPS ünvan təsdiqlənəndən sonra canonical website dəyərini yeniləyin. QR-ni həmin yeni məqsəd üçün ayrıca yaradıb native ölçülərdə skan edin; köhnə QR-nin/keçidlərin davranışını yoxlayın. Köhnə ünvanın avtomatik yönləndiriləcəyinə əvvəlcədən zəmanət verilmir.
7. Desktop/mobil regression, link və authentication testləri keçsin. Sahib ayrıca merge/deploy icazəsi versin. Bu PR Draft qalır.

## Email ayrıca aktivləşdirilir

Domen sahibi email provayderini və poçt qutusunu ayrıca təsdiqləməlidir. Provayderin real MX, SPF/DKIM və uyğun DMARC qeydləri onun təlimatından götürülməli, domen/DNS təsdiqlənməli və göndərmə/qəbul testləri tamamlanmalıdır. MX dəyərləri və işlək inbox iddiası uydurulmur. Yalnız həmin sübutlardan sonra emailVerified=true edilə bilər. O vaxta qədər WhatsApp-only dəstək mətni və email gözləmə bildirişi qalır. Bu tapşırıq email hesabı yaratmır və heç kimə mesaj göndərmir.

## Owner-provided disclaimer — hüquqi baxış qapısı

Kataloqdan dərhal sonra, copyright-dan əvvəl sahibin dəqiq təqdim etdiyi mətn göstərilir:

> Saytın administrasiyası reklam bannerlərinin və yerləşdirilmiş elanların məzmununa görə məsuliyyət daşımır.

**LEGAL REVIEW / OWNER APPROVAL REQUIRED BEFORE PUBLICATION:** bu, sahibin təqdim etdiyi display copy-dir. Mətnin göstərilməsi qanundan irəli gələn platforma məsuliyyətlərini aradan qaldırdığı kimi qəbul edilmir; bu PR onun hüquqi qüvvəsi barədə nəticə vermir. Qalan legal sənədlər əvvəlki pending statusunda qalır.

## Rəsmi istinadlar

- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https

Rollback: gələcək uğursuz keçiddə əvvəl təsdiqlənmiş cari URL/QR konfiqurasiyasına ayrıca reviewed dəyişikliklə qayıdın; domen/DNS qeydlərini yalnız səlahiyyətli sahib idarə etsin. Domain takeover riskini nəzərə alaraq köhnə qeydləri nəzarətsiz və ya orphan vəziyyətdə saxlamayın. İndi heç bir domain dəyişikliyi tətbiq edilməyib.
