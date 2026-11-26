const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../src/components/ServiceScreens.tsx'), 'utf8');

test('nearby public providers open precise coordinates in Google Maps navigation', () => {
  assert.match(source, /const openDirections=async\(p:PublicProvider\)=>[\s\S]*google\.com\/maps\/dir\/\?api=1&destination=/);
  assert.match(source, /title="Marşrut qur"/);
  assert.match(source, /react-native-maps/);
  assert.match(source, /Permission===|permission==='granted'/);
  assert.match(source, /Axtarış radiusu/);
  assert.match(source, /distanceBetweenKm\(center/);
  assert.match(source, /radiusKm/);
  assert.match(source, /mapFilters\.map\(item/);
});

test('nearby services gracefully handle location denial and service-area-only providers', () => {
  assert.match(source, /Məkan icazəsi verilmədi/);
  assert.match(source, /Dəqiq ünvan yoxdur/);
  assert.match(source, /Xidmət ərazisi/);
  assert.match(source, /mapLoadError=/);
  assert.match(source, /Siyahı görünüşü/);
  assert.match(source, /googleMapsAndroidConfigured===true/);
  assert.match(source, /Google Maps Android TEST açarı konfiqurasiya edilmədiyi üçün xəritə açılmadı/);
  assert.match(source, /if\(!androidMapConfigured\)\{mapLoadError=/);
  const config = fs.readFileSync(path.resolve(__dirname, '../app.config.js'), 'utf8');
  assert.match(config, /googleMapsAndroidConfigured: Boolean\(mapsKey\)/);
  assert.match(config, /GOOGLE_MAPS_ANDROID_API_KEY/);
});

test('nearby category expansion retains the consented public DTO policy and does not weaken RLS',()=>{
  const migration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261126123000_v4311_public_map_categories.sql'),'utf8');
  for(const category of ['fuel','charging','auto_service','vulcanization','car_wash','parts_shop','auto_electrician','oil_change','diagnostics','inspection','towing','parking','other_auto'])assert.ok(migration.includes(`'${category}'`),category);
  assert.match(migration,/m\.enabled AND m\.consent AND m\.consent_at IS NOT NULL/);
  assert.match(migration,/sp\.verification_status='verified'/);
  assert.doesNotMatch(migration,/DISABLE ROW LEVEL SECURITY|CREATE POLICY|DROP POLICY|GRANT\s+ALL/i);
});

test('Google Places requests use authenticated TEST backend only and never embed the server key',()=>{
  const client=fs.readFileSync(path.resolve(__dirname,'../src/lib/service-orders.ts'),'utf8');
  assert.match(client,/export async function searchGooglePlaces/);
  assert.match(client,/EXPO_PUBLIC_APP_ENV\?\.trim\(\)\.toLowerCase\(\) !== 'test'/);
  assert.match(client,/\/places\/nearby-search/);
  assert.match(client,/serviceRequest<\{ places: GooglePlaceResult\[\]/);
  assert.doesNotMatch(client,/GOOGLE_PLACES_API_KEY|X-Goog-Api-Key/);
  const screen=fs.readFileSync(path.resolve(__dirname,'../src/components/ServiceScreens.tsx'),'utf8');
  assert.match(screen,/Platform\.OS==='android'&&process\.env\.EXPO_PUBLIC_APP_ENV\?\.trim\(\)\.toLowerCase\(\)==='test'\?searchGooglePlaces/);
});
