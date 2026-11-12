const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {randomUUID,createHash}=require('node:crypto');
const {PGlite}=require(process.env.P12A_PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'../..');
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/pre-p2c-contract.sql'),'utf8');
const reviewed=fs.readFileSync(path.join(root,'supabase/migrations/20261102000000_p2c_service_order_integrity.sql'),'utf8');
const customer=randomUUID(),provider=randomUUID(),foreign=randomUUID();
const mutations={
 cas:["IF jsonb_typeof(p_expected) IS DISTINCT FROM 'object'", "IF false AND (jsonb_typeof(p_expected) IS DISTINCT FROM 'object'", "IS DISTINCT FROM o.price_responded_at THEN", "IS DISTINCT FROM o.price_responded_at) THEN",'F03 stale snapshot'],
 actor:['a.provider_id<>p_actor_id','false','F03 wrong provider'],
 append:["evidence_files=o.evidence_files||jsonb_build_array(p_record)","evidence_files=jsonb_build_array(p_record)",'F04 appends preserve'],
 cancel:["status IN ('offered','accepted','in_progress')","status IN ('offered','accepted')",'F05 cancellation includes'],
 insert:["IF NOT FOUND OR parent_status<>'pending' THEN","IF false THEN",'F05 late assignment'],
};
function mutationSQL(name){const m=mutations[name];assert.ok(m);let s=reviewed;if(name==='cas'){assert.ok(s.includes(m[0])&&s.includes(m[2]));return s.replace(m[0],m[1]).replace(m[2],m[3]);}assert.ok(s.includes(m[0]));return s.replaceAll(m[0],m[1]);}
const acceptanceDefinition=reviewed.match(/CREATE OR REPLACE FUNCTION public\.accept_service_order_assignment_atomic[\s\S]*?\$acceptance\$[\s\S]*?\$acceptance\$;/)[0];
const originalAcceptance=fixture.match(/CREATE OR REPLACE FUNCTION public\.accept_service_order_assignment_atomic[\s\S]*?\$function\$[\s\S]*?\$function\$/)[0];
const acceptanceBody=acceptanceDefinition.split('$acceptance$')[1];
const reviewedAcceptanceMD5='0b2d208972a5749b1698bfbaabb23c3f';
let db,acceptanceBefore;
async function catalog(c=db){return (await c.query("SELECT p.oid::text AS oid,pg_get_functiondef(p.oid) AS def,p.prosrc,p.proacl::text AS acl,p.proowner::text AS owner,p.prosecdef,p.proconfig,p.provolatile,p.prokind,p.proretset,p.pronargs,p.proargtypes::text,p.proargnames,pg_get_function_result(p.oid) result,l.lanname FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid='public.accept_service_order_assignment_atomic(uuid,uuid)'::regprocedure")).rows[0];}
before(async()=>{db=new PGlite();await db.exec(fixture);await db.query('INSERT INTO public.profiles(id) VALUES($1),($2),($3)',[customer,provider,foreign]);acceptanceBefore=await catalog();await db.exec(process.env.P2C_MUTATION?mutationSQL(process.env.P2C_MUTATION):reviewed);if(process.env.P2C_ACCEPT_LOCK_MUTATION)await db.exec(originalAcceptance);});
after(async()=>db?.close());
async function seed(status='accepted',price='offered'){
 const id=randomUUID(),aid=randomUUID();
 await db.query('INSERT INTO public.service_orders(id,customer_id,status,price_status,proposed_price,final_price,service_category) VALUES($1,$2,$3,$4,25,$5,\'mechanic_service\')',[id,customer,'pending',price,price==='confirmed'?25:null]);
 await db.query('INSERT INTO public.service_order_assignments(id,order_id,provider_id,status,provider_type) VALUES($1,$2,$3,$4,\'mechanic\')',[aid,id,provider,'offered']);
 await db.query('UPDATE public.service_orders SET status=$2 WHERE id=$1',[id,status]);await db.query('UPDATE public.service_order_assignments SET status=$2 WHERE id=$1',[aid,status==='pending'?'offered':status]);
 return {id,aid};
}
async function order(id){return (await db.query('SELECT to_jsonb(s) AS value FROM public.service_orders s WHERE id=$1',[id])).rows[0].value;}
async function assignment(id){return (await db.query('SELECT * FROM public.service_order_assignments WHERE id=$1',[id])).rows[0];}
function snapshot(o){return Object.fromEntries(['price_status','proposed_price','final_price','price_offered_at','price_responded_at'].map(k=>[k,o[k]]));}
async function price(s,action,actor=action==='offer'?provider:customer,expected,amount=30){return (await db.query('SELECT public.austa_p2c_price_transition($1,$2,$3,$4,$5,$6::jsonb) AS value',[s.id,s.aid,actor,action,amount,JSON.stringify(expected??snapshot(await order(s.id)))])).rows[0].value;}
function record(s,stage='before'){return {bucket:'service-evidence',path:`${customer}/${s.id}/${stage}/1793612340000-${randomUUID()}.jpg`,category:stage,content_type:'image/jpeg',uploaded_at:'2026-11-02T13:00:00Z',assignment_id:s.aid};}
async function append(s,r,actor=provider){return (await db.query('SELECT public.austa_p2c_append_evidence($1,$2,$3,$4::jsonb) AS value',[s.id,s.aid,actor,JSON.stringify(r)])).rows[0].value;}
async function transition(s,action,actor=action==='cancel'?customer:provider,final=null,status=null){return (await db.query('SELECT public.austa_p2c_order_transition($1,$2,$3,$4,$5,$6) AS value',[s.id,s.aid,actor,action,final,status])).rows[0].value;}
async function rejects(fn,code){await assert.rejects(fn,e=>{assert.equal(e.code,code);return true;});}

test('acceptance exact reviewed new body; OID, signature, owner, ACL and security unchanged',async()=>{
 const after=await catalog();const {def:oldDef,prosrc:oldBody,...oldMetadata}=acceptanceBefore;const {def:newDef,prosrc:newBody,...newMetadata}=after;
 assert.deepEqual(newMetadata,oldMetadata);assert.notEqual(newDef,oldDef);assert.equal(newBody,acceptanceBody);
 assert.equal(createHash('md5').update(acceptanceBody.replace(/\s/g,'')).digest('hex'),reviewedAcceptanceMD5);
 assert.equal(createHash('md5').update(oldBody.replace(/\s/g,'')).digest('hex'),'d740d67ba94ab9dbf69ca540d9a7bb03');
 assert.equal(after.prosecdef,true);assert.deepEqual(after.proconfig,['search_path=""']);assert.equal(after.lanname,'plpgsql');
 assert.equal(after.result,'TABLE(result text, order_id uuid, assignment_id uuid)');
});
for(const name of ['austa_p2c_price_transition','austa_p2c_append_evidence','austa_p2c_order_transition'])test('authority: '+name,async()=>{
 const f=(await db.query("SELECT p.oid,p.prosecdef,p.proconfig,p.provolatile,r.rolname,l.lanname,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') auth,has_function_privilege('service_role',p.oid,'EXECUTE') service FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang WHERE proname=$1",[name])).rows[0];
 assert.equal(f.prosecdef,true);assert.deepEqual(f.proconfig,['search_path=""']);assert.equal(f.rolname,'postgres');assert.equal(f.lanname,'plpgsql');assert.equal(f.anon,false);assert.equal(f.auth,false);assert.equal(f.service,true);
});
for(const role of ['anon','authenticated'])test(role+' cannot invoke new privileged RPC',async()=>{await db.exec('SET ROLE '+role);try{await rejects(()=>db.query("SELECT public.austa_p2c_price_transition(NULL,NULL,NULL,NULL,NULL,NULL)"),'42501');}finally{await db.exec('RESET ROLE');}});
test('service_role can execute with explicit valid actor',async()=>{const s=await seed();await db.exec('SET ROLE service_role');try{assert.equal((await price(s,'offer')).price_status,'offered');}finally{await db.exec('RESET ROLE');}});
for(const action of ['offer','approve','reject'])test('F03 valid '+action,async()=>{const s=await seed();const result=await price(s,action);assert.equal(result.price_status,action==='offer'?'offered':action==='approve'?'confirmed':'rejected');assert.ok(result[action==='offer'?'price_offered_at':'price_responded_at']);if(action==='approve')assert.equal(Number(result.final_price),25);});
for(const action of ['offer','approve','reject'])test('F03 stale snapshot '+action+' leaves row unchanged',async()=>{const s=await seed();const expected=snapshot(await order(s.id));await price(s,'offer');const before=await order(s.id);await rejects(()=>price(s,action,action==='offer'?provider:customer,expected),'40001');assert.deepEqual(await order(s.id),before);});
test('F03 wrong provider rejected',async()=>{const s=await seed();await rejects(()=>price(s,'offer',foreign),'42501');});
for(const action of ['approve','reject'])test('F03 wrong customer '+action,async()=>{const s=await seed();await rejects(()=>price(s,action,foreign),'42501');});
for(const state of ['pending','in_progress','completed','cancelled'])test('F03 parent '+state+' fails closed',async()=>{const s=await seed(state);await rejects(()=>price(s,'offer'),'40001');});
for(const state of ['confirmed','final'])test('F03 provider cannot overwrite '+state,async()=>{const s=await seed('accepted',state);await rejects(()=>price(s,'offer'),'40001');});
for(const value of [null,-1,'NaN','Infinity','-Infinity'])test('F03 invalid price '+value,async()=>{const s=await seed();await rejects(()=>price(s,'offer',provider,undefined,value),'22023');});
test('F03 rejected reoffer legal and same amount/ABA offer cannot reuse generation',async()=>{
 const s=await seed();await price(s,'offer',provider,undefined,25);const first=await order(s.id),old=snapshot(first);
 await price(s,'reject');await price(s,'offer',provider,undefined,25);const next=await order(s.id);
 assert.notEqual(next.price_offered_at,first.price_offered_at);await rejects(()=>price(s,'approve',customer,old),'40001');
});
test('F03 timestamp comparison accepts equivalent ISO timezone representation',async()=>{const s=await seed();await price(s,'offer');const expected=snapshot(await order(s.id));expected.price_offered_at=String(expected.price_offered_at).replace('+00:00','Z');assert.equal((await price(s,'approve',customer,expected)).price_status,'confirmed');});
test('F03 assignment belongs to same parent and accepted state',async()=>{const s=await seed(),other=await seed();await rejects(()=>price({...s,aid:other.aid},'offer'),'42501');await db.query("UPDATE public.service_order_assignments SET status='cancelled' WHERE id=$1",[s.aid]);await rejects(()=>price(s,'offer'),'42501');});
test('F04 appends preserve both records; same identity retry does not duplicate',async()=>{const s=await seed();const a=record(s),b=record(s);await append(s,a);await append(s,b);await append(s,a);assert.deepEqual((await order(s.id)).evidence_files,[a,b]);});
test('F04 retry after terminal state acknowledges already committed record',async()=>{const s=await seed(),r=record(s);await append(s,r);await transition(s,'cancel');assert.equal((await append(s,r)).status,'cancelled');});
for(const field of ['bucket','path','category','content_type','assignment_id','uploaded_at'])test('F04 bad '+field+' rejected',async()=>{const s=await seed(),r=record(s);r[field]='invalid';await assert.rejects(()=>append(s,r));assert.deepEqual((await order(s.id)).evidence_files,[]);});
test('F04 wrong provider rejected',async()=>{const s=await seed();await rejects(()=>append(s,record(s),foreign),'42501');});
test('F04 malformed persisted evidence fails closed',async()=>{const s=await seed();await db.query("UPDATE public.service_orders SET evidence_files='{}' WHERE id=$1",[s.id]);await rejects(()=>append(s,record(s)),'22023');assert.deepEqual((await order(s.id)).evidence_files,{});});
test('F04 wrong stage, extra/private fields and changed same-path record fail closed',async()=>{const s=await seed(),r=record(s);await rejects(()=>append(s,record(s,'after')),'40001');await rejects(()=>append(s,{...r,private_data:'no'}),'22023');await append(s,r);await rejects(()=>append(s,{...r,uploaded_at:'2026-11-02T14:00:00Z'}),'40001');});
test('F04 canonical client_order_id folder supported',async()=>{const s=await seed(),r=record(s);await db.query("UPDATE public.service_orders SET client_order_id=' AU-V54 / special ' WHERE id=$1",[s.id]);r.path=r.path.replace(s.id,'AU-V54___special');await append(s,r);assert.equal((await order(s.id)).evidence_files.length,1);});
for(const state of ['pending','accepted','in_progress'])test('F05 cancellation includes all actionable children: '+state,async()=>{const s=await seed(state);await transition(s,'cancel');assert.equal((await order(s.id)).status,'cancelled');assert.equal((await assignment(s.aid)).status,'cancelled');});
for(const terminal of ['rejected','cancelled','completed'])test('F05 cancellation preserves child history '+terminal,async()=>{const s=await seed();await db.query('UPDATE public.service_order_assignments SET status=$2 WHERE id=$1',[s.aid,terminal]);await transition(s,'cancel');assert.equal((await assignment(s.aid)).status,terminal);});
test('F05 completed/already cancelled parent cannot cancel',async()=>{for(const status of ['completed','cancelled']){const s=await seed(status);await rejects(()=>transition(s,'cancel'),'40001');}});
test('F05 foreign customer/provider and null actor fail closed',async()=>{const s=await seed();await rejects(()=>transition(s,'cancel',foreign),'42501');await rejects(()=>transition(s,'start',foreign),'42501');await rejects(()=>transition(s,'start',null),'22023');});
test('F05 start and complete update both rows, timestamps and final price atomically',async()=>{const s=await seed('accepted','confirmed');await append(s,record(s));const start=await transition(s,'start');assert.equal(start.order.status,'in_progress');assert.equal(start.assignment.status,'in_progress');assert.ok(start.order.started_at);await append(s,record(s,'after'));const done=await transition(s,'complete');assert.equal(done.order.status,'completed');assert.equal(done.assignment.status,'completed');assert.equal(done.order.price_status,'final');});
test('F05 required evidence and confirmed price enforced',async()=>{const s=await seed();await rejects(()=>transition(s,'start'),'40001');await append(s,record(s));await rejects(()=>transition(s,'start'),'40001');});
test('F05 cancel then start/complete fail; completed then cancel fails',async()=>{const s=await seed('accepted','confirmed');await append(s,record(s));await transition(s,'cancel');for(const action of ['start','complete'])await rejects(()=>transition(s,action),'40001');});
test('F05 forced second-write failure rolls back parent and child',async()=>{
 const s=await seed('accepted','confirmed');await append(s,record(s));const before=await order(s.id),child=await assignment(s.aid);
 await db.exec("CREATE FUNCTION public.test_fail_child() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'forced child failure'; END$$; CREATE TRIGGER test_fail_child BEFORE UPDATE ON public.service_order_assignments FOR EACH ROW EXECUTE FUNCTION public.test_fail_child()");
 try{await assert.rejects(()=>transition(s,'start'),/forced child failure/);assert.deepEqual(await order(s.id),before);assert.deepEqual(await assignment(s.aid),child);await assert.rejects(()=>transition(s,'cancel'),/forced child failure/);assert.deepEqual(await order(s.id),before);}finally{await db.exec('DROP TRIGGER test_fail_child ON public.service_order_assignments; DROP FUNCTION public.test_fail_child()');}
});
for(const state of ['accepted','in_progress','completed','cancelled'])test('F05 late assignment insert rejected: '+state,async()=>{const s=await seed(state);await rejects(()=>db.query('INSERT INTO public.service_order_assignments(order_id,provider_id,provider_type) VALUES($1,$2,\'mechanic\')',[s.id,randomUUID()]),'40001');});
test('F05 pending assignment insert remains valid and unique constraint preserved',async()=>{const s=await seed('pending');await db.query('INSERT INTO public.service_order_assignments(order_id,provider_id,provider_type) VALUES($1,$2,\'mechanic\')',[s.id,foreign]);await rejects(()=>db.query('INSERT INTO public.service_order_assignments(order_id,provider_id,provider_type) VALUES($1,$2,\'mechanic\')',[s.id,foreign]),'23505');});
test('F05 existing acceptance still wins once and cancels other offered assignments',async()=>{const s=await seed('pending');await db.query('INSERT INTO public.service_order_assignments(order_id,provider_id,provider_type) VALUES($1,$2,\'mechanic\')',[s.id,foreign]);const rows=(await db.query('SELECT * FROM public.accept_service_order_assignment_atomic($1,$2)',[s.aid,provider])).rows;assert.equal(rows[0].result,'accepted');assert.equal((await order(s.id)).status,'accepted');const all=(await db.query('SELECT status FROM public.service_order_assignments WHERE order_id=$1',[s.id])).rows;assert.deepEqual(all.map(x=>x.status).sort(),['accepted','cancelled']);});
test('preflight refuses collisions without modifying installed hardened functions',async()=>{const before=(await db.query("SELECT pg_get_functiondef('public.austa_p2c_price_transition(uuid,uuid,uuid,text,numeric,jsonb)'::regprocedure) d")).rows;await assert.rejects(()=>db.exec(reviewed),/object collision/);await db.exec('ROLLBACK');assert.deepEqual((await db.query("SELECT pg_get_functiondef('public.austa_p2c_price_transition(uuid,uuid,uuid,text,numeric,jsonb)'::regprocedure) d")).rows,before);});
if(!process.env.P2C_MUTATION)for(const [name,m] of Object.entries(mutations))test('P2.C DB mutation detected: '+name,()=>{
 const pattern=name==='cas'?m[4]:m[2];const env={...process.env,P2C_MUTATION:name};delete env.NODE_TEST_CONTEXT;const run=cp.spawnSync(process.execPath,['--test','--test-name-pattern='+pattern,__filename],{env,encoding:'utf8',maxBuffer:2e6});
 assert.notEqual(run.status,0);assert.match(run.stdout,/AssertionError|ERR_ASSERTION/);assert.doesNotMatch(run.stdout+run.stderr,/syntax error|Cannot find module|preflight:/);
});

// Feed the real historical guards a tracked-candidate discovery result. The
// temporary child-process fixture changes no source/index and exercises exact
// allowlists even for files not yet tracked in this uncommitted candidate.
const approvedPaths=['backend/a-usta56/src/routes/service-orders.ts','backend/a-usta56/src/validation/service-orders.ts','backend/a-usta56/tests/service-orders.test.ts'];
const protectedPaths=['backend/a-usta56/src/middleware/auth.ts','backend/a-usta56/src/config/supabase.ts','backend/a-usta56/package.json','backend/a-usta56/tests/p2c-unauthorized-probe.test.ts'];
if(!process.env.P2C_MUTATION)for(const candidate of [...approvedPaths,...protectedPaths])test('P2.C exact tracked-path guard proof: '+candidate,()=>{
 // P2.D.1 authorizes only this exact manifest; child guards also fingerprint it.
 const reviewedManifest=candidate==='backend/a-usta56/package.json';
 if(reviewedManifest)assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,candidate))).digest('hex'),'cfee11ceea3568a764983e5d4e1b132500c6c4dedce963d2083445b9e4544802');
 const reviewedServerKey=candidate==='backend/a-usta56/src/config/supabase.ts';
 if(reviewedServerKey)require('../helpers/server-key-baseline.cjs').assertConfig();
 const accepted=approvedPaths.includes(candidate)||reviewedManifest||reviewedServerKey;
 const bootstrap=`const cp=require('node:child_process'),old=cp.execFileSync;
 cp.execFileSync=function(cmd,args,opts){
   if(cmd==='git'&&args[0]==='diff'&&args.includes('backend')){
     if(args.includes('--name-only'))return ${JSON.stringify(candidate+'\n')};
     if(!args.includes(':(exclude)'+${JSON.stringify(candidate)}))return 'diff --git a/'+${JSON.stringify(candidate)}+' b/'+${JSON.stringify(candidate)}+'\\n';
   }
   return old.apply(this,arguments);
 };
 require(${JSON.stringify(path.join(root,'tests/listing-validation.test.cjs'))});
 require(${JSON.stringify(path.join(root,'tests/listing-metadata-partial.test.cjs'))});
 require(${JSON.stringify(path.join(root,'tests/db/seller-eligibility.test.cjs'))});`;
 const env={...process.env,P2A_CHILD:'1'};delete env.NODE_TEST_CONTEXT;
 const run=cp.spawnSync(process.execPath,['--test-reporter=tap','--test-name-pattern=protected runtime assets|protected scripts and modules|migration is functions-only','-e',bootstrap],{cwd:root,env,encoding:'utf8',maxBuffer:2e6});
 if(accepted){assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/# pass 3/);}
 else{assert.notEqual(run.status,0);assert.match(run.stdout,/AssertionError/);assert.match(run.stdout,/# fail 3/);}
 assert.doesNotMatch(run.stdout+run.stderr,/Cannot find (?:module|package)|SyntaxError/);
});
for(const field of ['price_status','proposed_price','final_price','price_offered_at','price_responded_at'])test('F03 CAS protects '+field,async()=>{
 const s=await seed(),expected=snapshot(await order(s.id));expected[field]=field==='price_status'?'rejected':field.includes('_at')?'2026-01-01T00:00:00Z':99;const before=await order(s.id);await rejects(()=>price(s,'offer',provider,expected),'40001');assert.deepEqual(await order(s.id),before);
});
test('F03 same-amount offered replacement invalidates earlier approval snapshot',async()=>{const s=await seed();await price(s,'offer',provider,undefined,25);const old=snapshot(await order(s.id));await price(s,'offer',provider,undefined,25);await rejects(()=>price(s,'approve',customer,old),'40001');});
test('F05 complete then cancel fails and legacy unconfirmed completion keeps optional override',async()=>{
 const s=await seed('in_progress','estimated');await append(s,record(s,'after'));const done=await transition(s,'complete',provider,12.345,'final');assert.equal(Number(done.order.final_price),12.35);assert.equal(done.order.status,'completed');await rejects(()=>transition(s,'cancel'),'40001');
});
test('F05 completion second-write failure rolls back parent final price and timestamps',async()=>{
 const s=await seed('in_progress','confirmed');await append(s,record(s,'after'));const before=await order(s.id),child=await assignment(s.aid);
 await db.exec("CREATE FUNCTION public.test_complete_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'forced completion failure'; END$$; CREATE TRIGGER test_complete_failure BEFORE UPDATE ON public.service_order_assignments FOR EACH ROW EXECUTE FUNCTION public.test_complete_failure()");
 try{await assert.rejects(()=>transition(s,'complete'),/forced completion failure/);assert.deepEqual(await order(s.id),before);assert.deepEqual(await assignment(s.aid),child);}finally{await db.exec('DROP TRIGGER test_complete_failure ON public.service_order_assignments; DROP FUNCTION public.test_complete_failure()');}
});
for(const drift of ['column','constraint','trigger','acceptance-body','acceptance-acl'])test('preflight rejects '+drift+' before new objects exist',async()=>{
 const isolated=new PGlite();try{await isolated.exec(fixture);
 if(drift==='column')await isolated.exec('ALTER TABLE public.service_orders ALTER COLUMN proposed_price TYPE numeric(10,2)');
 if(drift==='constraint')await isolated.exec('ALTER TABLE public.service_orders DROP CONSTRAINT service_orders_status_check');
 if(drift==='trigger')await isolated.exec('ALTER TABLE public.service_orders DISABLE TRIGGER trg_service_orders_updated_at');
 if(drift==='acceptance-body'){const definition=fixture.match(/CREATE OR REPLACE FUNCTION public\.accept_service_order_assignment_atomic[\s\S]*?\$function\$[\s\S]*?\$function\$/)[0];await isolated.exec(definition.replace('begin','begin\n perform 1;'));}
 if(drift==='acceptance-acl')await isolated.exec('GRANT EXECUTE ON FUNCTION public.accept_service_order_assignment_atomic(uuid,uuid) TO authenticated');
 await assert.rejects(()=>isolated.exec(reviewed),/P2.C preflight/);await isolated.exec('ROLLBACK');assert.equal((await isolated.query("SELECT count(*)::int n FROM pg_proc WHERE proname LIKE 'austa_p2c_%'")).rows[0].n,0);
 }finally{await isolated.close();}
});
if(!process.env.P2C_MUTATION)for(const [file,from,to] of [
 ['backend/a-usta56/src/middleware/auth.ts','const token = authorization.slice("Bearer ".length).trim();','const token = "unverified";'],
 ['backend/a-usta56/src/config/supabase.ts','persistSession: false','persistSession: true'],
 ['backend/a-usta56/package.json','"version": "0.1.0"','"version": "0.1.1"'],
])test('P2.C protected bytes mutation rejected: '+file,()=>{
 const target=path.join(root,file);assert.ok(fs.readFileSync(target,'utf8').includes(from));
 const bootstrap=`const fs=require('node:fs'),path=require('node:path'),read=fs.readFileSync;let hits=0;
 fs.readFileSync=function(file){const data=read.apply(this,arguments);if(path.resolve(String(file))!==${JSON.stringify(target)})return data;hits++;const changed=String(data).replace(${JSON.stringify(from)},${JSON.stringify(to)});return typeof data==='string'?changed:Buffer.from(changed);};
 process.on('beforeExit',()=>require('node:assert/strict').ok(hits>0,'mutation not exercised'));
 require(${JSON.stringify(path.join(root,'tests/db/seller-eligibility.test.cjs'))});`;
 const env={...process.env,P2A_CHILD:'1'};delete env.NODE_TEST_CONTEXT;
 const run=cp.spawnSync(process.execPath,['--test-reporter=tap','--test-name-pattern=migration is functions-only','-e',bootstrap],{cwd:root,env,encoding:'utf8',maxBuffer:2e6});
 assert.notEqual(run.status,0);assert.match(run.stdout,/AssertionError/);assert.doesNotMatch(run.stdout+run.stderr,/SyntaxError|mutation not exercised|Cannot find/);
});
test('F04 concurrent queued submissions preserve both successful append records (not row-lock proof)',async()=>{const s=await seed(),a=record(s),b=record(s);const results=await Promise.all([append(s,a),append(s,b)]);assert.equal(results.length,2);assert.deepEqual((await order(s.id)).evidence_files,[a,b]);});
for(const first of ['accept','cancel'])test('F05 acceptance/cancel serial schedule '+first+' leaves no actionable child',async()=>{const s=await seed('pending');const accept=()=>db.query('SELECT * FROM public.accept_service_order_assignment_atomic($1,$2)',[s.aid,provider]);if(first==='accept'){assert.equal((await accept()).rows[0].result,'accepted');await transition(s,'cancel');}else{await transition(s,'cancel');assert.notEqual((await accept()).rows[0].result,'accepted');}assert.equal((await order(s.id)).status,'cancelled');assert.equal((await assignment(s.aid)).status,'cancelled');});
for(const first of ['start','cancel'])test('F05 start/cancel serial schedule '+first+' is consistent',async()=>{const s=await seed('accepted','confirmed');await append(s,record(s));if(first==='start'){await transition(s,'start');await transition(s,'cancel');}else{await transition(s,'cancel');await rejects(()=>transition(s,'start'),'40001');}assert.equal((await order(s.id)).status,'cancelled');assert.equal((await assignment(s.aid)).status,'cancelled');});
for(const first of ['complete','cancel'])test('F05 complete/cancel serial schedule '+first+' is consistent',async()=>{const s=await seed('in_progress','confirmed');await append(s,record(s,'after'));if(first==='complete'){await transition(s,'complete');await rejects(()=>transition(s,'cancel'),'40001');}else{await transition(s,'cancel');await rejects(()=>transition(s,'complete'),'40001');}assert.equal((await order(s.id)).status,first==='complete'?'completed':'cancelled');assert.equal((await assignment(s.aid)).status,(await order(s.id)).status);});
test('F05 zero-row child cancellation cannot report success or commit parent cancellation',async()=>{
 const s=await seed(),before=await order(s.id);
 await db.exec("CREATE FUNCTION public.test_skip_child() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NULL; END$$; CREATE TRIGGER test_skip_child BEFORE UPDATE ON public.service_order_assignments FOR EACH ROW EXECUTE FUNCTION public.test_skip_child()");
 try{await rejects(()=>transition(s,'cancel'),'40001');assert.deepEqual(await order(s.id),before);assert.equal((await assignment(s.aid)).status,'accepted');}finally{await db.exec('DROP TRIGGER test_skip_child ON public.service_order_assignments; DROP FUNCTION public.test_skip_child()');}
});

function acceptanceLockContract(body){
 const sql=body.replace(/\/\*[\s\S]*?\*\/|--[^\n]*/g,'');
 const lockStatements=[...sql.matchAll(/\bSELECT\b[^;]*?\bFOR\s+UPDATE\b/gi)].map(m=>m[0]);
 assert.equal(lockStatements.length,2,'exactly parent + assignment-set lock statements');
 assert.match(lockStatements[0],/FROM\s+public\.service_orders\b/i,'parent must be first retained business row lock');
 assert.match(lockStatements[1],/FROM\s+public\.service_order_assignments\b/i);
 assert.match(lockStatements[1],/ORDER\s+BY\s+sa\.id\s+FOR\s+UPDATE\s*$/i,'assignment set locks must be deterministic');
 assert.match(lockStatements[1],/sa\.order_id=v_discovered_order_id\s+AND\s+\(sa\.id=p_assignment_id\s+OR\s+sa\.status='offered'\)/);
 const discovery=sql.match(/SELECT sa\.\* INTO v_discovery[^;]*;/)?.[0];assert.ok(discovery);assert.doesNotMatch(discovery,/FOR\s+(?:UPDATE|SHARE)/i);
 assert.ok(sql.indexOf('v_assignment.provider_id IS DISTINCT FROM p_provider_id')>sql.indexOf('ORDER BY sa.id FOR UPDATE'));
 assert.ok(sql.indexOf('v_assignment.status<>\'offered\'')>sql.indexOf('ORDER BY sa.id FOR UPDATE'));
 assert.match(sql,/v_assignment\.order_id IS DISTINCT FROM v_discovered_order_id/);
}
test('acceptance parent-first actual SQL contract prevents old retained lock order',async()=>acceptanceLockContract((await catalog()).prosrc));
if(!process.env.P2C_MUTATION&&!process.env.P2C_ACCEPT_LOCK_MUTATION)test('acceptance deadlock-order mutation is detected by dedicated actual installed SQL assertion',()=>{
 const env={...process.env,P2C_ACCEPT_LOCK_MUTATION:'1'};delete env.NODE_TEST_CONTEXT;
 const run=cp.spawnSync(process.execPath,['--test','--test-reporter=tap','--test-name-pattern=acceptance parent-first actual SQL',__filename],{cwd:root,env,encoding:'utf8',maxBuffer:2e6});
 assert.notEqual(run.status,0);assert.match(run.stdout,/AssertionError|ERR_ASSERTION/);assert.match(run.stdout,/parent must be first retained business row lock/);assert.doesNotMatch(run.stdout+run.stderr,/syntax error|Cannot find|postcondition failed/);
});
async function accept(s,actor=provider){return (await db.query('SELECT * FROM public.accept_service_order_assignment_atomic($1,$2)',[s.aid,actor])).rows[0];}
async function competitors(s){const id=randomUUID();await db.query("INSERT INTO public.service_order_assignments(id,order_id,provider_id,provider_type) VALUES($1,$2,$3,'mechanic')",[id,s.id,foreign]);return {...s,aid:id};}
async function acceptedInvariant(s,winner){
 const parent=await order(s.id),rows=(await db.query('SELECT * FROM public.service_order_assignments WHERE order_id=$1',[s.id])).rows;
 assert.equal(parent.status,'accepted');assert.equal(rows.filter(r=>r.status==='accepted').length,1);assert.equal(rows.filter(r=>r.status==='offered').length,0);
 const won=rows.find(r=>r.id===winner);assert.equal(won.status,'accepted');assert.equal(new Date(won.accepted_at).getTime(),new Date(parent.accepted_at).getTime());
 for(const row of rows)if(row.id!==winner)assert.equal(row.status,'cancelled');
}
for(const actor of [foreign,null])test('acceptance wrong/NULL provider cannot gain authority '+String(actor),async()=>{const s=await seed('pending'),before=await order(s.id);assert.equal((await accept(s,actor)).result,'forbidden');assert.deepEqual(await order(s.id),before);assert.equal((await assignment(s.aid)).status,'offered');});
test('acceptance invalid UUID provider is rejected before function execution',async()=>{const s=await seed('pending');await rejects(()=>accept(s,'not-a-uuid'),'22P02');assert.equal((await order(s.id)).status,'pending');});
test('acceptance missing assignment keeps business result',async()=>{assert.deepEqual(await accept({aid:randomUUID()}),{result:'assignment_not_found',order_id:null,assignment_id:null});});
for(const status of ['accepted','in_progress','rejected','completed','cancelled'])test('acceptance non-offered '+status+' is rejected from locked state',async()=>{const s=await seed('pending');await db.query('UPDATE public.service_order_assignments SET status=$2 WHERE id=$1',[s.aid,status]);assert.equal((await accept(s)).result,'assignment_not_offered');assert.equal((await order(s.id)).status,'pending');});
for(const status of ['accepted','in_progress','completed','cancelled'])test('acceptance non-pending parent '+status+' is rejected',async()=>{const s=await seed('pending');await db.query('UPDATE public.service_orders SET status=$2 WHERE id=$1',[s.id,status]);assert.equal((await accept(s)).result,'order_not_pending');assert.equal((await assignment(s.aid)).status,'offered');});
test('acceptance exactly one winner, competing cancellation and timestamp consistency',async()=>{const s=await seed('pending');await competitors(s);assert.equal((await accept(s)).result,'accepted');await acceptedInvariant(s,s.aid);});
for(const first of ['provider','foreign'])test('acceptance two providers modeled schedule: '+first,async()=>{const s=await seed('pending'),other=await competitors(s);const winner=first==='provider'?s:other,loser=first==='provider'?other:s;const actor=first==='provider'?provider:foreign;assert.equal((await accept(winner,actor)).result,'accepted');assert.equal((await accept(loser,actor===provider?foreign:provider)).result,'assignment_not_offered');await acceptedInvariant(s,winner.aid);});
test('acceptance same assignment queued concurrent submissions have one success (not row-lock proof)',async()=>{const s=await seed('pending');const results=await Promise.all([accept(s),accept(s)]);assert.deepEqual(results.map(r=>r.result).sort(),['accepted','assignment_not_offered']);await acceptedInvariant(s,s.aid);});
for(const first of ['accept','insert'])test('acceptance vs late INSERT modeled schedule: '+first,async()=>{const s=await seed('pending');if(first==='insert'){await competitors(s);await accept(s);await acceptedInvariant(s,s.aid);}else{await accept(s);await rejects(()=>db.query("INSERT INTO public.service_order_assignments(order_id,provider_id,provider_type) VALUES($1,$2,'mechanic')",[s.id,foreign]),'40001');await acceptedInvariant(s,s.aid);}});
test('acceptance then valid pricing/evidence/start works; accept after start cannot win again',async()=>{const s=await seed('pending');await accept(s);await price(s,'offer');await price(s,'approve');await append(s,record(s));await transition(s,'start');assert.equal((await accept(s)).result,'assignment_not_offered');assert.equal((await order(s.id)).status,'in_progress');assert.equal((await assignment(s.aid)).status,'in_progress');});
for(const target of ['parent','winner','loser'])test('acceptance '+target+' zero-row write rolls back every prior write',async()=>{
 const s=await seed('pending');await competitors(s);const parentBefore=await order(s.id),childrenBefore=(await db.query('SELECT * FROM public.service_order_assignments WHERE order_id=$1 ORDER BY id',[s.id])).rows;
 const table=target==='parent'?'service_orders':'service_order_assignments';const cond=target==='loser'?"NEW.status='cancelled'":"NEW.status='accepted'";
 await db.exec(`CREATE FUNCTION public.test_acceptance_skip() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF ${cond} THEN RETURN NULL; END IF; RETURN NEW; END$$; CREATE TRIGGER test_acceptance_skip BEFORE UPDATE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.test_acceptance_skip()`);
 try{await rejects(()=>accept(s),'40001');assert.deepEqual(await order(s.id),parentBefore);assert.deepEqual((await db.query('SELECT * FROM public.service_order_assignments WHERE order_id=$1 ORDER BY id',[s.id])).rows,childrenBefore);}finally{await db.exec(`DROP TRIGGER test_acceptance_skip ON public.${table}; DROP FUNCTION public.test_acceptance_skip()`);}
});
test('acceptance relationship drift after discovery fails closed without following another parent (fault injection)',async()=>{
 const s=await seed('pending'),other=await seed('pending');await db.query('DELETE FROM public.service_order_assignments WHERE id=$1',[other.aid]);const first=await order(s.id),second=await order(other.id);
 const marker=' v_discovered_order_id:=v_discovery.order_id;';assert.ok(acceptanceDefinition.includes(marker));
 const injected=acceptanceDefinition.replace(marker,marker+`\n UPDATE public.service_order_assignments SET order_id='${other.id}'::uuid WHERE id=p_assignment_id;`);
 await db.exec(injected);
 try{await assert.rejects(()=>accept(s),e=>e.code==='40001'&&/relationship changed/.test(e.message));assert.deepEqual(await order(s.id),first);assert.deepEqual(await order(other.id),second);assert.equal((await assignment(s.aid)).order_id,s.id);}finally{await db.exec(acceptanceDefinition);}
});
test('acceptance new body drift is detected after installation by exact reviewed fingerprint',async()=>{
 const changed=acceptanceDefinition.replace('v_accepted_at:=now();','v_accepted_at:=clock_timestamp();');assert.notEqual(changed,acceptanceDefinition);await db.exec(changed);
 try{const body=(await catalog()).prosrc;assert.notEqual(createHash('md5').update(body.replace(/\s/g,'')).digest('hex'),reviewedAcceptanceMD5);await assert.rejects(()=>db.exec(reviewed.match(/DO \$acceptance_postcondition\$[\s\S]*?\$acceptance_postcondition\$;/)[0]),/acceptance postcondition failed/);}finally{await db.exec(acceptanceDefinition);}
});
for(const change of ['provider','status','deleted'])test('acceptance discovery is not authority: locked '+change+' is revalidated (fault injection)',async()=>{
 await db.exec('BEGIN');try{
  const s=await seed('pending');const marker=' v_discovered_order_id:=v_discovery.order_id;';
  const mutation=change==='provider'?`UPDATE public.service_order_assignments SET provider_id='${foreign}'::uuid WHERE id=p_assignment_id;`:change==='status'?"UPDATE public.service_order_assignments SET status='cancelled' WHERE id=p_assignment_id;":"DELETE FROM public.service_order_assignments WHERE id=p_assignment_id;";
  await db.exec(acceptanceDefinition.replace(marker,marker+'\n '+mutation));
  assert.equal((await accept(s)).result,change==='provider'?'forbidden':change==='status'?'assignment_not_offered':'assignment_not_found');assert.equal((await order(s.id)).status,'pending');
 }finally{await db.exec('ROLLBACK');}
});
test('acceptance two-provider queued submissions elect one winner (not row-lock proof)',async()=>{const s=await seed('pending'),other=await competitors(s);const results=await Promise.all([accept(s,provider),accept(other,foreign)]);assert.equal(results.filter(r=>r.result==='accepted').length,1);assert.equal(results.filter(r=>r.result==='assignment_not_offered').length,1);const winner=results.find(r=>r.result==='accepted');await acceptedInvariant(s,winner.assignment_id);});
test('acceptance/start modeled schedule: start before acceptance fails without mutation',async()=>{const s=await seed('pending');await rejects(()=>transition(s,'start'),'40001');assert.equal((await order(s.id)).status,'pending');assert.equal((await accept(s)).result,'accepted');await acceptedInvariant(s,s.aid);});
test('acceptance deterministic-lock mutation is detected on actual installed SQL',async()=>{
 const mutant=acceptanceDefinition.replace('ORDER BY sa.id FOR UPDATE','FOR UPDATE');assert.notEqual(mutant,acceptanceDefinition);await db.exec(mutant);
 try{const actual=(await catalog()).prosrc;assert.throws(()=>acceptanceLockContract(actual),e=>e instanceof assert.AssertionError&&/deterministic/.test(e.message));}
 finally{await db.exec(acceptanceDefinition);}
});
