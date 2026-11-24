const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const marketplaceSource = read('src/lib/marketplace.ts');
const appSource = read('src/components/MarketplaceScreens.tsx');
const supabaseSource = read('src/lib/supabase.ts');
const tsModule = { exports: {} };
const js = ts.transpile(marketplaceSource, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
vm.runInNewContext(`(function(exports,module){${js}\n})(module.exports,module)`, { module: tsModule });
const { CATEGORIES, CATEGORY_FILTERS, categoryFilterError, categoryFilterValues, categoryConfig, listCategory, promotionRank, sortListings } = tsModule.exports;
const formOptionsModule = { exports: {} };
const formOptionsJs = ts.transpile(read('src/lib/listing-form-options.ts'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
vm.runInNewContext(`(function(exports,module){${formOptionsJs}\n})(module.exports,module)`, { module: formOptionsModule });
const { listingFieldChoices } = formOptionsModule.exports;

test('17 active categories route to the existing public source and media bucket', () => {
  assert.equal(CATEGORIES.length, 17);
  assert.equal(new Set(CATEGORIES.map(item => item.key)).size, 17);
  for (const item of CATEGORIES) {
    assert.equal(item.status, 'active');
    assert.ok(item.table && item.mediaTable && item.bucket, item.key);
  }
  assert.equal(categoryConfig('cars').table, 'vehicle_listings');
  assert.equal(categoryConfig('rent').sourceValue, 'rent');
  assert.equal(categoryConfig('dealer').table, 'auto_dealer_listings');
  assert.equal(categoryConfig('service').table, 'public_service_provider_listings');
  assert.equal(categoryConfig('usta').sourceValue, 'usta');
  assert.equal(categoryConfig('leasing').sourceValue, 'leasing');
  assert.equal(categoryConfig('parts').table, 'marketplace_listings');
});

test('all 17 homepage categories expose their own real-query filters and clear stale values', () => {
  assert.equal(Object.keys(CATEGORY_FILTERS).length, 17);
  for (const category of CATEGORIES) assert.ok(CATEGORY_FILTERS[category.key].length > 0, category.key);
  assert.deepEqual(Array.from(CATEGORY_FILTERS.cars, field => field.key), ['brand','model','year','price','price_max','mileage']);
  assert.ok(CATEGORY_FILTERS.rent.some(field => field.key === 'daily_price'));
  assert.ok(CATEGORY_FILTERS.parts.some(field => field.key === 'title'));
  assert.ok(CATEGORY_FILTERS.usta.some(field => field.key === 'specialty'));
  assert.ok(CATEGORY_FILTERS.service.some(field => field.key === 'region'));
  assert.equal(JSON.stringify(categoryFilterValues('parts', { title:'far', brand:'BMW', mileage:'90000', model:'' })), JSON.stringify({ title:'far', brand:'BMW' }));
  assert.match(categoryFilterError('cars', { price:'9000', price_max:'5000' }), /minimum maksimumdan böyük/);
  assert.match(categoryFilterError('rent', { daily_price:'-1' }), /müsbət rəqəm/);
});

test('each category filter is applied to its configured live query column', async () => {
  for (const category of CATEGORIES) {
    const field = CATEGORY_FILTERS[category.key][0];
    const calls = [];
    const query = {};
    for (const method of ['select','eq','in','contains','or','ilike','gte','lte','order','range']) query[method] = (...args) => { calls.push([method,...args]); return query; };
    query.then = (resolve,reject) => Promise.resolve({data:[],error:null}).then(resolve,reject);
    const client = { from: table => { calls.push(['from',table]); return query; } };
    const value = field.kind === 'number' ? '100' : 'test';
    await listCategory(client,category,{filters:{[field.key]:value}});
    assert.ok(calls.some(call => call[0] === 'from' && call[1] === category.table), category.key+' table');
    assert.ok(calls.some(call => ['ilike','gte','lte'].includes(call[0]) && call[1] === field.column), category.key+' filter '+field.column);
  }
});

test('homepage switches the selected category above adaptive search and queries its real table', () => {
  assert.match(appSource, /CATEGORIES\.map\(c=>/);
  assert.match(appSource, /setHomeCategory\(c\.key\);setSearch\(''\);setHomeBrand\(''\);setHomeModel\(''\);setDraftFilters\(\{\}\);setAppliedFilters\(\{\}\)/);
  assert.match(appSource, /listCategory\(sb,activeCategory,\{from:0,to:39,search,brand:homeBrand,model:homeModel,filters:appliedFilters\}\)/);
  assert.match(appSource, /CATEGORY_FILTERS\[homeCategory\]/);
});

test('mobile vehicle brand/model choices match the canonical repository catalog', () => {
  const source = path.resolve(root, '../assets/vehicle/catalog.js');
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(source, 'utf8'), context, { timeout: 1000 });
  const mobile = JSON.parse(read('src/data/vehicle-catalog.json'));
  const canonical = context.window.AUSTA_VEHICLE_CATALOG;
  assert.equal(JSON.stringify(mobile.brands), JSON.stringify(canonical.brands));
  assert.equal(JSON.stringify(mobile.popular), JSON.stringify(canonical.popular));
  assert.equal(JSON.stringify(mobile.models), JSON.stringify(canonical.models));
  assert.match(appSource, /CatalogPicker title="Marka seçin"/);
  assert.match(appSource, /CatalogPicker title="Model seçin"/);
});

test('active Premium/VIP/boost promotions sort separately and expired promotions fall back', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const rows = [
    { id:'standard', created_at:'2026-11-21T09:00:00Z' },
    { id:'vip', promotion_type:'vip', promotion_until:future },
    { id:'premium-expired', promotion_type:'premium', promotion_until:past },
    { id:'premium', promotion_type:'premium', promotion_until:future },
    { id:'boost', promotion_type:'standard', last_boosted_at:future, promotion_until:future },
  ];
  assert.deepEqual(rows.map(promotionRank), [0,2,0,3,1]);
  assert.deepEqual(Array.from(sortListings(rows), item => item.id), ['premium','vip','boost','standard','premium-expired']);
});

test('mobile uses owner-scoped listing updates, staging statuses, CAS publish and signed media', () => {
  assert.match(appSource, /owner_id',user\.id/);
  assert.match(appSource, /eq\('status',data\.status\)/);
  assert.match(appSource, /eq\('status',conf\.staging\)/);
  assert.match(appSource, /staging:'draft'/);
  assert.match(appSource, /staging:'inactive'/);
  assert.match(marketplaceSource, /createSignedUrl\(item\.storage_path,3600\)/);
  assert.match(marketplaceSource, /eq\('status','active'\)/);
  assert.match(marketplaceSource, /public_service_provider_listings/);
});

test('mobile uses the public anon key only and real listing RPCs for view/report/chat', () => {
  assert.match(supabaseSource, /EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(supabaseSource, /service_role|SERVICE_ROLE/i);
  assert.match(appSource, /austa_record_listing_detail_view/);
  assert.match(appSource, /austa_report_listing/);
  assert.match(appSource, /austa_open_listing_conversation/);
  assert.match(appSource, /austa_send_listing_message/);
});


test('marketplace form has data, media, preview, draft, and publish steps', () => {
  assert.match(appSource, /formStep===0/);
  assert.match(appSource, /formStep===1/);
  assert.match(appSource, /formStep===2/);
  assert.match(appSource, /Qaralama saxla/);
  assert.match(appSource, /get_my_seller_profiles/);
  assert.match(appSource, /eq\('owner_id',user\.id\)/);
  assert.match(appSource, /eq\('status',conf\.staging\)/);
  assert.match(appSource, /uploadListingMedia\(sb,conf\.bucket,path,file,key/);
  assert.doesNotMatch(appSource, /fetch\(file\.uri\).*response\.blob\(\)/);
  assert.match(appSource, /publishFlight=useRef\(false\)/);
  assert.match(appSource, /if\(saving\|\|publishFlight\.current\)return/);
});

test('Avtoservis category separates company subtypes and retains server-owned seller checks', () => {
  assert.match(marketplaceSource, /details->>service_category\.is\.null,details->>service_category\.not\.in\.\(insurance,leasing,sober_driver\)/);
  assert.match(marketplaceSource, /createSignedUrl\(item\.storage_path,3600\)/);
  assert.match(appSource, /rpc\('get_my_seller_profiles'\)/);
});

test('message retry keeps the same idempotency key until success', () => {
  assert.match(appSource, /messageRequestId\|\|newUuid\(\)/);
  assert.match(appSource, /setMessageRequestId\(''\)/);
});

test('mobile equipment choices and detail values match the website category catalog', () => {
  const source = fs.readFileSync(path.resolve(root, '../assets/marketplace/listing-detail-v36.js'), 'utf8');
  const start = source.indexOf('/* Category-specific optional equipment for V3.6 listing create/edit forms. */');
  const context = { window: {} };
  vm.runInNewContext(source.slice(start), context);
  const mobileCatalog = JSON.parse(read('src/data/listing-equipment.json'));
  assert.equal(JSON.stringify(mobileCatalog), JSON.stringify(context.window.AUSTA_LISTING_EQUIPMENT_V36.catalog));
  assert.match(appSource, /details\.equipment=JSON\.stringify\(selectedEquipment\(values\.equipment,category\.key\)\)/);
  assert.match(appSource, /accessibilityRole="checkbox"/);
  assert.match(appSource, /<Equipment item=\{item\}\/?>/);

  const helperSource = read('src/lib/listing-equipment.ts');
  const helperJs = ts.transpile(helperSource, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  const helperModule = { exports: {} };
  vm.runInNewContext(`(function(exports,module,require){${helperJs}\n})(module.exports,module,require)`, {
    module: helperModule,
    require: name => name === '../data/listing-equipment.json' ? mobileCatalog : {},
  });
  const { equipmentValue, selectedEquipment } = helperModule.exports;
  