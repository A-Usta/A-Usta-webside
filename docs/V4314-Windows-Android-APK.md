# V4.3.14 — Windows TEST Android build (incremental)

Bu təlimat `D:\A` checkout-u, əvvəlki Android SDK/Gradle quraşdırmasını və mövcud Expo imza sertifikatını qoruyur. Açarı mənbə faylına və ya Git-ə yazmayın. Bu addımlar yekun dəyişikliklər branch-ə göndərildikdən sonra, yalnız yekun APK mərhələsində icra edilməlidir.

## 1. TEST açarlarını cari PowerShell prosesinə verin

Əvvəl `D:\A` checkout-unu PR #319 branch-inin yekun commit-inə fast-forward edin. APK mərhələsi başlamazdan əvvəl yekun HEAD SHA-nı PR ilə tutuşdurun:

```powershell
Set-Location D:\A
git fetch origin feat/v41-mobile-marketplace-tools
git checkout feat/v41-mobile-marketplace-tools
git pull --ff-only origin feat/v41-mobile-marketplace-tools
git rev-parse HEAD
```

TEST Supabase public anon key-i və TEST Render URL-i artıq mövcud TEST `.env` faylından götürün; service-role açarını mobil tətbiqə verməyin.

```powershell
Set-Location D:\A\mobile
$env:ANDROID_HOME = 'D:\AUSTA-Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = 'D:\AUSTA-Android\Gradle'
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
npx expo prebuild --platform android --no-install
node .\scripts\check-android-maps-build.cjs
```

Skript build konfiqurasiyasındakı native plugin dəyərini, `extra.googleMapsAndroidConfigured` bayrağını və prebuild Manifest-dəki `com.google.android.geo.API_KEY` meta-data dəyərini müqayisə edir; heç bir açarı çap etmir. Uğursuz olarsa APK build-i dayandırın.

Manifest yoxlaması açarın özünü ekrana çıxarmır. `AndroidManifest.xml` build çıxışıdır; açarı oradan silib açarsız build etməyin.

## 3. Lokal Gradle APK

Yekun APK mərhələsində əvvəlki APK-da istifadə edilən eyni signing keystore və Gradle signing properties-in `D:\A` mühitində olduğunu yoxlayın. Sonra:

```powershell
Set-Location D:\A\mobile
node .\scripts\check-android-maps-build.cjs
Set-Location .\android
.\gradlew.bat assembleRelease --build-cache
Set-Location ..
node .\scripts\check-android-maps-build.cjs --post .\android\app\build\outputs\apk\release\app-release.apk
```

`assembleRelease` mövcud Gradle cache-dən inkremental istifadə edir. Build-dən sonra APK içində `lib/armeabi-v7a/` ABI-sinin mövcudluğunu yoxlayın (A10 ABI):

```powershell
$apk = Resolve-Path .\android\app\build\outputs\apk\release\app-release.apk
$apkanalyzer = Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\apkanalyzer.bat'
$nativeLibs = & $apkanalyzer files list $apk | Select-String '^lib/armeabi-v7a/'
if (-not $nativeLibs) { throw 'APK-də armeabi-v7a kitabxanaları yoxdur.' }
$manifestText = & $apkanalyzer manifest print $apk | Out-String
if ($manifestText -notmatch 'com\.google\.android\.geo\.API_KEY') { throw 'APK Manifest-də Google Maps meta-data yoxdur.' }
$manifestText = $null
```

`ninja --version` nəticəsinin `1.12.1`, `LongPathsEnabled` dəyərinin `1` olduğunu build-dən əvvəl yoxlayın. Google Maps açarını prosesdən silin: `$env:GOOGLE_MAPS_ANDROID_API_KEY = $null`.

APK-nı quraşdırmazdan əvvəl imzanın əvvəlki rəsmi Expo sertifikatı ilə eyni olduğunu `apksigner verify --print-certs` vasitəsilə müqayisə edin. Sertifikat uyğun gəlməzsə, mövcud cihaz tətbiqinin üstündən yazmayın.

## 4. EAS TEST konfiqurasiyası

Ödənişli build başladılmadan əvvəl EAS layihəsinin `preview` environment-ində `GOOGLE_MAPS_ANDROID_API_KEY` dəyişənini sensitive secret kimi əlavə edin. Eyni environment-də mövcud TEST Supabase public env-ləri və ayrıca TEST `EXPO_PUBLIC_SERVICE_API_URL` saxlanmalıdır. `test-android` profili EAS build zamanı Android platforma preflight-ını işə salır; açar olmadıqda build config fail-closed dayanır. Android Maps SDK açarı APK daxilində istifadə olunur, ona görə məhdudiyyətləri aktiv saxlayın.

`EXPO_PUBLIC_APP_ENV=production` üçün açar native plugin-ə ötürülmür. EAS environment-ə ödəniş provayderi və ya Supabase service-role sirləri əlavə etməyin.


## V4.3.14 üçün əlavə qeyd

- Build branch HEAD-i PR #319-un aktual commit-i ilə eyni olmalıdır; APK bu mərhələdə yaradılmır, yekun QA-dan sonra yalnız bir dəfə yaradılacaq.
- Windows `LongPathsEnabled=1`, Ninja 1.12.1 və mövcud Expo keystore yoxlanılır və saxlanılır; keystore-u yenidən yaratmayın və build çıxışında signing certificate SHA-256-nı əvvəlki rəsmi sertifikatla müqayisə edin.
- Native Manifest source faylında və APK-dan `apkanalyzer manifest print` nəticəsində açar dəyərini göstərməyin; yuxarıdakı yoxlama yalnız meta-data adının mövcudluğunu yoxlayır. `check-android-maps-build.cjs` açar dəyərini daxildə müqayisə edir, çap etmir.
- Google Maps Android SDK TEST açarı `GOOGLE_MAPS_ANDROID_API_KEY` olaraq lokal sessiyada və ya EAS `preview` environment-də ayrıca saxlanmalıdır; Google Places backend açarı ilə paylaşılmır.
