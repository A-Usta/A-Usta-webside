# A-USTA Mobil — M1 auditı və M2 təməli

Bu qovluq A-USTA üçün native Android/iOS Expo + React Native + TypeScript tətbiqinin başlanğıcıdır. Mövcud statik sayt və backend-dən ayrı işləyir; veb fayllarına dəyişiklik etmir.

## M1 audit qeydləri

- Veb müştərisi vanilla JavaScript-dir; native tətbiq və mobil build konfiqurasiyası əvvəl yox idi.
- Backend `backend/a-usta56` altında Fastify + Supabase-dir. Backend-in `SUPABASE_SERVICE_ROLE_KEY` açarı server tərəfində qalır. Mobil müştəri yalnız Supabase URL və public anon key qəbul edir.
- Mövcud elan cədvəlləri: `vehicle_listings` (`sale`/`rent`), `auto_dealer_listings`, `marketplace_listings` (`parts`, `accessories`, `special`, `moto`, `plate`, `bus`, `water`, `caravan`, `trailer`) və `service_provider_listings` (`usta`, `service`, `leasing`, `insurance`, `sober_driver`).
- `service-orders.ts` hazırda `mechanic_service`, `tow_service`, `cargo_service` müqavilələrini yoxlayır. Mobilin bu axına keçidi sonrakı mərhələdə mövcud endpoint və token avtorizasiyasından istifadə edəcək; `service_orders.vehicle_id` və DB/RLS sxemi dəyişdirilmir.
- Mövcud xəritə `assets/map/*` daxilində `discover_public_providers` RPC-si və büdcə/sorğu qoruyucularından istifadə edir. Mobil xəritə həmin müqavilə yoxlanmadan yeni Geoapify çağırışı göndərmir.
- CarCareKiosk-un təsdiqlənmiş rəsmi linki vebdə `https://www.carcarekiosk.com/` kimi mövcuddur; mobil menyu eyni URL-i xarici brauzerdə açır.
- Repository-də müstəqil A-USTA loqo faylı müəyyən edilmədi; hazırkı sayt A-USTA yazı wordmark-ından istifadə edir. M2-də ikon və splash üçün həmin yazı formasına əsaslanan sadə wordmark hazırlanıb. Rəsmi loqo faylı paylaşılarsa asset ilə əvəz etmək olar.

## M2 daxilindəkilər

- React Native + Expo + TypeScript layihəsi.
- Expo Router fayl əsaslı naviqasiya və 5 bölməli alt menyu: Əsas, Seçilmişlər, Yeni elan, Mesajlar, Hesab.
- Soldan sürüşərək açılan panel, standart bağlı accordion və 5 xidmət keçidi; Android Back və iOS naviqasiya jestləri standart native naviqatorlara həvalə olunur.
- CarCareKiosk rəsmi URL-i.
- A-USTA yaşıl rəngi, light surfaces, tab safe-area, placeholder/empty/error/loading state-lər.
- Ana səhifə public anon client vasitəsilə `vehicle_listings` cədvəlindən aktiv satış elanlarını yalnız oxuyur. Supabase konfiqurasiyası verilmədikdə nümunə məlumat göstərilmir.
- Supabase sessiyası cihazda `expo-secure-store` vasitəsilə saxlanılır.
- Elan, hesab, sifariş və xəritə ekranları hələ M3–M5 mərhələsindəki API inteqrasiyasını gözləyir; hazırkı UI onların işlədiyini iddia etmir.

## Local başlatma

1. `.env.example`-i `.env.local` kimi köçürün və public Supabase URL + anon key yazın.
2. `npm install`
3. `npx expo start`
4. Yoxlama: `npm test`, `npx expo lint`, `npx tsc --noEmit`.

Yalnız local/test layihəsinin public anon key-indən istifadə edin. Service-role/secret key tətbiqə və build-ə əlavə edilməməlidir.

## Mərhələ sərhədi

Bu PR yalnız M1 qeydləri və M2 native karkası üçündür. İstehsalat Supabase, backend, RLS, Storage və mövcud veb axınlarında dəyişiklik yoxdur. Android/iOS emulator testləri və quraşdırıla bilən build bu execution mühitində SDK/simulator mövcudluğu ilə ayrıca təsdiqlənməlidir.
