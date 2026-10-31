const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const rows=['draft','active','sold','rented','archived'].map(status=>({id:status,status,owner_id:'owner',listing_type:'sale',seller_profile_id:'seller',has_video:true,promotion_type:'premium',promotion_started_at:'2026-01-01',promotion_until:'2027-01-01'}));
function client(data,ops=[]){return {from(table){
 const q={filters:[],select(){return this},eq(k,v){this.filters.push([k,v]);return this},in(k,v){this.filters.push([k,v]);return this},ilike(k,v){this.filters.push([k,v]);return this},not(k,op,v){this.filters.push([k,{not:v}]);return this},lte(k,v){this.filters.push([k,{lte:v}]);return this},gt(k,v){this.filters.push([k,{gt:v}]);return this},order(){return this},range(){return this},maybeSingle(){this.one=true;return this},
 then(ok,bad){ops.push({table,filters:this.filters});const selected=data.filter(row=>this.filters.every(([k,v])=>Array.isArray(v)?v.includes(row[k]):v&&typeof v==='object'?('not' in v?row[k]!==v.not:'lte' in v?row[k]<=v.lte:row[k]>v.gt):row[k]===v));return Promise.resolve({data:this.one?selected[0]||null:selected,error:null}).then(ok,bad)}};return q;
}};}
// Execute the production query chains against mixed-status rows, not a copied predicate.
for(const [name,fn] of [['Home','fetchListings'],['legacy video feed','loadSupabaseV137Items'],['video feed','loadRealHomeVideos'],['Home sale cards','loadNextHomeBatch']]){
 test(`${name}: real Vehicle query excludes draft`,async()=>{
  let start=html.indexOf('function '+fn+'(');
  assert.ok(start>=0,'production function exists: '+fn);
  const rest=html.slice(start),match=rest.match(/(?:supabase|sb)\s*\.from\(['"]vehicle_listings['"]\)[\s\S]*?;/);
  assert.ok(match,'Vehicle query chain: '+fn);
  const ops=[],sb=client(rows,ops),c=vm.createContext({sb,supabase:sb,offset:0,PAGE_SIZE:20,requestTime:'2026-11-01',homeOffset:0,HOME_BATCH_SIZE:20});
  const result=await vm.runInContext('(async()=>await '+match[0].slice(0,-1)+')()',c);
  assert.deepEqual(result.data.map(row=>row.id),['active']);
  assert.ok(ops[0].filters.some(([k,v])=>k==='status'&&v==='active'));
 });
}
test('public seller actual query excludes draft and preserves explicit seller/sale scope',async()=>{
 const source=fs.readFileSync(path.join(root,'assets/marketplace/seller-page.js'),'utf8');
 const query=source.slice(source.indexOf('let query=sb.from'),source.indexOf('if(typeof query.abortSignal'));
 const sb=client(rows),c=vm.createContext({sb,fields:'*',state:{id:'seller',offset:0},BATCH_SIZE:40});
 const result=await vm.runInContext('(async()=>{'+query+'return (await query).data;})()',c);
 assert.deepEqual(result.map(row=>row.id),['active']);
});
for(const listing_type of ['sale','rent'])for(const mode of ['direct','cached']){
 test(`${listing_type} ${mode} public detail refuses draft before rendering/media`,async()=>{
  const start=html.indexOf('async function openFullListing('),end=html.indexOf('  /*\n   * Real Supabase elanıdırsa,',start);
  assert.ok(start>=0&&end>start);
  const prefix=html.slice(start,end),ops=[];
  const row={id:'draft',status:'draft',owner_id:'owner',listing_type};
  const c=vm.createContext({window:{AUSTA_SUPABASE:client([row],ops)},console,
   mapSupabaseListing:item=>item,findListing:()=>row,categoryOf:()=>listing_type==='rent'?'rent':'cars'});
  vm.runInContext(prefix+'return true;}',c);
  assert.equal(await c.openFullListing('draft',mode==='direct'?'vehicle_listings':undefined),false);
  row.status='active';assert.equal(await c.openFullListing('draft',mode==='direct'?'vehicle_listings':undefined),true);
 });
}
