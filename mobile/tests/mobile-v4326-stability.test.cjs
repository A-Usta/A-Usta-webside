const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const source=(file)=>fs.readFileSync(path.join(root,file),'utf8');

test('bare austa scheme resolves to the registered home tab instead of unmatched route',()=>{
  const route=source('src/app/index.tsx');
  assert.match(route,/<Redirect href="\/\(drawer\)\/\(tabs\)"\s*\/>/);
  const layout=source('src/app/_layout.tsx');
  assert.match(layout,/<Stack\.Screen name="\(drawer\)"/);
  assert.match(layout,/router\.replace\('\/\(drawer\)\/\(tabs\)'\)/);
});

test('Android back delegates to native stack, returns to home, then double-press exits without signing out',()=>{
  const layout=source('src/app/_layout.tsx');
  assert.match(layout,/BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(layout,/if \(!isHome && router\.canGoBack\(\)\) return false/);
  assert.match(layout,/now - lastHomeBackAt\.current <= 2000/);
  assert.match(layout,/ToastAndroid\.show\('Çıxmaq üçün bir daha basın'/);
  assert.match(layout,/BackHandler\.exitApp\(\)/);
  assert.doesNotMatch(layout,/auth\.signOut|signOut\(/);
});

test('home and category filter states consume Android back before route handling',()=>{
  const screens=source('src/components/MarketplaceScreens.tsx');
  assert.equal((screens.match(/if\(!filtersOpen\)return;const subscription=BackHandler\.addEventListener/g)||[]).length,2);
});

test('marketplace renders feed rows before optional cards/media finish and ignores stale responses',()=>{
  const screens=source('src/components/MarketplaceScreens.tsx');
  assert.match(screens,/const sequence=\+\+loadSequence\.current/);
  assert.match(screens,/setRows\(selected\.slice\(0,12\)\);setLoading\(false\)/);
  assert.match(screens,/attachMediaForCard/);
  assert.match(screens,/const sequence=\+\+categoryLoadSequence\.current/);
  assert.match(screens,/setRows\(sorted\);setLimit\(Math\.min\(20,sorted\.length\)\);[\s\S]*?setLoading\(false\);void getFavoriteKeys\(sb\)\.then\(favorites=>\{if\(current\(\)\)setFavoriteKeys\(favorites\);\}\)\.catch\(\(\)=>\{\}\);const visibleMedia/);
});


test('category and detail screens reveal primary listing data before optional reads finish',()=>{
  const screens=source('src/components/MarketplaceScreens.tsx');
  assert.match(screens,/const \[recent,promoted\]=await Promise\.all/);
  assert.match(screens,/setRows\(sorted\);setLimit\(Math\.min\(20,sorted\.length\)\);[\s\S]*?setLoading\(false\);void getFavoriteKeys\(sb\)\.then\(favorites=>\{if\(current\(\)\)setFavoriteKeys\(favorites\);\}\)\.catch\(\(\)=>\{\}\);const visibleMedia/);
  assert.match(screens,/setItem\(found\);listingReady=true;setLoading\(false\);setSellerProfile\(null\)/);
});
