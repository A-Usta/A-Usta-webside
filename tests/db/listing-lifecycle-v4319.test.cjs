const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261128121026_v4319_listing_lifecycle.sql'), 'utf8');
const mobileMarketplace = fs.readFileSync(path.join(root, 'mobile/src/lib/marketplace.ts'), 'utf8');

test('V4.3.19 migration source remains the exact reviewed TEST-applied version', () => {
  assert.equal(crypto.createHash('sha256').update(migration).digest('hex'), '053e75324a07aa88a09992431dc9857723d2295f0ffc94e7f6279ebeaec7f1e9');
});

test('V4.3.19 adds server-owned publication and expiry dates to every listing source without resetting dates', () => {
  for (const table of ['vehicle_listings', 'marketplace_listings', 'service_provider_listings', 'auto_dealer_listings']) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ADD COLUMN IF NOT EXISTS first_published_at`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ADD COLUMN IF NOT EXISTS expires_at`));
    assert.match(migration, new RegExp(`UPDATE public\\.${table} SET first_published_at=coalesce\\(published_at,created_at\\),expires_at=coalesce\\(published_at,created_at\\)\\+interval '30 days' WHERE status='active' AND expires_at IS NULL`));
    assert.match(migration, new RegExp(`CREATE INDEX IF NOT EXISTS ${table.replace('_listings','_listing')}_expiry_idx`));
  }
  assert.match(migration, /NEW\.expires_at:=now_at\+interval '30 days'/);
  assert.match(migration, /NEW\.first_published_at:=CASE WHEN OLD\.first_published_at IS NOT NULL/);
});

test('expired rows are hidden by a restrictive RLS policy while owners retain access', () => {
  assert.match(migration, /AS RESTRICTIVE FOR SELECT TO anon,authenticated USING \(owner_id=\(SELECT auth\.uid\(\)\) OR \(status=''active'' AND expires_at>statement_timestamp\(\)\)\)/);
  assert.doesNotMatch(migration, /DROP POLICY (?!IF EXISTS v4319_public_expiry_guard)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.v355_provider_public_visible[\s\S]*?l\.expires_at>statement_timestamp\(\)/);
});

test('renewal is owner-scoped, transaction-authorized and idempotent; promotion expiry is not revived', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.austa_renew_listing/);
  assert.match(migration, /actor uuid:=auth\.uid\(\)/);
  assert.match(migration, /PRIMARY KEY\(owner_id,request_id\)/);
  assert.match(migration, /Idempotency key reused for another listing/);
  assert.match(migration, /Expired listing must be renewed through the owner renewal RPC/);
  assert.match(migration, /promotion_until>statement_timestamp\(\) THEN promotion_type ELSE ''standard''/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.austa_renew_listing\(text,uuid,uuid\) TO authenticated/);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.austa_renew_listing\(text,uuid,uuid\) TO anon/);
});

test('expiry worker is bounded, concurrency-safe, scheduled and exposes a unified feed contract', () => {
  assert.match(migration, /p_limit<1 OR p_limit>5000/);
  assert.match(migration, /FOR UPDATE SKIP LOCKED LIMIT \$1/);
  assert.match(migration, /cron\.schedule\('austa-listing-expiry','\*\/5 \* \* \* \*'/);
  assert.match(migration, /CREATE VIEW public\.austa_public_listing_feed/);
  for (const category of ['cars', 'rent', 'dealer', 'service', 'usta', 'parts', 'accessories', 'moto', 'special', 'bus', 'trailer', 'water', 'caravan', 'plate', 'insurance', 'sober_driver', 'leasing']) {
    assert.ok(mobileMarketplace.includes(`key:'${category}'`) || mobileMarketplace.includes(`'${category}'`), `missing category mapping ${category}`);
  }
  assert.match(migration, /SELECT 'marketplace',l\.category/);
  assert.match(migration, /CASE WHEN p\.provider_type='usta' THEN 'usta' ELSE coalesce\(p\.details->>'service_category','service'\) END/);
  assert.match(migration, /ORDER BY expires_at,id FOR UPDATE SKIP LOCKED/);
  assert.match(migration, /GRANT SELECT ON public\.austa_public_listing_feed TO anon,authenticated/);
});
