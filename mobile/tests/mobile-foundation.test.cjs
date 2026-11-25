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

test('Expo Router exposes five mobile tabs without a drawer menu', () => {
  for (const name of ['index', 'favorites', 'create', 'messages', 'account']) assert.match(tabs, new RegExp(`<Tabs\\.Screen name="${name}"`));
  assert.match(drawer, /<Stack/);
  assert.doesNotMatch(drawer, /drawerType|swipeEnabled|<Drawer/);
  assert.doesNotMatch(marketplace, /Xidmətlər menyusunu aç|openDrawer/);
});

test('all supported listing categories and CarCareKiosk destination are present', () => {
  const keys = [...app.matchAll(/\['([^']+)', '([^']+)',/g)].map(match => match[1]);
  for (const key of ['cars', 'dealer', 'service', 'rent', 'parts', 'accessories', 'moto', 'special', 'bus', 'trailer', 'water', 'caravan', 'plate', 'usta', 'insurance', 'sober_driver', 'leasing']) assert(keys.includes(key), `missing category ${key}`);
  assert.match(drawerScreen, /https:\/\/www\.carcarekiosk\.com\//);
  assert.match(drawerScreen, /Linking\.openURL\(CARCARE_URL\)/);
});

test('V4.1 keeps the website advertisement untouched and removes the mobile TOP advertisement', () => {
  const websiteBanner = path.resolve(root, '../assets/homepage/austa-top-static-banner.webp');
  assert.ok(fs.existsSync(websiteBanner));
  assert.doesNotMatch(marketplace, /TopAdvertisement|austa-top-static-banner\.webp/);
  assert.match(marketplace, /Sizin üçün videolar/);
});

test('all category filters collapse, retain values, and expose apply/reset', () => {
  assert.match(marketplace, /accessibilityState=\{\{expanded:filtersOpen\}\}/);
  assert.match(marketplace, /setFiltersOpen\(value=>!value\)/);
  assert.match(marketplace, /CATEGORY_FILTERS\[category\.key\]/);
  assert.match(marketplace, /categoryFilterError\(category\.key,filterDraft\)/);
  assert.match(marketplace, /setAppliedByCategory\(current=>\(\{\.\.\.current,\[category\.key\]:categoryFilterValues\(category\.key,filterDraft\)\}\)\)/);
  assert.match(marketplace, /setDraftByCategory/);
  assert.match(marketplace, /setAppliedByCategory\(current=>\(\{\.\.\.current,\[category\.key\]:\{\}\}\)\)/);
  assert.match(marketplace, /category\.source==='vehicle'&&field\.key==='brand'\?\{model:''\}/);
  assert.match(marketplace, /contentContainerStyle=\{\{paddingBottom:160\}\}/);
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
