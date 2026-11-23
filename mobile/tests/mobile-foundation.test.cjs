const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const client = fs.readFileSync(path.join(root, 'src/lib/supabase.ts'), 'utf8');
const tabs = fs.readFileSync(path.join(root, 'src/app/(drawer)/(tabs)/_layout.tsx'), 'utf8');
const drawer = fs.readFileSync(path.join(root, 'src/app/(drawer)/_layout.tsx'), 'utf8');
const drawerScreen = fs.readFileSync(path.join(root, 'src/components/ServiceDrawer.tsx'), 'utf8');
const marketplace = fs.readFileSync(path.join(root, 'src/components/MarketplaceScreens.tsx'), 'utf8');

test('Expo Router exposes five mobile tabs and the left service drawer', () => {
  for (const name of ['index', 'favorites', 'create', 'messages', 'account']) assert.match(tabs, new RegExp(`<Tabs\\.Screen name="${name}"`));
  assert.match(drawer, /drawerType: 'front'/);
  assert.match(drawer, /swipeEnabled: true/);
  assert.match(marketplace, /accessibilityLabel="Xidmətlər menyusunu aç"/);
  assert.match(marketplace, /navigation\.openDrawer\?\.\(\)/);
  const keys = [...drawerScreen.matchAll(/\{ title: '([^']+)', key: '([^']+)'/g)].map(match => match[2]);
  assert.deepEqual(keys.slice(0, 5), ['mechanic_service', 'tow_service', 'cargo_service', 'locations', 'carcare']);
  assert.match(drawerScreen, /setOpen\(value => !value\)/);
  assert.match(drawerScreen, /navigation\.closeDrawer\(\)/);
  assert.match(drawerScreen, /router\.push\('\/locations'\)/);
  assert.match(drawerScreen, /router\.push\(\{ pathname: '\/service\/\[key\]'/);
  assert.match(drawerScreen, /Linking\.openURL\(CARCARE_URL\)/);
  assert.match(drawer, /overlayColor:/);
});

test('all supported listing categories and CarCareKiosk destination are present', () => {
  const keys = [...app.matchAll(/\['([^']+)', '([^']+)',/g)].map(match => match[1]);
  for (const key of ['cars', 'dealer', 'service', 'rent', 'parts', 'accessories', 'moto', 'special', 'bus', 'trailer', 'water', 'caravan', 'plate', 'usta', 'insurance', 'sober_driver', 'leasing']) assert(keys.includes(key), `missing category ${key}`);
  assert.match(drawerScreen, /https:\/\/www\.carcarekiosk\.com\//);
  assert.match(drawerScreen, /Linking\.openURL\(CARCARE_URL\)/);
});

test('mobile TOP advertisement matches the currently active website banner in full-width contain mode', () => {
  const crypto = require('node:crypto');
  const websiteBanner = path.resolve(root, '../assets/homepage/austa-top-static-banner.webp');
  const mobileBanner = path.join(root, 'assets/austa-top-static-banner.webp');
  assert.ok(fs.existsSync(websiteBanner));
  assert.ok(fs.existsSync(mobileBanner));
  const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(digest(mobileBanner), digest(websiteBanner));
  assert.match(marketplace, /require\('\.\.\/\.\.\/assets\/austa-top-static-banner\.webp'\)/);
  assert.match(marketplace, /resizeMode="contain"/);
  assert.match(marketplace, /aspectRatio:1920\/210/);
  assert.match(marketplace, /accessibilityLabel="A-USTA ABŞ-dən avtomobil sifarişi reklamı\. Elanlara bax"/);
  assert.match(marketplace, /params:\{key:'cars',title:'Avtomobillər'\}/);
  assert.doesNotMatch(marketplace.slice(marketplace.indexOf('function TopAdvertisement'), marketplace.indexOf('function CatalogPicker')), /austa-usa-order-wide\.mp4|VideoView|useVideoPlayer/);
});

test('vehicle filter panels collapse without discarding filters and expose apply/reset', () => {
  assert.match(marketplace, /accessibilityState=\{\{expanded:filtersOpen\}\}/);
  assert.match(marketplace, /activeCategory\.source==='vehicle'&&<Pressable/);
  assert.match(marketplace, /\(activeCategory\.source!=='vehicle'\|\|filtersOpen\)/);
  assert.match(marketplace, /setDraftFilters\(current=>\(\{\.\.\.current,\[field\.key\]:value\}\)\)/);
  assert.match(marketplace, /setAppliedFilters\(values\)/);
  assert.match(marketplace, /setDraftFilters\(\{\}\);setAppliedFilters\(\{\}\);setSearch\(''\)/);
  assert.match(marketplace, /category\.source==='vehicle'&&<Pressable/);
  assert.match(marketplace, /\(category\.source!=='vehicle'\|\|filtersOpen\)/);
  assert.match(marketplace, /setBrand\(value\);setModel\(''\)/);
  assert.match(marketplace, /setSearch\(''\);setBrand\(''\);setModel\(''\);setRegion\(''\);setMin\(''\);setMax\(''\);setYearMin\(''\)/);
  assert.match(marketplace, /half:\{flex:1,minWidth:120\}/);
});

test('client auth uses secure storage and contains no privileged credential', () => {
  assert.match(client, /expo-secure-store|SecureStore/);
  assert.match(client, /EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(client, /SERVICE_ROLE|service_role/i);
  assert.doesNotMatch(app, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test('unconfigured listing feed uses an empty state instead of fabricated listings', () => {
  assert.match(app, /setListings\(\[\]\)/);
  assert.match(app, /Aktiv elan tapılmadı/);
  assert.doesNotMatch(app, /DEMO-|fake listing|nümunə elan/i);
});
