const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const marketplace = fs.readFileSync(path.join(root, 'src/lib/marketplace.ts'), 'utf8');
const screens = fs.readFileSync(path.join(root, 'src/components/MarketplaceScreens.tsx'), 'utf8');
const videoFeed = fs.readFileSync(path.join(root, 'src/components/VideoFeedScreen.tsx'), 'utf8');
const drawer = fs.readFileSync(path.join(root, 'src/components/ServiceDrawer.tsx'), 'utf8');
const account = fs.readFileSync(path.join(root, 'src/components/AccountScreens.tsx'), 'utf8');

test('public video query is restricted to car/rent and dealer source tables', () => {
  const sourceBlock = marketplace.match(/export async function listHomeVideos[\s\S]*?const perSourceTarget/);
  assert.ok(sourceBlock);
  assert.match(sourceBlock[0], /source:'vehicle'[\s\S]*source:'auto_dealer'/);
  assert.doesNotMatch(sourceBlock[0], /source:'marketplace'|source:'service_provider'/);
  assert.match(marketplace, /eq\('source',source\.source\)/);
  assert.match(marketplace, /from\('austa_public_listing_feed'\)/);
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
  assert.match(fs.readFileSync(path.join(root, 'src/app/category/[key].tsx'), 'utf8'), /<MarketplaceCategoryScreen key=\{String\(key\)\}/);
  assert.match(screens, /draftByCategory/);
  assert.match(screens, /appliedByCategory/);
  assert.match(screens, /return <ScrollView style=\{styles\.screen\} contentContainerStyle=\{styles\.content\} refreshControl=/);
  assert.match(screens, /<ScrollView ref=\{galleryRef\} horizontal nestedScrollEnabled pagingEnabled/);
  assert.match(screens, /galleryRef\.current\?\.scrollTo/);
});

test('similar-listing errors and empty results have visible detail states', () => {
  assert.match(screens, /Oxşar elanları yükləmək olmadı/);
  assert.match(screens, /Bu kateqoriyada uyğun aktiv elan yoxdur/);
  assert.match(screens, /listCategory\(sb,category,\{from:0,to:199\}\)/);
  assert.match(screens, /row\.id!==found\.id&&row\._source===found\._source&&row\._category===found\._category&&row\.status==='active'/);
  assert.match(screens, /onOpen=\{\(\)=>router\.push\(\{pathname:'\/listing\/\[id\]'/);
  assert.ok(screens.indexOf('<Equipment item={item}/>') < screens.indexOf('<Text style={styles.heading}>Satıcı</Text>'));
  assert.ok(screens.indexOf('<Text style={styles.heading}>Satıcıdan soruşun</Text>') < screens.indexOf('<Text style={styles.heading}>Satıcı</Text>'));
  assert.ok(screens.indexOf('<Text style={styles.heading}>Satıcı</Text>') < screens.indexOf('Elanı irəli çəkin'));
  assert.ok(screens.indexOf('Elanı irəli çəkin') < screens.indexOf('Elanı sil</Text>'));
  assert.ok(screens.indexOf('Elanı sil</Text>') < screens.indexOf('<Section title="Oxşar elanlar"'));
});

test('message send does not show success without persisted RPC row and inbox refreshes replies', () => {
  assert.match(screens, /austa_send_listing_message'[\s\S]*?sent\.data\)\|\|sent\.data\.length===0/);
  assert.match(screens, /setInterval\(\(\)=>void refresh\(\),7000\)/);
  assert.match(screens, /messageRequestBody===message&&messageRequestId\?messageRequestId:newUuid\(\)/);
  assert.match(screens, /austa_mark_listing_messages_read/);
});

test('message and phone actions remain wired and mobile wordmarks use approved red', () => {
  assert.match(screens, /onPress=\{\(\)=>void openMessage\(\)\}/);
  assert.match(screens, /austa_open_listing_conversation/);
  assert.match(screens, /austa_send_listing_message/);
  assert.match(drawer, /wordmark: \{ color: '#FFFFFF', backgroundColor: RED/);
  assert.match(screens, /color:RED,backgroundColor:'transparent'/);
});

test('home video opens its selected item directly and closes to the retained home route', () => {
  assert.match(screens, /pathname:'\/videos',params:\{listingId:item\.id,source:item\._source,index:String\(index\),direct:'1'\}/);
  assert.match(videoFeed, /if\(directOpen\)\{router\.back\(\);return;\}setViewerOpen\(false\)/);
  assert.match(videoFeed, /onRequestClose=\{closeViewer\}/);
  assert.match(videoFeed, /directOpen\?\(loading\|\|\(!viewerOpen&&!error&&!directUnavailable\)\?</);
  assert.match(videoFeed, /!directOpen&&<View style=\{s\.header\}/);
  assert.match(videoFeed, /resolveHomeVideoIndex\(rows,params\.listingId,params\.source,params\.index\)/);
});

test('video viewer resolves the requested identity and stable sequence index', () => {
  assert.match(marketplace, /rows\[index\]\?\.id===listingId/);
  assert.match(marketplace, /rows\[index\]\?\._source===source/);
  assert.match(videoFeed, /resolveHomeVideoIndex\(rows,params\.listingId,params\.source,params\.index\)/);
  assert.match(videoFeed, /Seçilmiş video artıq aktiv deyil və ya video lentində tapılmadı/);
  assert.match(videoFeed, /onMomentumScrollEnd=\{onMomentumEnd\}/);
  assert.match(videoFeed, /active=\{viewerOpen&&index===selectedIndex\}/);
  assert.match(marketplace, /videos\.sort\(\(a,b\)=>\(Number\(a\.sort_order\)\|\|0\)/);
  assert.match(marketplace, /export function sortHomeVideos\(rows:Listing\[\]\)/);
  assert.match(marketplace, /return bTime-aTime\|\|`\$\{a\._source\}:\$\{a\.id\}`\.localeCompare\(`\$\{b\._source\}:\$\{b\.id\}`\)/);
});

test('mobile home brand preserves requested case on red with no uppercase transform', () => {
  const header = screens.match(/headerBrand[^\n]*A-Usta\.az/);
  assert.ok(header);
  assert.match(header[0], /color:RED/);
  assert.match(header[0], /backgroundColor:'transparent'/);
  assert.match(header[0], /textTransform:'none'/);
  assert.doesNotMatch(header[0], /A-USTA\.az/);
});

test('account navigation keeps its auth listener stable and hardware back returns safely', () => {
  assert.match(account, /onAuthStateChange\(\(event,session\)=>/);
  assert.match(account, /\},\[sb\]\);/);
  assert.doesNotMatch(account, /onAuthStateChange[\s\S]{0,280}\},\[sb,sync\]\)/);
  assert.match(account, /pageHistory=useRef<Page\[]>\(\[\]\)/);
  assert.match(account, /const navigatePage=useCallback/);
  const backHandler = account.match(/useEffect\(\(\)=>\{const subscription=BackHandler\.addEventListener\('hardwareBackPress'[\s\S]*?\},\[page,formVisible,preview,back\]\);/);
  assert.ok(backHandler);
  assert.match(backHandler[0], /back\(\);return true/);
  assert.match(account, /accessibilityLabel="Geri" onPress=\{back\}/);
  assert.match(account, /router\.replace\('\/\(drawer\)\/\(tabs\)\/index'\)/);
  assert.doesNotMatch(backHandler[0], /signOut\(/);
});

test('adding a vehicle clears the previously selected vehicle so the save inserts a new row', () => {
  assert.match(account, /const newVehicle=\(\)=>\{setVehicle\(null\);/);
  assert.match(account, /const newVehicle=[\s\S]*?setFormVisible\(true\)/);
  assert.match(account, /const q=vehicle\?sb\.from\('vehicles'\)\.update\(payload\)[\s\S]*?:sb\.from\('vehicles'\)\.insert\(\{\.\.\.payload,user_id:user\.id\}\)/);
});

test('listing detail uses balance scale icon, circular blue up arrow, and exact owner edit label', () => {
  assert.match(screens, /MaterialCommunityIcons name="scale-balance"/);
  assert.match(screens, /accessibilityLabel="Satıcıya mesaj göndər"[\s\S]*?borderRadius:25[\s\S]*?backgroundColor:'#4884EF'[\s\S]*?<Feather name="arrow-up" color="#fff"/);
  assert.match(screens, />Elanı redaktə et<\/Text>/);
  assert.match(screens, /isOwner&&<>[\s\S]*?Elanı redaktə et[\s\S]*?Elanı sil/);
});
