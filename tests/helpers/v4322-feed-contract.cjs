const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const expectedV154BodySha256='94b58e1d36d08967f2f42e205686f13255af93a0bb2265ee14222f6420ca1937';

function assertCanonicalFeedIntegration(source=fs.readFileSync(path.join(root,'index.html'),'utf8')){
  const match=source.match(/<script id="austa-v154e-global-promotion-pagination">([\s\S]*?)<\/script>/);
  assert.ok(match,'V154-E marketplace script remains present');
  const body=match[1];
  assert.equal(crypto.createHash('sha256').update(body).digest('hex'),expectedV154BodySha256,'exact reviewed V4.3.22 server-feed implementation');
  assert.match(body,/window\.AUSTA_SUPABASE\.rpc\('austa_public_listing_page'/,'web categories use the canonical cursor feed RPC');
  assert.match(body,/sort_bucket[\s\S]*?sort_at[\s\S]*?source[\s\S]*?id/,'web cursor carries the deterministic composite feed key');
  assert.doesNotMatch(body,/\.from\(['"](?:vehicle_listings|marketplace_listings|service_provider_listings|auto_dealer_listings)['"]\)/,'web category pages do not bypass the shared public feed');
  return {body,script:match[0]};
}

function normalizeHistoricalV154(source,baselineRef='19c91a76502dad439811fa86d95af0fac922c88a'){
  const match=source.match(/<script id="austa-v154e-global-promotion-pagination">([\s\S]*?)<\/script>/);
  if(!match||!match[1].includes('austa_public_listing_page'))return source;
  assert.equal(crypto.createHash('sha256').update(match[1]).digest('hex'),expectedV154BodySha256,'exact reviewed V4.3.22 server-feed implementation');
  const baseline=cp.execFileSync('git',['show',baselineRef+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:10_000_000});
  const historical=baseline.match(/<script id="austa-v154e-global-promotion-pagination">[\s\S]*?<\/script>/);
  assert.ok(historical,'historical V154-E baseline remains available');
  source=source.replace(match[0],historical[0]);
  const deleteEvent=/^[ \t]*window\.dispatchEvent\(new CustomEvent\('austa:listings:changed',\{detail:\{id,source\}\}\)\);\r?\n/gm;
  const updateEvent=/^[ \t]*window\.dispatchEvent\(new CustomEvent\('austa:listings:changed',\{detail:\{id:listingId,category:type\}\}\)\);\r?\n/gm;
  const dealerEvent="window.dispatchEvent(new CustomEvent('austa:listings:changed',{detail:{id:item.id,category:type}}));";
  assert.equal((source.match(deleteEvent)||[]).length,1,'one V4.3.22 deletion invalidation event');
  assert.equal((source.match(updateEvent)||[]).length,2,'two V4.3.22 update invalidation events');
  assert.equal(source.split(dealerEvent).length-1,1,'one V4.3.22 dealer edit invalidation event');
  source=source.replace(deleteEvent,'').replace(updateEvent,'').replace(dealerEvent,'');
  const wrappedUpdates=[
    ["return mediaEdit(type,listingId,()=>originalUpdate(type,listingId,input,sellerIntent)).then(result=>{\n                return result;\n            });","return mediaEdit(type,listingId,()=>originalUpdate(type,listingId,input,sellerIntent));"],
    ["return originalUpdate(type,listingId,input,sellerIntent).then(result=>{\n            return result;\n        });","return originalUpdate(type,listingId,input,sellerIntent);"]
  ];
  for(const [current,historicalUpdate] of wrappedUpdates){
    assert.equal(source.split(current).length-1,1,'exact V4.3.22 cache-invalidating update wrapper');
    source=source.replace(current,historicalUpdate);
  }
  return source;
}

module.exports={assertCanonicalFeedIntegration,normalizeHistoricalV154};
