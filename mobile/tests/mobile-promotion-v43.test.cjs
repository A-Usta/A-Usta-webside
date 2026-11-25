const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mobileCatalogSource = fs.readFileSync(path.join(root, 'src/lib/marketplace.ts'), 'utf8');
const screenSource = fs.readFileSync(path.join(root, 'src/components/MarketplaceScreens.tsx'), 'utf8');
const webSource = fs.readFileSync(path.resolve(root, '../index.html'), 'utf8');

test('mobile promotion catalog matches canonical V157 plan codes and prices', () => {
  const canonical = webSource.match(/const AUSTA_V157_PACKAGE_CATALOG = Object\.freeze\(([\s\S]*?)\n\}\);/);
  assert.ok(canonical, 'canonical website promotion catalog exists');
  const webPlans = [...canonical[1].matchAll(/code:\s*'([^']+)'[\s\S]*?price:\s*([\d.]+)/g)].map(([, code, price]) => [code, Number(price)]);
  const mobilePlans = [...mobileCatalogSource.matchAll(/code:\s*'([^']+)'[\s\S]*?price:\s*([\d.]+)/g)].map(([, code, price]) => [code, Number(price)]);
  assert.deepEqual(mobilePlans, webPlans);
  assert.equal(webPlans.length, 12);
});

test('active listing owners can inspect all promotion tariffs from the detail screen', () => {
  assert.match(screenSource, /isOwner&&item\.status==='active'/);
  assert.match(screenSource, /\['boost','vip','premium'\] as PromotionType\[\]/);
  assert.match(screenSource, /PROMOTION_CATALOG\[type\]/);
  assert.match(screenSource, /accessibilityLabel=\{`\$\{tariff\.name\} tariflərini aç`\}/);
  assert.match(screenSource, /Paket yalnız ödəniş təsdiqindən sonra aktivləşir/);
});

test('mobile tariff confirmation does not write promotion fields or claim activation', () => {
  assert.match(screenSource, /Ödəniş xidməti qoşulmayıb/);
  assert.match(screenSource, /elan dəyişdirilmədi və paket aktiv edilmədi/);
  assert.doesNotMatch(screenSource, /\.update\(\{\s*promotion_(type|until|started_at)/);
});
