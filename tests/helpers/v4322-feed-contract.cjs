const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');

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

module.exports={assertCanonicalFeedIntegration};
