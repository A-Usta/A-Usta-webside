const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const sql=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261128140000_v4322_public_feed_cursor.sql'),'utf8');
const mobile=fs.readFileSync(path.resolve(__dirname,'../../mobile/src/lib/marketplace.ts'),'utf8');
const web=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');

test('shared public listing page is invoker-secure and reads the canonical RLS view',()=>{
  assert.match(sql,/SECURITY INVOKER SET search_path=''/);
  assert.match(sql,/FROM public\.austa_public_listing_feed f/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.austa_public_listing_page[\s\S]*?GRANT EXECUTE ON FUNCTION public\.austa_public_listing_page[\s\S]*?TO anon,authenticated/);
  assert.doesNotMatch(sql,/SECURITY DEFINER/i);
});

test('all 17 category filter maps are allowlisted and invalid filters fail closed',()=>{
  const categories=['cars','dealer','service','rent','parts','accessories','moto','special','bus','trailer','water','caravan','plate','usta','insurance','sober_driver','leasing'];
  for(const category of categories)assert.match(sql,new RegExp(`WHEN '${category}' THEN CASE p_key`),category);
  assert.match(sql,/IF public\.austa_feed_filter_path\(p_category,filter_key\) IS NULL THEN RAISE EXCEPTION/);
  assert.match(sql,/p_category NOT IN \('cars','dealer','service','rent','parts','accessories','moto','special','bus','trailer','water','caravan','plate','usta','insurance','sober_driver','leasing'\)/);
});

test('feed page uses seek pagination, a total order, bounded page sizes and search/filter predicates',()=>{
  assert.match(sql,/p_after_bucket IS NULL OR f\.sort_bucket>p_after_bucket/);
  assert.match(sql,/f\.sort_bucket ASC,f\.sort_at DESC,f\.source ASC,f\.id DESC/);
  assert.match(sql,/LIMIT greatest\(1,least\(coalesce\(p_page_size,40\),100\)\)\+1/);
  assert.match(sql,/p_search/);
  assert.match(sql,/jsonb_each_text\(coalesce\(p_filters/);
  assert.match(sql,/jsonb_each\(coalesce\(p_price_bounds/);
  assert.doesNotMatch(sql,/OFFSET\s/i);
});

test('web and mobile category readers call the same cursor RPC',()=>{
  assert.match(mobile,/rpc\('austa_public_listing_page'/);
  assert.match(mobile,/p_after_bucket:cursor\?\.sort_bucket/);
  assert.match(web,/rpc\('austa_public_listing_page'/);
  assert.match(web,/p_after_bucket:cursor\?\.sort_bucket/);
  assert.match(web,/austa:listings:changed/);
});
