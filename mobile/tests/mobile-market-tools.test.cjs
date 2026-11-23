const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('official vehicle customs calculator is embedded and navigation is restricted to official customs domains', () => {
  const tools = read('src/components/MarketTools.tsx');
  const core = read('src/lib/marketTools.ts');
  assert.match(core, /https:\/\/www\.e\.customs\.gov\.az\/for-individuals\/calculator\/auto/);
  assert.match(tools, /onShouldStartLoadWithRequest=\{allowOfficialNavigation\}/);
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
