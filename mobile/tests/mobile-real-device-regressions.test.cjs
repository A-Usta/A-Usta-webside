const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const marketplace = fs.readFileSync(path.join(root, 'src/lib/marketplace.ts'), 'utf8');
const screens = fs.readFileSync(path.join(root, 'src/components/MarketplaceScreens.tsx'), 'utf8');
const videoFeed = fs.readFileSync(path.join(root, 'src/components/VideoFeedScreen.tsx'), 'utf8');
const drawer = fs.readFileSync(path.join(root, 'src/components/ServiceDrawer.tsx'), 'utf8');

test('public video query is restricted to car/rent and dealer source tables', () => {
  const sourceBlock = marketplace.match(/export async function listHomeVideos[\s\S]*?const perSourceTarget/);
  assert.ok(sourceBlock);
  assert.match(sourceBlock[0], /source:'vehicle'[\s\S]*source:'auto_dealer'/);
  assert.doesNotMatch(sourceBlock[0], /source:'marketplace'|source:'service_provider'/);
  assert.match(marketplace, /query=query\.in\('listing_type',\['sale','rent'\]\)/);
  assert.match(videoFeed, /listHomeVideos\(client\)/);
});

test('home video cards use explicit screen-based width and a fixed 9:16 cover', () => {
  assert.match(screens, /videoCarouselCardWidth\(windowWidth\)/);
  assert.match(screens, /videoCarouselCardWidth\(windowWidth:number\)/);
  assert.match(screens, /videoCover:\{width:'100%',aspectRatio:9\/16/);
  for (const width of [320, 360, 390, 412]) {
    const card = Math.max(120, Math.round((width - 28) * 0.44));
    assert.ok(card > 0 && card < width / 2);
    assert.ok(card * 2 + 9 < width - 28);
  }
});

test('category filters collapse and detail gallery supports horizontal swipe and thumbnails', () => {
  assert.match(screens, /accessibilityState=\{\{expanded:filtersOpen\}\}/);
  assert.match(screens, /setFiltersOpen\(value=>!value\)/);
  assert.match(screens, /<ScrollView ref=\{galleryRef\} horizontal nestedScrollEnabled pagingEnabled/);
  assert.match(screens, /galleryRef\.current\?\.scrollTo/);
});

test('similar-listing errors and empty results have visible detail states', () => {
  assert.match(screens, /Oxşar elanları yükləmək olmadı/);
  assert.match(screens, /Bu kateqoriyada uyğun aktiv elan yoxdur/);
});

test('message and phone actions remain wired and mobile wordmarks use approved red', () => {
  assert.match(screens, /onPress=\{\(\)=>void openMessage\(\)\}/);
  assert.match(screens, /austa_open_listing_conversation/);
  assert.match(screens, /austa_send_listing_message/);
  assert.match(drawer, /wordmark: \{ color: RED/);
  assert.match(screens, /brand:\{fontSize:21,fontWeight:'900',letterSpacing:1,color:RED/);
});
