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
  vehicle_listings: new Set('id owner_id listing_type status brand model year mileage body_type fuel_type transmission engine color price daily_price currency deposit region district address latitude longitude description phone has_video created_at updated_at published_at promotion_type promotion_started_at promotion_until last_boosted_at engine_volume horsepower drivetrain vehicle_condition seats damage_condition market barter_available credit_available seller_profile_id vin rental_type contact_name details'.split(' ')),
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

test('vehicle and marketplace payloads retain the selected amount currency and TEST migration constrains it',()=>{
  const migration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261126120000_v4311_vehicle_price_currency.sql'),'utf8');
  assert.match(migration,/ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'AZN'/);
  assert.match(migration,/CHECK \(currency IN \('AZN', 'USD', 'EUR'\)\)/);
  assert.match(migration,/old_currency:=COALESCE\(OLD\.currency,'AZN'\); new_currency:=COALESCE\(NEW\.currency,'AZN'\)/);
  const values={...Object.fromEntries(['price','brand','model','year','mileage','equipment'].map(field=>[field,field==='equipment'?'[]':'100'])),currency:'EUR',title:'Test',phone:'123',region:'Bakı',address:'Bakı'};
  const vehicle=context.buildPayload({key:'cars',source:'vehicle'},values,'owner',null);
  const part=context.buildPayload({key:'parts',source:'marketplace'},values,'owner',null);
  assert.equal(vehicle.price,100);assert.equal(vehicle.currency,'EUR');
  assert.equal(part.price,100);assert.equal(part.currency,'EUR');
});

test('each of the 17 forms has a matching public payload path for every declared field', () => {
  const forms={
    cars:['contact_name','brand','model','year','body_type','engine','engine_volume','horsepower','mileage','price','fuel_type','transmission','drivetrain','vehicle_condition','seats','damage_accident','damage_paint','damage_repair','market','color','vin','region','district','address','phone','description','credit_available','barter_available','equipment'],
    rent:['contact_name','brand','model','year','body_type','engine','engine_volume','horsepower','mileage','price','rental_type','fuel_type','transmission','drivetrain','vehicle_condition','seats','damage_accident','damage_paint','damage_repair','market','color','vin','region','district','address','phone','description','equipment'],
    dealer:['title','contact_name','order_type','phone','region','district','address','brands','condition','working_hours','description'],
    service:['title','name','phone','message_contact','specialty','services','experience','working_hours','region','district','address','description','company_name','city','service_area','brands','price_policy'],
    usta:['title','name','phone','message_contact','specialty','services','experience','working_hours','region','district','address','description','service_area','brands'],
    leasing:['title','name','phone','message_contact','specialty','services','experience','working_hours','region','district','address','description','company_name','tax_id','legal_name','email','website','city','service_area','vehicle_categories','vehicle_condition','customer_types','minimum_down_payment','minimum_term','maximum_term','rate','interest_type','currency','minimum_financing','maximum_financing','guarantor_required','income_proof_required','required_documents','terms','license_reference','license_disclosure'],
    insurance:['title','name','phone','message_contact','specialty','services','experience','working_hours','region','district','address','description','company_name','tax_id','email','website','city','service_area','insurance_types','coverage','franchise','contract_months','payment_methods','installments_available','online_application','claims_support','repair_network','exclusions','license_reference','license_disclosure'],
    sober_driver:['title','name','phone','message_contact','specialty','services','experience','working_hours','region','district','address','description','company_name','tax_id','city','service_area','service_24_7','minimum_order_price','rate_per_km','rate_per_hour','night_rate','city_service','intercity_service','advance_booking','urgent_service','driver_experience','payment_methods','waiting_fee','special_conditions'],
    parts:['title','description','price','region','district','address','phone','part_name','part_category','brand','model','oem','compatibility','condition','stock'],
    accessories:['title','description','price','region','district','address','phone','accessory_name','accessory_type','brand','model','condition','stock'],
    moto:['title','description','price','region','district','address','phone','moto_type','brand','model','year','mileage'],
    special:['title','description','price','region','district','address','phone','special_type','brand','model','year','sale_rent','work_hours'],
    bus:['title','description','price','region','district','address','phone','brand','model','year','capacity','sale_rent'],
    water:['title','description','price','region','district','address','phone','water_type','vessel_type','brand','model','year','length','engine'],
    caravan:['title','description','price','region','district','address','phone','caravan_type','brand','model','year','beds','sale_rent'],
    trailer:['title','description','price','region','district','address','phone','trailer_type','brand','model','year','load_capacity'],
    plate:['title','description','price','region','district','address','phone','plate_number','plate_series','document_status'],
  };
  const sample=Object.fromEntries([...new Set(Object.values(forms).flat())].map(field=>[field,field==='equipment'?'["ABS"]':field==='credit_available'||field==='barter_available'?'true':'10']));
  sample.brand='Toyota';sample.model='Camry';sample.year='2020';sample.price='12500';sample.description='Paritet sınağı';sample.title='Paritet sınağı';sample.phone='+994500000000';sample.address='Bakı';sample.region='Bakı';sample.district='Nəsimi';sample.vin='1HGCM82633A004352';sample.rental_type='Günlük';sample.order_type='order';sample.condition='Yeni';sample.damage_accident='no_accident';sample.damage_paint='original_paint';sample.damage_repair='no_repair_needed';
  const sourceFor={cars:'vehicle',rent:'vehicle',dealer:'auto_dealer',service:'service_provider',usta:'service_provider',leasing:'service_provider',insurance:'service_provider',sober_driver:'service_provider',parts:'marketplace',accessories:'marketplace',moto:'marketplace',special:'marketplace',bus:'marketplace',water:'marketplace',caravan:'marketplace',trailer:'marketplace',plate:'marketplace'};
  for(const [categoryKey,fields] of Object.entries(forms)){
    const payload=context.buildPayload({key:categoryKey,source:sourceFor[categoryKey],title:categoryKey},sample,'owner',null);
    for(const field of fields){
      let persisted=field==='price'&&categoryKey==='rent'?payload.daily_price:payload[field];
      if(persisted===undefined)persisted=payload.details?.[field];
      if(persisted===undefined&&field==='title'&&categoryKey==='dealer')persisted=payload.dealer_name;
      if(persisted===undefined&&field==='description'&&(sourceFor[categoryKey]==='service_provider'||categoryKey==='dealer'))persisted=payload.about;
      if(persisted===undefined&&field==='condition'&&categoryKey==='dealer')persisted=payload.vehicle_condition;
      if(persisted===undefined&&field==='price'&&categoryKey==='rent')persisted=payload.daily_price;
      if(persisted===undefined&&field.startsWith('damage_'))persisted=payload.damage_condition?.[field.slice(7)];
      if(persisted===undefined&&field==='equipment')persisted=payload.details?.equipment;
      assert.notEqual(persisted,undefined,`${categoryKey}.${field} has a form→payload/DB mapping`);
      assert.notEqual(persisted,null,`${categoryKey}.${field} retains a nonempty input`);
    }
  }
});
