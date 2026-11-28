const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const marketplace = read('src/lib/marketplace.ts');
const owned = read('src/lib/owned-listings.ts');
const screens = read('src/components/MarketplaceScreens.tsx');
const video = read('src/components/VideoFeedScreen.tsx');
const appLayout = read('src/app/_layout.tsx');
const rootRoute = read('src/app/index.tsx');

function loadNavigation() {
  const filename = path.join(root, 'src/lib/navigation.ts');
  const js = ts.transpile(read('src/lib/navigation.ts'), { module: ts.ModuleKind.CommonJS });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(js, filename);
  return mod.exports;
}

test('draft writes return only granted fields and owner reads avoid protected lifecycle columns', () => {
  assert.match(screens, /insert\(\{id,\.\.\.payload\}\)\.select\('id,status'\)/);
  assert.match(screens, /select\(OWNER_LISTING_SELECT\[category\.source\](?: as any)?\)/);
  assert.match(screens, /select\(OWNER_LISTING_SELECT\[source\](?: as any)?\)/);
  assert.match(screens, /select\(OWNER_LISTING_SELECT\[source\](?: as any)?\)\.eq\('owner_id',userId\)/);
  assert.match(screens, /mediaFor\(key\)\.table\)\.select\(OWNER_LISTING_SELECT\[category\.source\](?: as any)?\)/);
  assert.doesNotMatch(screens, /from\(table\)\.insert\([\s\S]{0,80}\.select\('\*'\)/);
  assert.match(owned, /select\(OWNER_LISTING_SELECT\[category\.source\](?: as any)?\)/);
  assert.doesNotMatch(marketplace.match(/export const OWNER_LISTING_SELECT[\s\S]*?\n\};/)?.[0] || '', /first_published_at/);
  const providerProjection = marketplace.match(/service_provider:'([^']+)'/)?.[1] || '';
  assert.ok(providerProjection.length > 0);
  assert.doesNotMatch(providerProjection, /first_published_at|expires_at/);
});

test('listing detail prefers the public DTO and uses an owner-scoped allowed projection only for private states', () => {
  const getListing = marketplace.match(/export async function getListing[\s\S]*?\n\}/)?.[0] || '';
  assert.match(getListing, /readPublicListing\(client,category,id\)/);
  assert.match(getListing, /select\(OWNER_LISTING_SELECT\[category\.source\](?: as any)?\)\.eq\('id',id\)\.eq\('owner_id',auth\.user\.id\)/);
  assert.ok(getListing.indexOf('readPublicListing') < getListing.indexOf('OWNER_LISTING_SELECT'));
  assert.doesNotMatch(getListing, /select\('\*'\)/);
  assert.match(video, /pathname:'\/listing\/\[id\]',params:\{id:row\.id,key:row\._category\}/);
  assert.match(screens, /pathname:'\/listing\/\[id\]',params:\{id:item\.id,key:item\._category\}/);
});

test('top-left and video back actions use an empty-stack fallback; the canonical root route remains valid', () => {
  const { safeRouterBack } = loadNavigation();
  const calls = [];
  const empty = { canGoBack: () => false, back: () => calls.push('back'), replace: route => calls.push(['replace', route]) };
  assert.equal(safeRouterBack(empty), 'fallback');
  assert.deepEqual(calls, [['replace', '/(drawer)/(tabs)']]);
  const stack = { canGoBack: () => true, back: () => calls.push('back'), replace: route => calls.push(['replace', route]) };
  assert.equal(safeRouterBack(stack), 'back');
  assert.equal(calls.at(-1), 'back');
  assert.match(screens, /accessibilityLabel="Geri" onPress=\{\(\)=>safeRouterBack\(router\)\}/);
  assert.match(video, /accessibilityLabel="Geri" onPress=\{\(\)=>safeRouterBack\(router\)\}/);
  assert.match(appLayout, /router\.replace\('\/\(drawer\)\/\(tabs\)'\)/);
  assert.match(rootRoute, /<Redirect href="\/\(drawer\)\/\(tabs\)"\s*\/>/);
  assert.doesNotMatch(screens, /onPress=\{\(\)=>router\.back\(\)\}/);
  assert.doesNotMatch(video, /router\.back\(\)/);
});
