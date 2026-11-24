const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(path.resolve(__dirname, '../node_modules/typescript'));

const screenPath = path.resolve(__dirname, '../src/components/MarketplaceScreens.tsx');
const screen = fs.readFileSync(screenPath, 'utf8');
const parsed = ts.createSourceFile(screenPath, screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'parentPayload');
assert.ok(declaration, 'parentPayload function must remain present');
const executable = ts.transpile(declaration.getFullText(parsed), { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 });
const context = {
  mediaFor: key => ({ staging: key === 'cars' || key === 'rent' ? 'draft' : 'inactive' }),
  numericValue: value => value === undefined || value === '' ? null : Number(String(value).replace(',', '.')),
  equipmentOptions: key => key === 'cars' || key === 'rent' ? ['ABS'] : ['ABS'],
  selectedEquipment: raw => Array.isArray(raw) ? raw : JSON.parse(raw || '[]'),
};
vm.createContext(context);
vm.runInContext(`${executable}\nglobalThis.buildPayload = parentPayload;`, context);

// Snapshot of the read-only TEST Supabase information_schema after migration 20261119120000.
const columns = {
  vehicle_listings: new Set('id owner_id listing_type status brand model year mileage body_type fuel_type transmission engine color price daily_price deposit region district address latitude longitude description phone has_video created_at updated_at published_at promotion_type promotion_started_at promotion_until last_boosted_at engine_volume horsepower drivetrain vehicle_condition seats damage_condition market barter_available credit_available seller_profile_id vin rental_type contact_name details'.split(' ')),
  auto_dealer_listings: new Set('id owner_id status dealer_name contact_name phone message_contact region district address latitude longitude working_hours brands vehicle_condition credit_available leasing_available barter_available delivery_available about details promotion_type promotion_started_at promotion_until last_boosted_at created_at updated_at published_at seller_profile_id'.split(' ')),
  service_provider_listings: new Set('id owner_id provider_type status title name phone message_contact specialty services about experience working_hours region district address latitude longitude rating reviews_count promotion_type promotion_started_at promotion_until last_boosted_at created_at updated_at published_at details seller_profile_id'.split(' ')),
  marketplace_listings: new Set('id owner_id category status title description price currency brand model year condition region district address phone latitude longitude promotion_type promotion_started_at promotion_until last_boosted_at has_video created_at updated_at published_at details seller_profile_id'.split(' ')),
};
const categorySource = {
  cars: 'vehicle', rent: 'vehicle', dealer: 'auto_dealer',
  service: 'service_provider', usta: 'service_provider', insurance: 'service_provider', leasing: 'service_provider', sober_driver: 'service_provider',
  parts: 'marketplace', accessories: 'marketplace', moto: 'marketplace', special: 'marketplace', bus: 'marketplace', trailer: 'marketplace', water: 'marketplace', caravan: 'marketplace', plate: 'marketplace',
};
const marketplacePath = path.resolve(__dirname, '../src/lib/marketplace.ts');
const marketplaceParsed = ts.createSourceFile(marketplacePath, fs.readFileSync(marketplacePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const typeDeclaration = marketplaceParsed.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'CategoryKey');
const declaredKeys = [...typeDeclaration.type.types].map(node => node.literal.text).sort();
const categories = Object.keys(categorySource).sort();
assert.deepEqual(categories, declaredKeys, 'all 17 declared categories must be covered by the schema contract');

const tableFor = { vehicle: 'vehicle_listings', auto_dealer: 'auto_dealer_listings', service_provider: 'service_provider_listings', marketplace: 'marketplace_listings' };
const values = {
  title: 'Test listing', description: 'Schema contract fixture', price: '1250', phone: '+994500000000', brand: 'Toyota', model: 'Camry', year: '2020', mileage: '50000',
  part_name: 'Part', accessory_name: 'Accessory', special_type: 'Equipment', water_type: 'Boat', trailer_type: 'Trailer', plate_number: '10-AA-100',
  specialty: 'Service', name: 'Seller', company_name: 'Company', city: 'Baku', service_area: 'Baku', region: 'Baku', address: 'Test street',
  equipment: '["ABS"]', rental_type: 'Günlük', order_type: 'order', condition: 'Yeni',
};

test('all 17 category INSERT and UPDATE payload columns match the TEST public schema', () => {
  for (const [key, source] of Object.entries(categorySource)) {
    const category = { key, source, title: key };
    const payload = context.buildPayload(category, values, '00000000-0000-4000-8000-000000000001', null);
    const table = tableFor[source];
    const insert = { id: '00000000-0000-4000-8000-000000000002', ...payload };
    const unknownInsert = Object.keys(insert).filter(column => !columns[table].has(column));
    assert.deepEqual(unknownInsert, [], `${key}: invalid INSERT columns`);
    const requiredByTable = { vehicle_listings: ['owner_id','listing_type','status','brand','model','year','has_video','promotion_type','details'], auto_dealer_listings: ['owner_id','status','dealer_name','credit_available','leasing_available','barter_available','delivery_available','promotion_type','details'], service_provider_listings: ['owner_id','provider_type','status','title','promotion_type','details'], marketplace_listings: ['owner_id','category','status','title','currency','promotion_type','has_video','details'] };
    const invalidNulls = Object.entries(payload).filter(([column, value]) => value === null && requiredByTable[table].includes(column));
    assert.deepEqual(invalidNulls, [], `${key}: explicit NULL violates a required TEST column`);
    const update = { ...payload };
    for (const column of ['owner_id','status','promotion_type','promotion_started_at','promotion_until','last_boosted_at','published_at','has_video','leasing_available','delivery_available']) delete update[column];
    assert.deepEqual(Object.keys(update).filter(column => !columns[table].has(column)), [], `${key}: invalid UPDATE columns`);
  }
});

test('vehicle equipment remains a JSONB details value as the website and migration define it', () => {
  const migration = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261119120000_v36_vehicle_listing_details.sql'), 'utf8');
  assert.match(migration, /ALTER TABLE public\.vehicle_listings[\s\S]*ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '\{\}'::jsonb/);
  const vehicle = context.buildPayload({ key: 'cars', source: 'vehicle', title: 'Cars' }, values, 'owner', null);
  assert.equal(typeof vehicle.details.equipment, 'string');
  assert.deepEqual(JSON.parse(vehicle.details.equipment), ['ABS']);
  assert.equal(Object.hasOwn(vehicle, 'equipment'), false);
});

test('vehicle details column privileges cover website public reads and authenticated owner writes without changing RLS', () => {
  const migration = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261125090000_v42_vehicle_details_column_grants.sql'), 'utf8');
  assert.match(migration, /GRANT SELECT \(details\)[\s\S]*TO anon/);
  assert.match(migration, /GRANT SELECT \(details\), INSERT \(details\), UPDATE \(details\)[\s\S]*TO authenticated/);
  assert.doesNotMatch(migration, /GRANT\s+(?:ALL|SELECT|INSERT|UPDATE)\s+ON TABLE public\.vehicle_listings\s+TO/i);
  assert.doesNotMatch(migration, /CREATE POLICY|ALTER POLICY|DISABLE ROW LEVEL SECURITY/i);
});

test('dealer required flags are false instead of explicit NULL when the form does not offer them', () => {
  const dealer = context.buildPayload({ key: 'dealer', source: 'auto_dealer', title: 'Dealer' }, values, 'owner', null);
  for (const field of ['credit_available','leasing_available','barter_available','delivery_available']) assert.equal(dealer[field], false);
});
