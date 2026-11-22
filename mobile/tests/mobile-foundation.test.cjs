const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const client = fs.readFileSync(path.join(root, 'src/lib/supabase.ts'), 'utf8');
const tabs = fs.readFileSync(path.join(root, 'src/app/(drawer)/(tabs)/_layout.tsx'), 'utf8');
const drawer = fs.readFileSync(path.join(root, 'src/app/(drawer)/_layout.tsx'), 'utf8');

test('Expo Router exposes five mobile tabs and the left service drawer', () => {
  for (const name of ['index', 'favorites', 'create', 'messages', 'account']) assert.match(tabs, new RegExp(`<Tabs\\.Screen name="${name}"`));
  assert.match(drawer, /drawerType: 'front'/);
  assert.match(drawer, /swipeEnabled: true/);
  const keys = [...app.matchAll(/\{ title: '([^']+)', key: '([^']+)'/g)].map(match => match[2]);
  assert.deepEqual(keys.slice(0, 5), ['mechanic_service', 'tow_service', 'cargo_service', 'locations', 'carcare']);
  assert.match(app, /setOpen\(value => !value\)/);
});

test('all supported listing categories and CarCareKiosk destination are present', () => {
  const keys = [...app.matchAll(/\['([^']+)', '([^']+)',/g)].map(match => match[1]);
  for (const key of ['cars', 'dealer', 'service', 'rent', 'parts', 'accessories', 'moto', 'special', 'bus', 'trailer', 'water', 'caravan', 'plate', 'usta', 'insurance', 'sober_driver', 'leasing']) assert(keys.includes(key), `missing category ${key}`);
  assert.match(app, /https:\/\/www\.carcarekiosk\.com\//);
  assert.match(app, /Linking\.openURL\(CARCARE_URL\)/);
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
