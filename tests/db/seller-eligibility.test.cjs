const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.P12A_PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'../..');
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/pre-p12a-contract.sql'),'utf8');
const migrationPath=path.join(root,'supabase/migrations/20261101000000_p12a_seller_eligibility_guard.sql');
const reviewedMigration=fs.readFileSync(migrationPath,'utf8');
let migration=reviewedMigration;
if(process.env.P12A_MUTATION==='status')migration=migration.replaceAll("      AND sp.status = 'active'\n",'');
else if(process.env.P12A_MUTATION==='verification')migration=migration.replaceAll("\n      AND sp.verification_status = 'verified'",'');
else if(process.env.P12A_MUTATION)throw Error('Unknown mutation');
const owner='11111111-1111-4111-8111-111111111111',foreign='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333';
const groups=[
 {label:'Vehicle Cars',table:'vehicle_listings',business:'dealer',listing:'sale'},
 {label:'Vehicle Rent',table:'vehicle_listings',business:'dealer',listing:'rent'},
 {label:'Marketplace',table:'marketplace_listings',business:'store'},
 {label:'Service',table:'service_provider_listings',business:'service',provider:'service'},
 {label:'Usta',table:'service_provider_listings',business:'usta',provider:'usta'},
 {label:'Auto Dealer',table:'auto_dealer_listings',business:'dealer'}
];
const guarded=['austa_validate_auto_dealer_seller_profile','austa_validate_marketplace_seller_profile','austa_validate_service_seller_profile','austa_validate_vehicle_seller_profile'];
let db,beforeCatalog,afterCatalog,baselinePermission,legacy;
async function catalog(connection=db){
 return {functions:(await connection.query("SELECT p.oid::text,p.proname,p.prosrc,p.prosecdef,p.proowner::text,p.proacl::text,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname")).rows,
 triggers:(await connection.query("SELECT oid::text,tgname,tgfoid::text,pg_get_triggerdef(oid,true) AS definition,tgenabled FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname")).rows,
 constraints:(await connection.query("SELECT conname,convalidated,pg_get_constraintdef(oid,true) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname")).rows,
 policies:(await connection.query('SELECT * FROM pg_policies ORDER BY tablename,policyname')).rows,
 grants:(await connection.query("SELECT * FROM information_schema.column_privileges WHERE table_schema='public' ORDER BY table_name,column_name,grantee,privilege_type")).rows};
}
async function seller(group,status='active',verification='verified',sellerOwner=owner,business=group.business){
 const id=randomUUID();await db.query('INSERT INTO public.seller_profiles(id,owner_id,business_type,status,verification_status,display_name,country_code) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,sellerOwner,business,status,verification,'Synthetic business','AZ']);return id;
}
async function insert(group,sellerId,sellerOwner=owner,extra={}){
 const row={id:randomUUID(),owner_id:sellerOwner,seller_profile_id:sellerId,status:group.table==='vehicle_listings'?'draft':'inactive',...(group.provider?{provider_type:group.provider}:{}),...(group.listing?{listing_type:group.listing}:{}),...extra};
 const keys=Object.keys(row);return (await db.query(`INSERT INTO public.${group.table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,keys.map(k=>row[k]))).rows[0];
}
async function user(id=owner,role='authenticated'){await db.exec('SET ROLE '+role);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function reset(){await db.exec('RESET ROLE');await db.exec("SELECT set_config('request.jwt.claim.sub','',false)");}
async function rejected(operation,code){
 await db.exec('SAVEPOINT rejected_operation');let caught;
 try{await operation();}catch(error){caught=error;}
 await db.exec('ROLLBACK TO SAVEPOINT rejected_operation; RELEASE SAVEPOINT rejected_operation');
 assert.ok(caught,'operation unexpectedly accepted');if(code)assert.equal(caught.code,code);return caught;
}
async function scenario(operation){await db.exec('BEGIN');try{await operation();}finally{await db.exec('ROLLBACK');await reset();}}
before(async()=>{
 db=new PGlite();await db.exec(fixture);
 // The supplied invoker guard cannot read the deliberately restricted owner column.
 await db.exec('BEGIN');const id=await seller(groups[0]);await user();
 try{await insert(groups[0],id);}catch(e){baselinePermission=e.code;}
 await db.exec('ROLLBACK');await reset();
 // Seed pre-existing ineligible associations using the original supplied guards.
 legacy=[];for(const group of groups){const id=await seller(group,'pending','unverified');const row=await insert(group,id);legacy.push({group,seller:id,id:row.id});}
 beforeCatalog=await catalog();await db.exec(migration);afterCatalog=await catalog();
});
after(async()=>{await db?.close();});

test('documented invoker/private-column dependency reproduced before migration',()=>assert.equal(baselinePermission,'42501'));
for(const group of groups){
 test(`${group.label}: eligible owned correct type active+verified (Official none) accepted`,()=>scenario(async()=>{
  const id=await seller(group);await user();const row=await insert(group,id);assert.equal(row.seller_profile_id,id);assert.equal(row.status,group.table==='vehicle_listings'?'draft':'inactive');
 }));
 test(`${group.label}: NULL seller association accepted`,()=>scenario(async()=>{await user();const row=await insert(group,null);assert.equal(row.seller_profile_id,null);}));
 test(`${group.label}: foreign seller owner rejected`,()=>scenario(async()=>{const id=await seller(group,'active','verified',foreign);await user();await rejected(()=>insert(group,id),'P0001');}));
 test(`${group.label}: fabricated owner cannot make definer read a foreign seller`,()=>scenario(async()=>{
  const id=await seller(group,'active','verified',foreign);await user();const e=await rejected(()=>insert(group,id,foreign),'P0001');assert.match(e.message,/məxsus deyil/);
 }));
 test(`${group.label}: nonexistent UUID rejected`,()=>scenario(async()=>{await user();await rejected(()=>insert(group,randomUUID()),'P0001');}));
 for(const business of ['dealer','store','service','usta'].filter(x=>x!==group.business))test(`${group.label}: incompatible ${business} rejected`,()=>scenario(async()=>{
  const id=await seller(group,'active','verified',owner,business);await user();await rejected(()=>insert(group,id),'P0001');
 }));
 for(const [status,verification] of [['pending','verified'],['pending','unverified'],['active','unverified'],['active','pending'],['active','rejected'],['active','revoked'],['suspended','verified'],['suspended','revoked'],['pending','pending']]){
  for(const operation of ['INSERT','UPDATE'])test(`${group.label}: ineligible ${status}/${verification} ${operation} rejected`,()=>scenario(async()=>{
   const id=await seller(group,status,verification);let row;
   if(operation==='UPDATE'){await user();row=await insert(group,null);}else await user();
   await rejected(()=>operation==='INSERT'?insert(group,id):db.query(`UPDATE public.${group.table} SET seller_profile_id=$1 WHERE id=$2`,[id,row.id]),'P0001');
   const count=(await db.query(`SELECT count(*)::int AS n FROM public.${group.table} WHERE seller_profile_id=$1`,[id])).rows[0].n;assert.equal(count,0);
  }));
 }
 test(`${group.label}: losing eligibility retains association; explicit revalidation rejects`,()=>scenario(async()=>{
  const id=await seller(group);await user();const row=await insert(group,id);await reset();await db.query("UPDATE public.seller_profiles SET status='suspended',verification_status='revoked' WHERE id=$1",[id]);
  assert.equal((await db.query(`SELECT seller_profile_id FROM public.${group.table} WHERE id=$1`,[row.id])).rows[0].seller_profile_id,id);
  await user();await rejected(()=>db.query(`UPDATE public.${group.table} SET seller_profile_id=seller_profile_id WHERE id=$1`,[row.id]),'P0001');
  await rejected(()=>db.query(`UPDATE public.${group.table} SET owner_id=owner_id WHERE id=$1`,[row.id]),'P0001');
  await db.query(`UPDATE public.${group.table} SET note='unrelated edit' WHERE id=$1`,[row.id]);
  await db.query(`UPDATE public.${group.table} SET status='active' WHERE id=$1`,[row.id]);
  assert.equal((await db.query(`SELECT seller_profile_id FROM public.${group.table} WHERE id=$1`,[row.id])).rows[0].seller_profile_id,id);
  await db.query(`UPDATE public.${group.table} SET seller_profile_id=NULL WHERE id=$1`,[row.id]);
  assert.equal((await db.query(`SELECT seller_profile_id FROM public.${group.table} WHERE id=$1`,[row.id])).rows[0].seller_profile_id,null);
 }));
 test(`${group.label}: eligible association can switch to a different eligible owned profile`,()=>scenario(async()=>{
  const a=await seller(group),b=await seller(group);await user();const row=await insert(group,a);await db.query(`UPDATE public.${group.table} SET seller_profile_id=$1 WHERE id=$2`,[b,row.id]);
  assert.equal((await db.query(`SELECT seller_profile_id FROM public.${group.table} WHERE id=$1`,[row.id])).rows[0].seller_profile_id,b);
 }));
 test(`${group.label}: existing promotion INSERT and UPDATE guards still enforce standard`,()=>scenario(async()=>{
  const id=await seller(group);await user();const row=await insert(group,id,owner,{promotion_type:'premium',promotion_started_at:'2026-01-01',promotion_until:'2027-01-01',last_boosted_at:'2026-01-01'});
  assert.equal(row.promotion_type,'standard');for(const key of ['promotion_started_at','promotion_until','last_boosted_at'])assert.equal(row[key],null);
  for(const [key,value] of [['promotion_type','premium'],['promotion_started_at','2026-01-01'],['promotion_until','2027-01-01'],['last_boosted_at','2026-01-01']])await rejected(()=>db.query(`UPDATE public.${group.table} SET ${key}=$1 WHERE id=$2`,[value,row.id]),'P0001');
 }));
}
test('Service provider_type change rechecks existing business compatibility',()=>scenario(async()=>{
 const service=groups.find(g=>g.label==='Service'),id=await seller(service);await user();const row=await insert(service,id);
 await rejected(()=>db.query("UPDATE public.service_provider_listings SET provider_type='usta' WHERE id=$1",[row.id]),'P0001');
 await reset();const usta=await seller(groups.find(g=>g.label==='Usta'));await user();await db.query("UPDATE public.service_provider_listings SET provider_type='usta',seller_profile_id=$1 WHERE id=$2",[usta,row.id]);
}));
test('existing ineligible rows remain unchanged after migration, no backfill/detachment',async()=>{
 for(const row of legacy)assert.equal((await db.query(`SELECT seller_profile_id FROM public.${row.group.table} WHERE id=$1`,[row.id])).rows[0].seller_profile_id,row.seller);
});
test('function OIDs/owners/ACLs preserved; only four audited functions changed',()=>{
 assert.equal(afterCatalog.functions.length,beforeCatalog.functions.length);
 for(const old of beforeCatalog.functions){const current=afterCatalog.functions.find(x=>x.proname===old.proname);assert.equal(current.oid,old.oid);assert.equal(current.proowner,old.proowner);assert.equal(current.proacl,old.proacl);
  if(guarded.includes(old.proname)){assert.equal(current.prosecdef,true);assert.deepEqual(current.proconfig,['search_path=""']);}else assert.deepEqual(current,old);
 }
});
test('all trigger names/bindings/event columns, FK RESTRICT rules, RLS and grants preserved',()=>{
 for(const key of ['triggers','constraints','policies','grants'])assert.deepEqual(afterCatalog[key],beforeCatalog[key]);
 const fks=afterCatalog.constraints.filter(c=>c.conname.endsWith('_seller_owner_fkey'));assert.equal(fks.length,4);for(const c of fks){assert.ok(c.convalidated);assert.match(c.definition,/FOREIGN KEY \(seller_profile_id, owner_id\).*REFERENCES seller_profiles\(id, owner_id\) ON DELETE RESTRICT/);}
});
for(const role of ['authenticated','anon'])test(`${role}: private seller columns and select(*) remain unavailable`,()=>scenario(async()=>{
 const id=await seller(groups[0]);await user(owner,role);
 for(const column of ['owner_id','verified_by','official_reviewed_by','*'])await rejected(()=>db.query(`SELECT ${column} FROM public.seller_profiles WHERE id=$1`,[id]),'42501');
 const row=(await db.query('SELECT id,business_type,status,verification_status,official_status FROM public.seller_profiles WHERE id=$1',[id])).rows[0];assert.equal(row.id,id);assert.ok(!Object.hasOwn(row,'owner_id'));
}));
test('trigger function cannot be invoked as a normal public data-returning RPC',()=>scenario(async()=>{await user();await rejected(()=>db.query('SELECT public.austa_validate_vehicle_seller_profile()'));}));
test('untrusted search_path/temp names cannot replace the authoritative seller lookup',()=>scenario(async()=>{
 const id=await seller(groups[0],'active','unverified');await user();await db.exec('CREATE TEMP TABLE seller_profiles(id uuid,owner_id uuid,business_type text,status text,verification_status text)');
 await db.query("INSERT INTO pg_temp.seller_profiles VALUES($1,$2,'dealer','active','verified')",[id,owner]);await db.exec('SET search_path=pg_temp,public');await rejected(()=>insert(groups[0],id),'P0001');
}));
test('unchanged admin approve/revoke lifecycle works with the eligibility guard',()=>scenario(async()=>{
 await db.query("INSERT INTO public.profiles VALUES($1,'admin',true)",[admin]);const id=await seller(groups[0],'pending','pending');
 await db.query("INSERT INTO public.seller_verification_applications(id,seller_profile_id,owner_id,status,submitted_at)VALUES($1,$2,$3,'submitted',now())",[randomUUID(),id,owner]);
 await user(admin);await db.query("SELECT public.admin_review_seller_profile($1,'approve')",[id]);await user(owner);const listing=await insert(groups[0],id);
 await user(admin);await db.query("SELECT public.admin_review_seller_profile($1,'revoke')",[id]);await reset();
 const state=(await db.query('SELECT status,verification_status FROM public.seller_profiles WHERE id=$1',[id])).rows[0];assert.deepEqual(state,{status:'suspended',verification_status:'revoked'});
 assert.equal((await db.query('SELECT seller_profile_id FROM public.vehicle_listings WHERE id=$1',[listing.id])).rows[0].seller_profile_id,id);
 await user(owner);await rejected(()=>db.query('UPDATE public.vehicle_listings SET seller_profile_id=seller_profile_id WHERE id=$1',[listing.id]),'P0001');
}));
test('migration reapplies idempotently without changing catalog/rows',async()=>{
 const before=await catalog();await db.exec(migration);assert.deepEqual(await catalog(),before);
});
for(const drift of ['missing-trigger','wrong-update-columns','unprivileged-function-owner','function-body-drift'])test(`migration preflight fails atomically on ${drift}`,async()=>{
 const isolated=new PGlite();try{
  await isolated.exec(fixture);
  if(drift==='missing-trigger')await isolated.exec('DROP TRIGGER austa_vehicle_seller_profile_guard ON public.vehicle_listings');
  if(drift==='wrong-update-columns')await isolated.exec('DROP TRIGGER austa_service_seller_profile_guard ON public.service_provider_listings; CREATE TRIGGER austa_service_seller_profile_guard BEFORE INSERT OR UPDATE OF seller_profile_id,owner_id ON public.service_provider_listings FOR EACH ROW EXECUTE FUNCTION public.austa_validate_service_seller_profile()');
  if(drift==='unprivileged-function-owner')await isolated.exec('CREATE ROLE unsuitable_owner; ALTER FUNCTION public.austa_validate_vehicle_seller_profile() OWNER TO unsuitable_owner');
  if(drift==='function-body-drift'){const original=fixture.match(/CREATE OR REPLACE FUNCTION public\.austa_validate_vehicle_seller_profile\(\)[\s\S]*?\$function\$;/)[0];await isolated.exec(original.replace('    SELECT sp.business_type','    PERFORM 1;\n    SELECT sp.business_type'));}
  const before=await catalog(isolated);await assert.rejects(isolated.exec(migration),/P1.2A preflight/);await isolated.exec('ROLLBACK');assert.deepEqual(await catalog(isolated),before);
 }finally{await isolated.close();}
});
test('migration is functions-only; reviewed SQL, managed fields and protected runtime remain intact',()=>{
 const definitions=[...reviewedMigration.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map(m=>m[1]).sort();assert.deepEqual(definitions,[...guarded].sort());
 assert.ok(!/\b(?:DROP\s+(?:TRIGGER|FUNCTION|TABLE)|ALTER\s+(?:TABLE|POLICY)|GRANT\b|REVOKE\b|CREATE\s+TRIGGER)/i.test(reviewedMigration.replace(/--[^\n]*/g,'')));
 const base='3a4d0f0138ff8b6d30341dfa0ab3dd007a349a9c';
 assert.equal(reviewedMigration,cp.execFileSync('git',['show',base+':supabase/migrations/20261101000000_p12a_seller_eligibility_guard.sql'],{cwd:root,encoding:'utf8'}));
 const protectedPaths=['backend','assets/marketplace/listing-publish.js','assets/marketplace/seller-verification.js','assets/marketplace/seller-identity.js','assets/marketplace/seller-page.js','assets/marketplace/listing-cards.js','assets/marketplace/category-filters.js'];
 assert.equal(cp.execFileSync('git',['diff',base,'--',...protectedPaths],{cwd:root,encoding:'utf8'}),'');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/MANAGED_LISTING_FIELDS = Object\.freeze\(\[[\s\S]*?'seller_profile_id'/);
});
test('missing JWT on authenticated role fails before privileged seller lookup',()=>scenario(async()=>{
 const id=await seller(groups[0]);await user('');const e=await rejected(()=>insert(groups[0],id),'P0001');assert.match(e.message,/Giriş tələb olunur/);
}));
test('custom untrusted no-JWT role cannot use a temporary trigger as a private owner oracle',()=>scenario(async()=>{
 const id=await seller(groups[0],'active','verified',foreign);
 await db.exec('CREATE ROLE guard_probe_role; SET ROLE guard_probe_role; CREATE TEMP TABLE guard_probe(owner_id uuid,seller_profile_id uuid); CREATE TRIGGER probe BEFORE INSERT ON guard_probe FOR EACH ROW EXECUTE FUNCTION public.austa_validate_vehicle_seller_profile()');
 const e=await rejected(()=>db.query('INSERT INTO guard_probe VALUES($1,$2)',[foreign,id]),'P0001');assert.match(e.message,/Giriş tələb olunur/);
}));
test('trusted SQL with no JWT retains eligible attachment without broadening public grants',()=>scenario(async()=>{
 const id=await seller(groups[0]);const row=await insert(groups[0],id);assert.equal(row.seller_profile_id,id);
}));
