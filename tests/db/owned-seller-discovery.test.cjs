const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.P12A_PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const reviewed=read('supabase/migrations/20261101010000_p12a1_owned_seller_discovery_rpc.sql');
const mutations={owner:"sp.owner_id = auth.uid()",status:"sp.status = 'active'",verification:"sp.verification_status = 'verified'"};
let migration=reviewed;
if(process.env.P12A1_MUTATION){const needle=mutations[process.env.P12A1_MUTATION];assert.ok(needle,'unknown mutation');assert.ok(migration.includes(needle));migration=migration.replace(needle,'true');}
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const fields=['id','business_type','display_name','status','verification_status','official_status','official_scope'];
let db,prior,installed;const eligible=[],ineligible=[];
async function snapshot(){return {
 functions:(await db.query("SELECT p.oid::text,p.proname,p.prosrc,p.proowner::text,p.prosecdef,p.proacl::text,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname<>'get_my_seller_profiles' ORDER BY p.oid")).rows,
 triggers:(await db.query('SELECT oid::text,tgname,tgfoid::text,pg_get_triggerdef(oid) AS definition,tgenabled FROM pg_trigger ORDER BY oid')).rows,
 policies:(await db.query('SELECT * FROM pg_policies ORDER BY schemaname,tablename,policyname')).rows,
 grants:(await db.query("SELECT * FROM information_schema.column_privileges WHERE table_schema='public' ORDER BY table_name,column_name,grantee,privilege_type")).rows,
 constraints:(await db.query("SELECT oid::text,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY oid")).rows
};}
async function asUser(uid,role,fn){await db.exec('SET ROLE '+role);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid||'']);try{return await fn();}finally{await db.exec('RESET ROLE');await db.exec("SELECT set_config('request.jwt.claim.sub','',false)");}}
const rpc=()=>db.query('SELECT * FROM public.get_my_seller_profiles()');
async function seed(owner,business,status='active',verification='verified',official='none'){
 const id=randomUUID();await db.query(`INSERT INTO public.seller_profiles(id,owner_id,business_type,display_name,status,verification_status,official_status,verified_by,official_reviewed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$2,$2)`,[id,owner,business,'Synthetic '+business,status,verification,official]);return id;
}
before(async()=>{
 db=new PGlite();await db.exec(read('tests/db/fixtures/pre-p12a-contract.sql'));
 await db.exec(read('supabase/migrations/20261101000000_p12a_seller_eligibility_guard.sql'));
 for(const business of ['dealer','store','service','usta'])for(const official of ['none','approved'])eligible.push(await seed(A,business,'active','verified',official));
 await seed(B,'dealer');
 for(const [status,verification] of [['pending','verified'],['active','unverified'],['active','pending'],['active','rejected'],['suspended','verified'],['suspended','revoked'],['active','revoked'],['revoked','verified'],['rejected','verified']])ineligible.push({status,verification,id:await seed(A,'dealer',status,verification)});
 prior=await snapshot();await db.exec(migration);installed=await snapshot();
});
after(async()=>{await db?.close();});

test('cross-user isolation: A receives exactly A eligible profiles, never public B',async()=>{
 const {rows}=await asUser(A,'authenticated',rpc);assert.deepEqual(rows.map(x=>x.id).sort(),[...eligible].sort());
});
test('cross-user isolation: B receives only B eligible profile',async()=>{
 const {rows}=await asUser(B,'authenticated',rpc);assert.equal(rows.length,1);assert.ok(!eligible.includes(rows[0].id));
});
test('authenticated owner without profiles receives empty set',async()=>{assert.deepEqual((await asUser(randomUUID(),'authenticated',rpc)).rows,[]);});
for(const business of ['dealer','store','service','usta'])for(const official of ['none','approved'])test(`${business}, official=${official} eligible included`,async()=>{
 const {rows}=await asUser(A,'authenticated',rpc);assert.equal(rows.filter(x=>x.business_type===business&&x.official_status===official).length,1);
});
for(const [status,verification] of [['pending','verified'],['active','unverified'],['active','pending'],['active','rejected'],['suspended','verified'],['suspended','revoked'],['active','revoked'],['revoked','verified'],['rejected','verified']])test(`ineligible ${status}/${verification} excluded`,async()=>{
 const bad=ineligible.find(x=>x.status===status&&x.verification===verification);assert.ok(!(await asUser(A,'authenticated',rpc)).rows.some(x=>x.id===bad.id));
});
test('anon EXECUTE denied even with spoofed nonempty UID',async()=>{await assert.rejects(asUser(A,'anon',rpc),{code:'42501'});});
test('authenticated missing UID fails closed',async()=>{await assert.rejects(asUser(null,'authenticated',rpc),{code:'28000'});});
test('privileged SQL missing UID also fails closed',async()=>{await assert.rejects(rpc(),{code:'28000'});});
test('only approved DTO fields returned, no owner/reviewer/private fields',async()=>{
 for(const row of (await asUser(A,'authenticated',rpc)).rows)assert.deepEqual(Object.keys(row),fields);
 const {rows}=await db.query("SELECT proargnames,proallargtypes::regtype[]::text AS types FROM pg_proc WHERE oid='public.get_my_seller_profiles()'::regprocedure");assert.deepEqual(rows[0].proargnames,fields);assert.equal(rows[0].types,'{uuid,text,text,text,text,text,text}');
});
test('zero input arguments, SECURITY DEFINER, STABLE, empty search_path, trusted owner',async()=>{
 const {rows}=await db.query("SELECT pronargs,prosecdef,provolatile,proconfig,pg_get_userbyid(proowner) AS owner FROM pg_proc WHERE oid='public.get_my_seller_profiles()'::regprocedure");assert.equal(rows[0].pronargs,0);assert.equal(rows[0].prosecdef,true);assert.equal(rows[0].provolatile,'s');assert.deepEqual(rows[0].proconfig,['search_path=""']);assert.equal(rows[0].owner,'postgres');
});
test('explicit EXECUTE authenticated only; no PUBLIC or anon permission',async()=>{
 const {rows}=await db.query("SELECT has_function_privilege('authenticated','public.get_my_seller_profiles()','EXECUTE') AS auth,has_function_privilege('anon','public.get_my_seller_profiles()','EXECUTE') AS anon,EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(p.proacl) a WHERE p.oid='public.get_my_seller_profiles()'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute");assert.deepEqual(rows[0],{auth:true,anon:false,public_execute:false});
});
test('direct authenticated owner_id SELECT remains denied',async()=>{await assert.rejects(asUser(A,'authenticated',()=>db.query('SELECT owner_id FROM public.seller_profiles')),{code:'42501'});});
test('public seller read still exposes public B without claiming ownership',async()=>{
 for(const role of ['anon','authenticated']){const {rows}=await asUser(A,role,()=>db.query('SELECT id,status,verification_status FROM public.seller_profiles'));assert.ok(rows.some(x=>!eligible.includes(x.id)&&!ineligible.some(y=>y.id===x.id)));if(role==='anon')assert.ok(rows.every(x=>x.status==='active'&&x.verification_status==='verified'));}
});
for(const key of ['functions','triggers','policies','grants','constraints'])test(`${key} unchanged including P1.2A and review/promotion guards`,()=>assert.deepEqual(installed[key],prior[key]));
test('migration reapplies idempotently without changing function OID/owner/ACL',async()=>{
 const sql="SELECT to_jsonb(p) AS catalog FROM pg_proc p WHERE oid='public.get_my_seller_profiles()'::regprocedure";const before=(await db.query(sql)).rows;await db.exec(reviewed);assert.deepEqual((await db.query(sql)).rows,before);
});
test('unexpected existing body causes preflight failure, no overwrite',async()=>{
 await db.exec('BEGIN');try{await db.exec("CREATE OR REPLACE FUNCTION public.get_my_seller_profiles() RETURNS TABLE(id uuid,business_type text,display_name text,status text,verification_status text,official_status text,official_scope text) LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$");await assert.rejects(db.exec(reviewed),/existing RPC contract\/body drift/);}finally{await db.exec('ROLLBACK');}
});
test('unexpected overload causes collision failure',async()=>{
 await db.exec('BEGIN');try{await db.exec('CREATE FUNCTION public.get_my_seller_profiles(uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT $1 $$');await assert.rejects(db.exec(reviewed),/RPC name collision/);}finally{await db.exec('ROLLBACK');}
});
test('RPC accepts no caller-supplied owner parameter',async()=>{
 await assert.rejects(asUser(A,'authenticated',()=>db.query('SELECT * FROM public.get_my_seller_profiles($1::uuid)',[B])),{code:'42883'});
});
test('UID switch on the same connection changes discovery owner without cached state',async()=>{
 const first=(await asUser(A,'authenticated',rpc)).rows;
 const second=(await asUser(B,'authenticated',rpc)).rows;
 assert.equal(first.length,eligible.length);assert.equal(second.length,1);assert.ok(!first.some(a=>a.id===second[0].id));
});
test('preflight rejects an unauthoritative function creator',async()=>{
 await db.exec('BEGIN');try{
  await db.exec('DROP FUNCTION public.get_my_seller_profiles(); GRANT CREATE ON SCHEMA public TO authenticated; SET ROLE authenticated');
  await assert.rejects(db.exec(reviewed),/RPC owner lacks authoritative seller read/);
 }finally{await db.exec('ROLLBACK; RESET ROLE');}
});

// Each drift is committed before migration BEGIN. After the expected failure,
// ROLLBACK must leave that exact incompatible state intact, not silently repair it.
const driftCases=[
 ['SECURITY INVOKER',"ALTER FUNCTION public.get_my_seller_profiles() SECURITY INVOKER"],
 ['VOLATILE',"ALTER FUNCTION public.get_my_seller_profiles() VOLATILE"],
 ['IMMUTABLE',"ALTER FUNCTION public.get_my_seller_profiles() IMMUTABLE"],
 ['missing search_path',"ALTER FUNCTION public.get_my_seller_profiles() RESET search_path"],
 ['search_path public',"ALTER FUNCTION public.get_my_seller_profiles() SET search_path TO public"],
 ['search_path pg_catalog',"ALTER FUNCTION public.get_my_seller_profiles() SET search_path TO pg_catalog"],
 ['search_path public,pg_catalog',"ALTER FUNCTION public.get_my_seller_profiles() SET search_path TO public,pg_catalog"],
 ['combined reviewed exploit',"ALTER FUNCTION public.get_my_seller_profiles() SECURITY INVOKER VOLATILE SET search_path TO public"],
 ['LEAKPROOF',"ALTER FUNCTION public.get_my_seller_profiles() LEAKPROOF"],
 ['STRICT',"ALTER FUNCTION public.get_my_seller_profiles() STRICT"],
 ['PARALLEL SAFE',"ALTER FUNCTION public.get_my_seller_profiles() PARALLEL SAFE"],
 ['extra function setting',"ALTER FUNCTION public.get_my_seller_profiles() SET row_security TO off"],
 ['wrong language',null],
 ['wrong return contract',"DROP FUNCTION public.get_my_seller_profiles(); CREATE FUNCTION public.get_my_seller_profiles() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$"],
 ['unexpected body',"CREATE OR REPLACE FUNCTION public.get_my_seller_profiles() RETURNS TABLE(id uuid,business_type text,display_name text,status text,verification_status text,official_status text,official_scope text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$ BEGIN RETURN; END; $$"],
 ['incompatible owner',"ALTER FUNCTION public.get_my_seller_profiles() OWNER TO authenticated"],
 ['wrong signature',"DROP FUNCTION public.get_my_seller_profiles(); CREATE FUNCTION public.get_my_seller_profiles(uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT $1 $$"]
];
for(const [label,sql] of driftCases)test(`metadata drift ${label}: rejected before replacement; incompatible catalog intact`,async()=>{
 const isolated=new PGlite();
 const capture=async()=> (await isolated.query("SELECT to_jsonb(p) AS catalog FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_my_seller_profiles' ORDER BY p.oid")).rows;
 try{
  await isolated.exec(read('tests/db/fixtures/pre-p12a-contract.sql'));
  await isolated.exec(reviewed);
  if(label==='wrong language'){
   // Preserve exact reviewed body and other metadata, so language is the only drift.
   const definition=(await isolated.query("SELECT pg_get_functiondef('public.get_my_seller_profiles()'::regprocedure) AS definition")).rows[0].definition;
   assert.match(definition,/LANGUAGE plpgsql/);
   await isolated.exec('SET check_function_bodies=false');
   await isolated.exec(definition.replace('LANGUAGE plpgsql','LANGUAGE sql'));
   await isolated.exec('RESET check_function_bodies');
  }else await isolated.exec(sql);
  const before=await capture();
  await assert.rejects(isolated.exec(reviewed),/P1\.2A\.1 preflight:/);
  await isolated.exec('ROLLBACK');
  assert.deepEqual(await capture(),before,'failed migration changed incompatible function');
 }finally{await isolated.close();}
});
