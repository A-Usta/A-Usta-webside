const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261128160000_v43271_public_listing_dto.sql'),'utf8');
const expiryOrder=fs.readFileSync(path.join(root,'supabase/migrations/20261128170000_v43271_expired_promotion_order.sql'),'utf8');
const sql=migration.replace(/--.*$/gm,'');
const mobile=fs.readFileSync(path.join(root,'mobile/src/lib/marketplace.ts'),'utf8');
const mobileDetail=fs.readFileSync(path.join(root,'mobile/src/components/MarketplaceScreens.tsx'),'utf8');
const webDetail=fs.readFileSync(path.join(root,'assets/marketplace/listing-detail.js'),'utf8');
const categories=['cars','rent','dealer','service','usta','parts','accessories','moto','special','bus','trailer','water','caravan','plate','insurance','sober_driver','leasing'];

test('public feed serializes only explicit DTO fields and allowlisted detail keys',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.austa_public_listing_details\(p_details jsonb\)/);
  assert.match(sql,/d\.key=ANY\(ARRAY\[[\s\S]*?\]::text\[\]\)/);
  assert.equal((sql.match(/jsonb_build_object\(/g)||[]).length,4);
  assert.match(sql,/public\.austa_public_listing_details\(l\.details\)/);
  assert.match(sql,/public\.austa_public_listing_details\(p\.details\)/);
  assert.doesNotMatch(sql,/to_jsonb\s*\(/i);
  for(const key of ['tax_id','legal_name','email','license_reference','address','latitude','longitude','vin'])
    assert.doesNotMatch(sql,new RegExp("'"+key+"'\\s*,\\s*[a-z]\\.", 'i'),`private source field ${key} must not enter the public DTO`);
});

test('only expiry column is newly granted; coordinates remain private and source RLS is unchanged',()=>{
  assert.equal((migration.match(/GRANT SELECT \(expires_at\) ON public\./g)||[]).length,3);
  assert.equal((migration.match(/REVOKE SELECT \(address, latitude, longitude\) ON public\./g)||[]).length,4);
  assert.match(migration,/WITH \(security_barrier=true, security_invoker=true\)/);
  assert.match(migration,/REVOKE ALL ON public\.austa_public_listing_feed FROM PUBLIC/);
  assert.match(migration,/GRANT SELECT ON public\.austa_public_listing_feed TO anon,authenticated/);
  assert.doesNotMatch(migration,/GRANT SELECT ON public\.(vehicle_listings|marketplace_listings|auto_dealer_listings|service_provider_listings)\s+TO\s+(anon|authenticated)/i);
  assert.doesNotMatch(migration,/ALTER TABLE public\.(vehicle_listings|marketplace_listings|auto_dealer_listings|service_provider_listings) DISABLE ROW LEVEL SECURITY/i);
});

test('public web and mobile detail, seller, favorite and video reads use the canonical feed',()=>{
  assert.match(webDetail,/from\('austa_public_listing_feed'\)\.select\('\*'\)\.eq\('source',c\.source\)/);
  assert.match(mobile,/async function readPublicListing[\s\S]*?from\('austa_public_listing_feed'\)/);
  assert.match(mobile,/from\('austa_public_listing_feed'\)\.select\('\*'\)\.eq\('category',category\.key\)/);
  assert.match(mobileDetail,/from\('austa_public_listing_feed'\)\.select\('\*'\)\.eq\('source',category\.source\)/);
  assert.doesNotMatch(mobile,/from\(category\.table\)\.select\('\*'\)/);
  assert.doesNotMatch(mobile,/from\(source\.table\)\.select\('\*'\)/);
});

test('all 17 categories and non-destructive TEST scope remain explicit',()=>{
  for(const category of categories)assert.ok(mobile.includes(`key:'${category}'`)||mobile.includes(`'${category}'`),category);
  assert.match(migration,/BEGIN;[\s\S]*COMMIT;/);
  assert.doesNotMatch(migration,/\b(DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i);
});

test('expired promotions return to publication-time ordering on all feed sources',()=>{
  assert.match(expiryOrder,/CREATE OR REPLACE FUNCTION public\.austa_listing_effective_sort_at/);
  assert.match(expiryOrder,/WHEN p_type IN \('premium','vip','top','standard'\)[\s\S]*?p_started_at<=statement_timestamp\(\) AND p_until>statement_timestamp\(\)[\s\S]*?THEN coalesce\(p_boosted_at,p_started_at,published_at,created_at\)[\s\S]*?ELSE coalesce\(published_at,created_at\)/);
  assert.equal((expiryOrder.match(/public\.austa_listing_effective_sort_at\([lp]\./g)||[]).length,4,'all four source branches use the helper');
  assert.match(expiryOrder,/REVOKE ALL ON FUNCTION public\.austa_listing_effective_sort_at[\s\S]*?GRANT EXECUTE ON FUNCTION public\.austa_listing_effective_sort_at[\s\S]*?TO anon,authenticated/);
});
