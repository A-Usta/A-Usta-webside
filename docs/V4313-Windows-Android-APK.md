# V4.3.13 — Windows TEST Android build

Bu təlimat `D:\A` checkout-u, əvvəlki Android SDK/Gradle quraşdırmasını və mövcud Expo imza sertifikatını qoruyur. Açarı mənbə faylına və ya Git-ə yazmayın. Bu addımlar yekun dəyişikliklər branch-ə göndərildikdən sonra, yalnız yekun APK mərhələsində icra edilməlidir.

## 1. TEST açarlarını cari PowerShell prosesinə verin

`D:\A` qovluğunda PR #319 branch-inin yekun commit-i olmalıdır. TEST Supabase public anon key-i və TEST Render URL-i artıq mövcud TEST `.env` faylından götürün; service-role açarını mobil tətbiqə verməyin.

```powershell
Set-Location D:\A\mobile
$env:EXPO_PUBLIC_APP_ENV = 'test'
$env:EXPO_PUBLIC_SUPABASE_URL = 'https://xnhxneziasqthkhhntkv.supabase.co'
$env:EXPO_PUBLIC_SERVICE_API_URL = 'https://austa-v40-m7-test-api.onrender.com'
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = '<A-USTA-TEST public anon key>'

$secureMapKey = Read-Host 'Google Maps SDK for Android TEST açarını daxil edin' -AsSecureString
$mapKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureMapKey)
try {
  $env:GOOGLE_MAPS_ANDROID_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($mapKeyPointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mapKeyPointer)
}

node .\scripts\require-android-maps-key.cjs
```

Google Cloud açarını yalnız `az.austa.mobile` Android tətbiqi və Maps SDK for Android üçün məhdudlaşdırın. Bu açar backend-in `GOOGLE_PLACES_API_KEY` açarı deyil. Backend Places açarını mobil mühitə kopyalamayın.

## 2. Native manifest/config uyğunluğunu yoxlayın

```powershell
$env:EAS_BUILD_PLATFORM = 'android'
node -e "const c=require('./app.config.js')({config:require('./app.json').expo}); const p=c.plugins.find(x=>Array.isArray(x)&&x[0]==='react-native-maps'); if(!p || p[1]?.androidGoogleMapsApiKey!==process.env.GOOGLE_MAPS_ANDROID_API_KEY || c.extra.googleMapsAndroidConfigured!==true) process.exit(1); console.log('Android Maps plugin/runtime flag: OK')"
npx expo prebuild --platform android --no-install
$manifest = Get-Content .\android\app\src\main\AndroidManifest.xml -Raw
if (-not $manifest.Contains('com.google.android.geo.API_KEY')) { throw 'Google Maps API key meta-data AndroidManifest.xml faylında tapılmadı.' }
```

Manifest yoxlaması açarın özünü ekrana çıxarmır. `AndroidManifest.xml` build çıxışıdır; açarı oradan silib açarsız build etməyin.

## 3. Lokal Gradle APK

Yekun APK mərhələsində əvvəlki APK-da istifadə edilən eyni signing keystore və Gradle signing properties-in `D:\A` mühitində olduğunu yoxlayın. Sonra:

```powershell
Set-Location D:\A\mobile\android
.\gradlew.bat assembleRelease
```

APK-nı quraşdırmazdan əvvəl imzanın əvvəlki rəsmi Expo sertifikatı ilə eyni olduğunu `apksigner verify --print-certs` vasitəsilə müqayisə edin. Sertifikat uyğun gəlməzsə, mövcud cihaz tətbiqinin üstündən yazmayın.

## 4. EAS TEST konfiqurasiyası

Ödənişli build başladılmadan əvvəl EAS layihəsinin `preview` environment-ində `GOOGLE_MAPS_ANDROID_API_KEY` dəyişənini sensitive secret kimi əlavə edin. Eyni environment-də mövcud TEST Supabase public env-ləri və ayrıca TEST `EXPO_PUBLIC_SERVICE_API_URL` saxlanmalıdır. `test-android` profili EAS build zamanı Android platforma preflight-ını işə salır; açar olmadıqda build config fail-closed dayanır. Android Maps SDK açarı APK daxilində istifadə olunur, ona görə məhdudiyyətləri aktiv saxlayın.

`EXPO_PUBLIC_APP_ENV=production` üçün açar native plugin-ə ötürülmür. EAS environment-ə ödəniş provayderi və ya Supabase service-role sirləri əlavə etməyin.
