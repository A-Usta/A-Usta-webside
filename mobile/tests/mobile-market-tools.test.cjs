const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('official vehicle customs calculator is embedded and navigation is restricted to official customs domains', () => {
  const tools = read('src/components/MarketTools.tsx');
  const core = read('src/lib/marketTools.ts');
  assert.match(core, /https:\/\/e\.customs\.gov\.az\/for-individuals\/calculator\/auto/);
  assert.match(tools, /onShouldStartLoadWithRequest=\{request =>/);
  assert.match(tools, /if \(!allowed\) setFailed\(true\); return allowed;/);
  assert.match(tools, /onRenderProcessGone=\{\(\) => setFailed\(true\)\}/);
  assert.match(tools, /hostname\.endsWith\('\.customs\.gov\.az'\)/);
  assert.match(tools, /Gömrük dəyəri və yekun ödəniş rəsmiləşdirmə zamanı dəyişə bilər/);
  assert.doesNotMatch(tools, /aksizRate\s*=|vatRate\s*=|customsDutyRate\s*=/i);
});

test('Baku-day listing count uses the exact active vehicle rows and bounded local day', () => {
  const core = read('src/lib/marketTools.ts');
  assert.match(core, /timeZone:\s*'Asia\/Baku'/);
  assert.match(core, /\.eq\('status',\s*'active'\)\.eq\('listing_type',\s*'sale'\)\.gte\('created_at',\s*from\)\.lt\('created_at',\s*to\)/);
  assert.match(core, /count:\s*'exact',\s*head:\s*true/);
});

test('dealer directory filters current verified active dealer profiles and owner-linked active vehicle ads', () => {
  const core = read('src/lib/marketTools.ts');
  const screen = read('src/components/MarketTools.tsx');
  assert.match(core, /business_type',\s*'dealer'\)\.eq\('status',\s*'active'\)\.eq\('verification_status',\s*'verified'/);
  assert.match(core, /\.eq\('seller_profile_id',\s*profile\.id\)\.eq\('status',\s*'active'\)\.eq\('listing_type',\s*'sale'\)/);
  assert.match(core, /count:\s*'exact'/);
  assert.match(screen, /Təsdiqlənmiş diler profili tapılmadı/);
  assert.match(screen, /Daha çox elan göstər/);
});

test('catalog is driven by the existing brand/model dataset and real active A-USTA listing data', () => {
  const tools = read('src/components/MarketTools.tsx');
  const core = read('src/lib/marketTools.ts');
  assert.match(tools, /vehicle-catalog\.json/);
  assert.match(tools, /vehicleModels\[brand\]/);
  assert.match(tools, /Ayrı model nəsli məlumatı olmayan yerdə nəsil uydurulmur/);
  assert.match(tools, /Texniki məlumat elanda göstərilməyib/);
  assert.match(tools, /listCategory\(client,\s*category,\s*\{\s*from:\s*0,\s*to:\s*39,\s*brand:\s*selectedBrand,\s*model:\s*selectedModel\s*\}\)/);
});

test('home quick links and summary cards route to real screens', () => {
  const tools = read('src/components/MarketTools.tsx');
  const routes = ['customs', 'catalog', 'dealers', 'most-viewed'];
  for (const route of routes) assert.ok(fs.existsSync(path.join(root, `src/app/tools/${route}.tsx`)));
  for (const label of ['Ən çox baxılanlar', 'Gömrük kalkulyatoru', 'Avtokataloq', 'Dilerlər']) assert.ok(tools.includes(label));
  assert.match(tools, /getMostViewedActiveCars\(client\)/);
  assert.match(read('src/lib/marketTools.ts'), /austa_get_listing_detail_metadata/);
});

test('listing media step supports direct camera capture and safe native permissions', () => {
  const screen = read('src/components/MarketplaceScreens.tsx');
  const app = read('app.json');
  assert.match(screen, /requestCameraPermissionsAsync\(\)/);
  assert.match(screen, /launchCameraAsync\(\{mediaTypes:\['images','videos'\]/);
  assert.match(screen, /Kamera ilə çək/);
  assert.match(screen, /setAssets\(current=>\[\.\.\.current,result\.assets\[0\]\]\)/);
  assert.match(app, /"cameraPermission":\s*"A-USTA elanınıza birbaşa kameradan/);
  assert.match(app, /"microphonePermission":\s*"A-USTA elanınıza kameradan video çəkərkən/);
});

test('listing detail provides paged full-screen media and truthful A-USTA listing labels', () => {
  const screen = read('src/components/MarketplaceScreens.tsx');
  assert.match(screen, /pagingEnabled/);
  assert.match(screen, /resizeMode="contain"/);
  assert.match(screen, /austa_get_listing_detail_metadata/);
  assert.match(screen, /item\.credit_available===true/);
  assert.match(screen, /item\.barter_available===true/);
  assert.match(screen, /Sifarişlə/);
  assert.match(screen, /Videonu paylaş/);
  assert.match(screen, /Elanı yadda saxla/);
});

test('mobile detail page uses real price history, masks VIN and offers seller contact and safety actions', () => {
  const screen = read('src/components/MarketplaceScreens.tsx');
  assert.match(screen, /austa_get_listing_price_history/);
  assert.match(screen, /!\['equipment','vin','service_category'\]\.includes\(key\)/);
  assert.match(screen, /VIN/);
  assert.match(screen, /const summary=category==='cars'/);
  assert.match(screen, /const isVehicleSale=category==='cars'/);
  assert.match(screen, /heart:\{position:'absolute',right:7,top:7/);
  assert.match(screen, /Satıcıdan soruşun/);
  assert.match(screen, /austa_open_listing_conversation/);
  assert.match(screen, /austa_send_listing_message/);
  assert.match(screen, /Elana baxış keçirmədən öncə beh göndərməyin/);
  assert.match(screen, /Diqqət!/);
  assert.match(screen, /accessibilityLabel=\"Elanları müqayisə et\"/);
  assert.match(screen, /Zəng et/);
  assert.match(screen, /Bütün şəkillər/);
  assert.match(screen, /detailTopBar/);
  assert.match(screen, /accessibilityLabel=\"Elanı paylaş\"/);
  assert.match(screen, /accessibilityLabel=\"Elanları müqayisə et\"/);
  assert.match(screen, /backgroundColor:'#36B45C'/);
  assert.match(screen, /backgroundColor:'#4884EF'/);
  assert.match(screen, /Maşın satışdadır\?/);
  assert.match(screen, /austa_get_public_seller_avatar/);
  assert.match(screen, /seller-profile-avatars'\)\.createSignedUrl/);
  assert.match(screen, /Telefon nömrəsini göstər/);
});

test('mobile settings show supported language and currency and do not fabricate unsupported options', () => {
  const settings = read('src/components/SettingsScreen.tsx');
  const provider = read('src/lib/app-settings.tsx');
  const root = read('src/app/_layout.tsx');
  const tabs = read('src/app/(drawer)/(tabs)/_layout.tsx');
  assert.match(settings, /Azərbaycan dili/);
  assert.match(settings, /AZN/);
  assert.match(settings, /USD/);
  assert.match(settings, /EUR/);
  assert.match(settings, /value: 'dark'/);
  assert.match(settings, /value: 'system'/);
  assert.match(settings, /Azərbaycan Mərkəzi Bankının rəsmi gündəlik XML məzənnəsi/);
  assert.match(settings, /Linking\.openSettings/);
  assert.match(settings, /nativeApplicationVersion/);
  assert.match(settings, /Hesabın əsas səhifəsinə qayıt/);
  assert.match(provider, /AsyncStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(provider, /AsyncStorage\.setItem\(STORAGE_KEY/);
  assert.match(provider, /Appearance\.setColorScheme/);
  assert.match(provider, /austa:cbar-rates:v1/);
  assert.match(root, /AppSettingsProvider><AppNavigation \/><\/AppSettingsProvider>/);
  assert.match(root, /StatusBar style=\{dark \? 'light' : 'dark'\}/);
  assert.match(tabs, /backgroundColor: dark \? '#151D26' : '#FFFFFF'/);
  assert.match(read('app.json'), /"userInterfaceStyle": "automatic"/);
});

test('supported theme mode is persisted before the active app theme changes', () => {
  const provider = read('src/lib/app-settings.tsx');
  assert.match(provider, /if \(!hydrated\) return;/);
  assert.match(provider, /await savePreference\(\{ themeMode: mode \}\);\s*setThemeModeState\(mode\);/);
  assert.match(provider, /systemScheme === 'dark' \? 'dark' : 'light'/);
  assert.match(provider, /value === 'light' \|\| value === 'dark' \|\| value === 'system'/);
});

test('selected listing currency is validated, persisted, restored, and keeps source prices intact', () => {
  const provider = read('src/lib/app-settings.tsx');
  const currency = read('src/lib/currency.ts');
  assert.match(provider, /isCurrencyCode\(\(saved as \{ currency\?: unknown \}\)\.currency\)/);
  assert.match(provider, /await savePreference\(\{ currency: value \}\);\s*setCurrencyState\(value\);/);
  assert.match(provider, /austa:cbar-rates:v1/);
  assert.match(currency, /return amount \* rates\.aznPerUnit\[from\] \/ rates\.aznPerUnit\[to\]/);
  assert.match(currency, /let shown = source;/);
  assert.match(currency, /if \(rates && rates\.aznPerUnit\[source\] > 0 && rates\.aznPerUnit\[selected\] > 0\)/);
});

test('video feed reads only attached video rows that resolve to active public listings', () => {
  const core = read('src/lib/marketplace.ts');
  const screen = read('src/components/MarketplaceScreens.tsx');
  assert.match(core, /export async function listHomeVideos/);
  assert.match(core, /\.eq\('media_type','video'\)/);
  assert.match(core, /\.eq\('status','active'\)/);
  assert.match(core, /createSignedUrl\(row\.storage_path,3600\)/);
  assert.match(core, /\.range\(offset,offset\+79\)/);
  assert.match(core, /for\(let page=0;page<16&&found\.size<perSourceTarget;page\+\+\)/);
  assert.match(core, /Promise\.all\(media\.filter/);
  assert.match(screen, /listHomeVideos\(sb\)/);
  assert.match(screen, /A-USTA mobil elan/);
});

test('nearby map native module failure leaves the backend list available', () => {
  const screen = read('src/components/ServiceScreens.tsx');
  assert.match(screen, /try\{const maps=require\('react-native-maps'\)/);
  assert.match(screen, /Xəritə modulu bu cihazda yüklənmədi/);
  assert.match(screen, /MapView\?\s*<View style=\{css\.map\}/);
  assert.match(screen, /class NativeMapBoundary extends Component/);
  assert.match(screen, /Yaxın məntəqələr siyahıda qalır/);
  assert.match(screen, /Siyahı görünüşü/);
});


test('home video cards render a first-frame preview and open the video viewer, not listing details', () => {
  const screen = read('src/components/MarketplaceScreens.tsx');
  const feed = read('src/components/VideoFeedScreen.tsx');
  assert.match(screen, /function VideoPoster/);
  assert.match(screen, /function VideoPoster\(\{url,style\}:\{url\?:string/);
  assert.match(screen, /poster_url/);
  assert.doesNotMatch(screen, /onFirstFrameRender=\{capturePoster\}/);
  assert.match(screen, /pathname:'\/videos',params:\{listingId:item\.id,source:item\._source,index:String\(index\),direct:'1'\}/);
  assert.match(screen, /videoStrip:\{gap:9,paddingHorizontal:14/);
  assert.match(feed, /initialNumToRender=\{1\}/);
  assert.match(feed, /active=\{viewerOpen&&index===selectedIndex\}/);
  assert.match(feed, /onCloseViewer=\{closeViewer\}/);
  assert.match(feed, /onOpenListing=\{\(\)=>openListing\(item\)\}/);
});
