# A-USTA Mobil — M1 auditı və M2 təməli

Bu qovluq A-USTA üçün native Android/iOS Expo + React Native + TypeScript tətbiqinin başlanğıcıdır. Mövcud statik sayt və backend-dən ayrı işləyir; veb fayllarına dəyişiklik etmir.

## M1 audit qeydləri

- Veb müştərisi vanilla JavaScript-dir; native tətbiq və mobil build konfiqurasiyası əvvəl yox idi.
- Backend `backend/a-usta56` altında Fastify + Supabase-dir. Backend-in `SUPABASE_SERVICE_ROLE_KEY` açarı server tərəfində qalır. Mobil müştəri yalnız Supabase URL və public anon key qəbul edir.
- Mövcud elan cədvəlləri: `vehicle_listings` (`sale`/`rent`), `auto_dealer_listings`, `marketplace_listings` (`parts`, `accessories`, `special`, `moto`, `plate`, `bus`, `water`, `caravan`, `trailer`) və `service_provider_listings` (`usta`, `service`, `leasing`, `insurance`, `sober_driver`).
- `service-orders.ts` `mechanic_service`, `tow_service`, `cargo_service` müqavilələrini yoxlayır. Mobil tətbiq mövcud endpoint və token avtorizasiyasından istifadə edir; `service_orders.vehicle_id` və DB/RLS sxemi dəyişdirilmir.
- Mövcud xəritə `discover_public_providers` RPC-si və büdcə/sorğu qoruyucularından istifadə edir. Mobil xəritə həmin RPC-ni çağırır, yeni Geoapify sorğusu göndərmir.
- CarCareKiosk-un təsdiqlənmiş rəsmi linki vebdə `https://www.carcarekiosk.com/` kimi mövcuddur; mobil menyu eyni URL-i xarici brauzerdə açır.
- Repository-də müstəqil A-USTA loqo faylı müəyyən edilmədi; hazırkı sayt A-USTA yazı wordmark-ından istifadə edir. M2-də ikon və splash üçün həmin yazı formasına əsaslanan sadə wordmark hazırlanıb. Rəsmi loqo faylı paylaşılarsa asset ilə əvəz etmək olar.

## M2 daxilindəkilər

- React Native + Expo + TypeScript layihəsi.
- Expo Router fayl əsaslı naviqasiya və 5 bölməli alt menyu: Əsas, Seçilmişlər, Yeni elan, Mesajlar, Hesab.
- Soldan sürüşərək açılan panel, standart bağlı accordion və 5 xidmət keçidi; Android Back və iOS naviqasiya jestləri standart native naviqatorlara həvalə olunur.
- CarCareKiosk rəsmi URL-i və xəta mesajlı təhlükəsiz xarici keçid.
- A-USTA yaşıl rəngi, light surfaces, tab safe-area, placeholder/empty/error/loading state-lər.
- Ana səhifə public anon client vasitəsilə `vehicle_listings` cədvəlindən aktiv satış elanlarını yalnız oxuyur. Supabase konfiqurasiyası verilmədikdə nümunə məlumat göstərilmir.
- Supabase sessiyası cihazda `expo-secure-store` vasitəsilə saxlanılır.
- Şəxsi kabinet və hesab bölmələri M5 mərhələsində qalır; marketplace axını M3-də ayrıca API/DB müqavilələrinə qoşulub.

## Local başlatma

1. `.env.example`-i `.env.local` kimi köçürün və public Supabase URL + anon key yazın.

M4 native xəritə üçün Android application ID və yalnız Maps SDK ilə məhdudlaşdırılmış `GOOGLE_MAPS_ANDROID_API_KEY` build mühitində verilməlidir. iOS xəritəsi Apple Maps istifadə edir. Yaxın məntəqələr mobil tərəfdən yalnız `discover_public_providers` RPC-sinə müraciət edir; Geoapify birbaşa çağırılmır. Xidmət sifarişi API-si `EXPO_PUBLIC_SERVICE_API_URL` ilə ayrıca disposable TEST hostuna yönəldilə bilər; canlı service-order E2E üçün TEST Supabase və TEST API etimadnamələri lazımdır.
2. `npm install`
3. `npx expo start`
4. Yoxlama: `npm test`, `npx expo lint`, `npx tsc --noEmit`.

Yalnız local/test layihəsinin public anon key-indən istifadə edin. Service-role/secret key tətbiqə və build-ə əlavə edilməməlidir.

## Mərhələ sərhədi

M3 mobil marketplace UI və Supabase public client/RPC inteqrasiyasıdır. Bu PR production DB/backend dəyişiklikləri və production deploy etmir. Android/iOS emulator və cihaz yoxlaması ayrıca build/signing mühiti tələb edir.

## M3 Marketplace

- Ana səhifə, kateqoriya siyahıları, seçilmişlər, mesajlar və elan detalı mövcud Supabase anon client/RPC-lərinə bağlanıb.
- Aktiv 17 kateqoriya öz mövcud listing cədvəlindən istifadə edir. Provider elanlarının public siyahısı `public_service_provider_listings` təhlükəsiz view-undan oxunur; şəxsi provider media üçün storage RLS qaydaları qüvvədə qalır.
- Media mənbələri `listing_media`, `marketplace_listing_media`, `service_provider_media`, `auto_dealer_media` və mövcud bucket-lərlə uyğunlaşdırılır. Ekranda media açmaq üçün qısa müddətli signed URL alınır.
- Premium/VIP vaxtı, son irəli çəkmə vaxtı və standart elanlar ayrı sıralanır. Vaxtı bitmiş promotion sıralamada standart elan kimi davranır.
- Elan yerləşdirmə login/registration, owner-scoped qaralama, edit, image/video picker, upload progress və status compare-and-set ilə dərc axınını istifadə edir. Başlanğıc statusu avtomobil üçün `draft`, qalan mənbələr üçün `inactive` saxlanılır; promo sütunları redaktə zamanı dəyişdirilmir.
- Detail ekranı telefon keçidi, mesaj RPC-ləri, sevimlilər, paylaşım, view metadata, şikayət RPC-si və oxşar elanları bağlayır.
- Avtomobil marka/model seçimi canonical `assets/vehicle/catalog.js` kataloqundan yaradılan JSON ilə işləyir. Kataloqu yeniləmək üçün `npm run catalog:sync`; mobile tests mənbə ilə bərabərliyi yoxlayır.

## M4 Xidmətlər və ana səhifə axtarışı

- Usta çağır, evakuator və yükdaşıma formaları mövcud owner-authenticated `service-orders` API-sindən istifadə edir. Sifariş açarı, qeyri-müəyyən cavabdan sonra sahibə aid GET ilə uzlaşdırma, server dispatch-i, provider qəbul/imtinası, iş mərhələləri və BEFORE/AFTER media müqaviləsi saxlanılıb.
- Evakuator təyinatı və yükün növü/ölçüsü/çəkisi backend-in qəbul etdiyi `answers` JSON sahəsində ötürülür; yeni sütun uydurulmur. Fotoşəkillər mövcud private `service-evidence` bucket və server doğrulamasından istifadə edir.
- Yaxın məntəqələr xəritə/list view, məkan icazəsi, əl ilə şəhər seçimi, filter, retry, telefon və marşrut keçidləri təqdim edir. Android native basemap üçün məhdudlaşdırılmış Maps SDK key-i build mühitində verilməlidir.
- Ana səhifədə 17 kateqoriya üfüqi zolaqdadır; seçilən kateqoriyanın filtrləri həmin kateqoriyanın mövcud elan mənbəyinə sorğu verir. Kateqoriya dəyişəndə köhnə filtr dəyərləri təmizlənir.

## M5 Şəxsi kabinet

- E-poçt/parol ilə giriş və qeydiyyat, e-poçtla şifrə bərpası, sessiyanın bərpası və çıxış Supabase Auth + `expo-secure-store` üzərindən işləyir. Google və telefon OTP düymələri yoxdur; bu imkanlar mobil konfiqurasiyada təsdiqlənməyib.
- Kabinetdə profil xülasəsi, sahibə aid elanlar, seçilmişlər, mövcud service-orders API sifarişləri, şəxsi avtomobillər, servis tarixçəsi, mesajlar və seller profile statusları mövcud mənbələrə bağlanıb.
- `vehicles` şəxsi avtomobil cədvəli elan cədvəllərindən ayrıdır. CRUD sorğuları istifadəçi identifikatoru ilə məhdudlaşır və server RLS dəyişdirilməyib. Tarixçəsi olan avtomobil silinmir; arxivləşdirmə ilə qorunur.
- Servis qeydləri V3.3D.2 `vehicle_service_records` müqaviləsini, `create_vehicle_service_record` owner/request-ID idempotent RPC-sini, sahibə aid redaktə/silməni və tarix/yürüş xatırlatmalarını istifadə edir.
- Private `vehicle-service-evidence` qoşma axını metadata reservation → owner-check → upload → `ready` state ardıcıllığını saxlayır. Şəkillər private storage-dan hər açılışda təzə cache nonce ilə endirilir və yerli önizləmədə açılır. PDF backend-də icazəlidir, lakin bu build-də `expo-document-picker`/native file viewer asılılığı yoxdur.
- Mesajlar M3 tabına yönləndirilir və mövcud participant-only `austa_list_listing_conversations`, `austa_get_listing_messages`, `austa_mark_listing_messages_read` və `austa_send_listing_message` RPC-lərindən istifadə edir.
- Repository-də mobil mesaj bloklama və şikayət üçün təsdiqlənmiş RPC/API müqaviləsi tapılmadı; UI bu əməliyyatları təqdim etmir.
- `get_my_seller_profiles()` yalnız sahibə aid biznes statuslarını göstərir; təsdiq və qorunan əməliyyatlar server seller eligibility qaydalarına tabedir.
- Repository-də push token qeydiyyatı, notification inbox və push göndəriş backend müqaviləsi yoxdur. Mobil tətbiq saxta bildiriş yaratmır və token yazmır; həmin hissə backend müqaviləsi tələb edir.

### M5 test sərhədi və blocker-lər

- `mobile-account.test.cjs` mövcud Auth, RLS, idempotency, private attachment, messaging və seller-profile müqavilələrini statik yoxlayır; bu real Supabase E2E deyil.
- TEST Supabase credentials bu icra mühitində yoxdur; iki-istifadəçili E2E, CRUD yazma və attachment RLS yoxlamaları bloklanıb.
- `expo-document-picker` quraşdırması npm proxy timeout ilə baş tutmadı. PDF seçimi/önizləməsi bloklanıb.
- Profil redaktəsi və satıcı təsdiqi müraciəti üçün təsdiqlənmiş mobil yazma müqaviləsi yoxdur; yalnız sahibə aid profil və seller statusları göstərilir.
- Push notification backend contract yoxdur; Expo push token və saxta hadisə istifadə edilmir.
- M6 üçün Android/iOS native build və cihaz testi ayrıca SDK/signing mühiti tələb edir.

## M6 Native build hazırlığı

- Android package və iOS bundle identifier eyni `az.austa.mobile` dəyərindədir. URL scheme `austa`-dır; Android App Links/iOS Universal Links domen assosiasiyaları hələ konfiqurasiya edilməyib.
- `eas.json`-da `development` və `preview` adlı yalnız TEST profilləri var. Hər ikisi Android APK yaradır; `development` iOS Simulator üçündür, `preview` isə fiziki iOS cihaz üçün EAS signing tələb edir. Production build profili əlavə edilməyib.
- TEST Supabase layihəsi `A-USTA-TEST`, project ref `xnhxneziasqthkhhntkv`, URL `https://xnhxneziasqthkhhntkv.supabase.co` və `ACTIVE_HEALTHY` statusundadır. İdarəetmə məlumatında ayrıca production layihə (`A-Usta`, ref `yafpnqcoyvoclmxdlxxc`) görünür. TEST-də `vehicles`, `vehicle_service_records`, attachment, seller, listing və service-order cədvəlləri mövcuddur; heç bir sətirə yazılmayıb.
- TEST EAS `preview` environment-ə `EXPO_PUBLIC_APP_ENV=test`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` və ayrıca TEST `EXPO_PUBLIC_SERVICE_API_URL` əlavə olunmalıdır. Dynamic app config TEST Supabase ref-in dəqiqliyini, public anon key-in olmasını və repository-də müəyyən edilmiş production Render API hostunun istifadə edilməməsini yoxlayır. Secret/service-role açarları tətbiq konfiqurasiyasına daxil edilmir.
- EAS hesabında CLI/build env yoxlaması aparılmalıdır. Bu mühitdə EAS CLI 27.11.0 işləyir, lakin CLI `Not logged in` qaytarır və `extra.eas.projectId` hələ yoxdur. Buna görə cloud build başlatmaq mümkün olmayıb.
- Bu Render workspace-də yalnız `main`-ə bağlı `A-Usta-webside` API xidməti görünür; ayrıca TEST API xidməti yoxdur. Build və M4 service-order testləri üçün TEST backend hostu yaradılmalı/ayrıca verilməlidir. Production Render env-ləri oxunmayıb və dəyişdirilməyib.
- Android SDK/ADB, iOS Xcode/simulator, Expo/EAS token və Google Maps Android API key bu icra mühitində yoxdur. Google Maps açarı yalnız `az.austa.mobile` package və EAS Android signing sertifikatının SHA-1/SHA-256 fingerprint-ləri ilə məhdudlaşdırılaraq sonradan əlavə edilməlidir. iOS xəritəsi Apple Maps istifadə edir.
- `expo-dev-client` və `expo-document-picker` SDK 58 uyğun versiyaları mövcud mühitdə npm cache-də yoxdur; package registry proxy timeout verir. Development profili beləliklə standart internal build yaradır, hot-reload dev-client deyil. PDF picker/önizləməsi də quraşdırma və test gözləyir.
- TEST build üçün tələb olunan EAS env-lər verilmədikcə `app.config.js` build-i fail-closed dayandırır. `eas build --platform android --profile preview` və `eas build --platform ios --profile development` autentifikasiya/link olmadığı üçün çalışdırıla bilməyib; APK/IPA və cihaz screenshot-u yoxdur.

### M3 test sərhədi

Mobile unit/contract testləri, TypeScript, Expo lint və Expo Doctor işlədilir. Backend/DB write axınları yalnız disposable TEST Supabase-də sınaqdan keçirilməlidir. Bu icra mühitində TEST Supabase konfiqurasiyası yoxdur; service-order yazma və iki istifadəçi izolyasiyası real backend E2E kimi təqdim edilmir. JS export native APK/IPA və ya cihaz testi deyil.
