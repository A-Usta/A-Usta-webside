const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('App.tsx');
const screens = read('src/components/ServiceScreens.tsx');
const api = read('src/lib/service-orders.ts');
const config = read('app.config.js');

test('drawer keeps all five service destinations and CarCareKiosk stays external', () => {
  for (const key of ['mechanic_service','tow_service','cargo_service','locations','carcare']) assert.match(app, new RegExp(`key: '${key}'`));
  assert.match(app, /https:\/\/www\.carcarekiosk\.com\//);
  assert.match(app, /Linking\.openURL\(CARCARE_URL\)\.catch/);
  assert.match(app, /M4ServiceScreen/);
  assert.match(app, /M4ServiceLocationsScreen/);
});

test('service orders use the owner-authenticated API and existing idempotency field', () => {
  for (const route of ['/service-orders','/service-order-assignments','/price-offer','/evidence/${stage}','/price/${action}']) assert.ok(api.includes(route), route);
  assert.match(api, /Authorization: `Bearer \$\{token\}`/);
  assert.match(api, /client_order_id/);
  assert.match(api, /EXPO_PUBLIC_SERVICE_API_URL/);
  assert.doesNotMatch(api, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.match(screens, /reconcileOrder\(client,clientId\)/);
  assert.match(screens, /Təkrar göndərilmədi/);
  assert.match(screens, /signInWithPassword/);
  assert.match(screens, /auth\.signUp/);
  assert.match(screens, /secureTextEntry/);
  assert.match(screens, /key==='tow_service'&&!clean\(destination\)/);
  assert.match(screens, /clean\(cargoType\)/);
  assert.match(screens, /evidence_files:files/);
  assert.match(screens, /Təsdiqlə/);
  assert.match(screens, /price_status==='confirmed'/);
  assert.match(screens, /BEFORE|AFTER/);
});

test('public nearby search uses the bounded provider RPC and native permission config', () => {
  assert.match(screens, /rpc\('discover_public_providers'/);
  assert.match(screens, /result_offset:next/);
  assert.match(screens, /Math\.min\(region\.latitudeDelta,\.48\)/);
  assert.match(screens, /requestForegroundPermissionsAsync/);
  assert.match(screens, /Xəritədə göstər/);
  assert.doesNotMatch(screens, /google\.com\/maps\/dir/);
  assert.doesNotMatch(screens, /geoapify\.com|api\.geoapify/i);
  assert.match(config, /expo-location/);
  assert.match(config, /react-native-maps/);
});
