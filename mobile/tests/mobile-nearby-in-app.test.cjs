const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../src/components/ServiceScreens.tsx'), 'utf8');

test('nearby services stay inside the app and focus the native map on a selected provider', () => {
  assert.match(source, /const openDirections=async\(p:PublicProvider\)=>[\s\S]*setSelected\(p\);setRegion\(/);
  assert.match(source, /title="Xəritədə göstər"/);
  assert.match(source, /react-native-maps/);
  assert.match(source, /Permission===|permission==='granted'/);
  assert.doesNotMatch(source, /google\.com\/maps\/dir/);
  assert.doesNotMatch(source, /Linking\.openURL\(url\)/);
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
