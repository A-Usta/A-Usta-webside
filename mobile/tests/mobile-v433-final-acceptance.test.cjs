const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const screen = read('src/components/MarketplaceScreens.tsx');
const marketplace = read('src/lib/marketplace.ts');
const migration = fs.readFileSync(path.resolve(root, '../supabase/migrations/20261125170000_v433_promotion_payment_intents.sql'), 'utf8');
const payloadSource = screen.slice(screen.indexOf('function parentPayload'));

test('all 17 active categories expose a listing form and a generic public details renderer', () => {
  const categoryKeys = ['cars','dealer','service','rent','parts','accessories','moto','special','bus','trailer','water','caravan','plate','usta','insurance','sober_driver','leasing'];
  for (const key of categoryKeys) assert.match(marketplace, new RegExp(`key:'${key}'|\\b${key}:\\[`), `category ${key}`);
  assert.match(screen, /const categoryDetails:Record<string,\[string,string\]\[\]\>/);
  assert.match(screen, /Object\.entries\(item\.details\|\|\{\}\)/);
  assert.match(screen, /DETAIL_LABELS\[key\]\|\|`Əlavə məlumat/);
  assert.match(screen, /service_provider:\['title','name','specialty','services','about','experience','working_hours','message_contact','price','address'\]/);
  assert.match(screen, /auto_dealer:\['dealer_name','contact_name','brands','vehicle_condition','working_hours','about','address','credit_available','leasing_available','barter_available','delivery_available'\]/);
  for (const [key, fields] of Object.entries({
    leasing: ['company_name','tax_id','legal_name','email','website','city','service_area','vehicle_categories','vehicle_condition','customer_types','minimum_down_payment','minimum_term','maximum_term','rate','interest_type','currency','minimum_financing','maximum_financing','guarantor_required','income_proof_required','required_documents','terms','license_reference','license_disclosure'],
    insurance: ['company_name','tax_id','email','website','city','service_area','insurance_types','coverage','franchise','contract_months','payment_methods','installments_available','online_application','claims_support','repair_network','exclusions','license_reference','license_disclosure'],
    sober_driver: ['company_name','tax_id','city','service_area','service_24_7','working_hours','minimum_order_price','rate_per_km','rate_per_hour','night_rate','city_service','intercity_service','advance_booking','urgent_service','driver_experience','payment_methods','waiting_fee','special_conditions'],
  })) {
    for (const field of fields) {
      assert.match(screen, new RegExp(`\\['${field}',`), `${key} form includes ${field}`);
      assert.match(payloadSource, new RegExp(`\\b${key}:\\[[^}]*'${field}'`, 's'), `${key} persists ${field}`);
    }
  }
});

test('owner deletion is confirmation-gated and scopes media/storage/parent operations to the authenticated owner', () => {
  assert.match(screen, /accessibilityLabel="Elanı sil"/);
  assert.match(screen, /Alert\.alert\('Elanı sil'/);
  assert.match(screen, /deleteOwnedListing\(sb,category,item\)/);
  assert.match(marketplace, /export async function deleteOwnedListing/);
  assert.match(marketplace, /listing\.owner_id\s*!==\s*ownerId/);
  assert.match(marketplace, /startsWith\(`\$\{ownerId\}\/\$\{listing\.id\}\/`\)/);
  assert.match(marketplace, /\.eq\('id',\s*listing\.id\)\.eq\('owner_id',\s*ownerId\)\.select\('id'\)/);
});

test('promotion intents use server-owned pricing, idempotency and pending-only client status', () => {
  assert.match(migration, /UNIQUE\(owner_id,request_id\)/);
  assert.match(migration, /austa_private\.v36_listing_exists\(p_source,p_listing_id,true\)/);
  assert.match(migration, /listing_owner IS DISTINCT FROM actor/);
  assert.match(migration, /WHEN 'premium_30d' THEN 2499/);
  assert.match(migration, /ON CONFLICT\(owner_id,request_id\) DO NOTHING/);
  assert.match(migration, /REVOKE ALL ON austa_private\.promotion_payment_intents FROM PUBLIC,anon,authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.austa_create_promotion_payment_intent\(text,uuid,text,uuid\) TO authenticated/);
  assert.match(migration, /Intent is always pending/);
  assert.doesNotMatch(migration, /UPDATE public\.(vehicle_listings|marketplace_listings|service_provider_listings|auto_dealer_listings)/);
  assert.match(marketplace, /export async function createPromotionPaymentIntent/);
  assert.match(marketplace, /row\.status !== 'pending'/);
  assert.match(screen, /Ödəniş provayderi qoşulmadığı üçün pul tutulmayıb/);
  assert.match(screen, /elan dəyişdirilmədi və paket aktiv edilmədi/);
  assert.match(screen, /intentRequestId\.current=intentRequestId\.current\|\|newUuid\(\)/);
});

test('video discovery pages beyond inactive recent uploads and returns freshly signed media URLs', () => {
  assert.match(marketplace, /for\(let page=0;page<16&&found\.size<perSourceTarget;page\+\+\)/);
  assert.match(marketplace, /\.range\(offset,offset\+79\)/);
  assert.match(marketplace, /createSignedUrl\(row\.storage_path,3600\)/);
  assert.match(marketplace, /eq\('status','active'\)/);
  assert.match(read('src/components/VideoFeedScreen.tsx'), /stopAfterFirstFrame\?\(\)=>player\.pause\(\)/);
  assert.match(read('src/components/VideoFeedScreen.tsx'), /active=\{viewerOpen&&index===selectedIndex\}/);
  assert.match(screen, /function VideoPoster\(\{url,style\}:\{url\?:string/);
  assert.match(marketplace, /createSignedUrl\((?:item|row)\.poster_path,3600\)/);
  assert.doesNotMatch(screen, /generateThumbnailsAsync\(\[0\.2\]/);
});

test('seller detail, seller question, video engagement and requested visual contracts stay present', () => {
  assert.match(screen, /austa_get_listing_seller_registered_at/);
  assert.match(screen, /Əlaqələndirici şəxs:/);
  assert.match(screen, /A-USTA-da qeydiyyat:/);
  assert.match(screen, /accessibilityLabel="Satıcıya mesaj yaz"/);
  assert.match(screen, /maxLength=\{4000\}/);
  assert.match(read('src/components/VideoFeedScreen.tsx'), /toggleVideoLike|onLike/);
  assert.match(read('src/components/VideoFeedScreen.tsx'), /Share\.share/);
  assert.match(screen, /grid:\{flexDirection:'row',flexWrap:'wrap'/);
  assert.match(screen, /media:\{aspectRatio:4\/3/);
  assert.match(screen, /heart:\{position:'absolute',right:7,top:7/);
  assert.match(screen, /mediaBottomBadges:\{position:'absolute',left:7,bottom:7/);
  assert.match(screen, /cardFoot:.*promotionIcons/);
  assert.match(read('src/components/VideoFeedScreen.tsx'), /cover:\{aspectRatio:9\/16/);
  assert.match(read('src/components/VideoFeedScreen.tsx'), /<Modal visible=\{viewerOpen\}/);
  assert.match(screen, /Zəng et/);
  assert.match(screen, /Mesaj yaz/);
});

test('service pickers no longer expose the English “Original” choice', () => {
  assert.match(read('src/lib/listing-form-options.ts'), /'Orijinal'/);
  assert.doesNotMatch(read('src/lib/listing-form-options.ts'), /'Original'/);
});
