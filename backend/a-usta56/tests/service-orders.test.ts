import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { Writable } from "node:stream";
import { Admission, installAdmission, admissionPolicy } from "../src/diagnostics/admission.js";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as admissionAPI from "../src/diagnostics/admission.js";
import * as foundationAPI from "../src/diagnostics/foundation.js";
import * as validationAPI from "../src/validation/service-orders.js";
import { randomUUID } from "node:crypto";
import { diagnosticsOptions, installDiagnostics } from "../src/diagnostics/foundation.js";
import { serviceNumber, serviceOrderInputError } from "../src/validation/service-orders.js";
process.env.SUPABASE_URL="https://example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY="test-only-not-a-secret";
const {supabase}=await import("../src/config/supabase.js");
const {serviceOrderRoutes,appendEvidenceSafely}=await import("../src/routes/service-orders.js");
const {authRoutes}=await import("../src/routes/auth.js");
const authAPI=await import("../src/middleware/auth.js");
const customer="11111111-1111-4111-8111-111111111111",provider="22222222-2222-4222-8222-222222222222",id="33333333-3333-4333-8333-333333333333",aid="44444444-4444-4444-8444-444444444444";
const blank=(v:unknown)=>v===undefined||v===null||v==="";
const diagnosticSecrets = ["TEST_BEARER_SECRET", "TEST_PRIVATE_BODY_VALUE", "TEST_SIGNED_CAPABILITY", "TEST_STACK_INTERNAL", "TEST_SQL_DETAIL", "TEST_ENV_VALUE"];
function diagnosticException() {
 const error=new TypeError(diagnosticSecrets.join(" "));
 error.stack="TEST_STACK_INTERNAL /private/internal/file";
 return Object.assign(error,{details:"TEST_PRIVATE_BODY_VALUE",cause:"TEST_ENV_VALUE"});
}
function assertDiagnosticPrivacy(logs:string[]) {
 const text=logs.join("");
 for(const secret of diagnosticSecrets)assert.ok(!text.includes(secret),'diagnostic privacy: '+secret);
}
for(const v of [undefined,null,"",0,1,1.25,"0","1.25","1e2"," 1.5 "])test('F06 numeric valid '+String(v),()=>assert.equal(serviceNumber(v),blank(v)?null:Number(v)));
for(const v of [true,false,[],[1],{}," ","abc",NaN,Infinity,-Infinity,"NaN","Infinity","-Infinity","0x10"])test('F06 explicit numeric invalid '+String(v),()=>assert.equal(serviceNumber(v),null));
for(const field of ['latitude','longitude','estimated_price_min','estimated_price_max'])for(const v of [false,[],{},' ','abc','Infinity'])test('F06 CREATE rejects '+field+' '+JSON.stringify(v),()=>assert.ok(serviceOrderInputError('/service-orders','POST',{service_category:'mechanic_service',[field]:v},{})));
for(const field of ['final_price','distance_km','proposed_price'])for(const v of [false,[],{},' ','abc',-1])test('F06 rejects '+field+' '+JSON.stringify(v),()=>{
 const route=field==='final_price'?'/service-order-assignments/:assignmentId/complete':field==='distance_km'?'/service-orders/:orderId/assignments':'/service-order-assignments/:assignmentId/price-offer';
 assert.ok(serviceOrderInputError(route,field==='distance_km'?'POST':'PATCH',{provider_id:provider,provider_type:'mechanic',[field]:v},{}));
});
for(const field of ['service_description','address','region','district','customer_note','client_order_id','form_version'])test('F06 wrong-type optional text '+field,()=>assert.ok(serviceOrderInputError('/service-orders','POST',{service_category:'mechanic_service',[field]:false},{})));
for(const field of ['urgency','service_mode','price_status'])test('F06 unknown CREATE enum '+field,()=>assert.ok(serviceOrderInputError('/service-orders','POST',{service_category:'mechanic_service',[field]:'unknown-invalid'},{})));
for(const value of [null,'',undefined])test('F06 nullable optional values '+String(value),()=>assert.equal(serviceOrderInputError('/service-orders','POST',{service_category:'mechanic_service',estimated_price_min:value,answers:value,customer_note:value},{}),null));
test('F06 ranges, UUIDs, body and estimate ordering',()=>{
 for(const body of [[],true,'text',1])assert.ok(serviceOrderInputError('/service-orders','POST',body,{}));
 for(const body of [{latitude:91},{longitude:-181},{estimated_price_min:20,estimated_price_max:10},{vehicle_id:'invalid'},{answers:{}},{evidence_files:{}}])assert.ok(serviceOrderInputError('/service-orders','POST',{service_category:'mechanic_service',...body},{}));
 assert.ok(serviceOrderInputError('/service-orders/:orderId/cancel','PATCH',undefined,{orderId:'invalid'}));
 assert.equal(serviceOrderInputError('/service-orders','POST',{service_category:'mechanic_service',latitude:90,longitude:-180,estimated_price_min:0,estimated_price_max:'1.123'},{}),null);
});

type Scenario={authGate?:Promise<void>;uploadGate?:Promise<void>;uploadThrows?:boolean;authThrows?:boolean;rpcThrows?:boolean;acceptResult?:string;actor?:string;order?:Record<string,unknown>;assignment?:Record<string,unknown>;rpcError?:{code?:string};rpcResults?:any[];insertError?:{code:string};};
async function fixture(s:Scenario={}, state=new Admission(), installer=installAdmission, routes=serviceOrderRoutes){
 const calls:any[]=[],uploads:string[]=[],removes:string[]=[],upstream:string[]=[];
 const order={id,customer_id:customer,status:'accepted',price_status:'offered',proposed_price:25,final_price:null,price_offered_at:'2026-11-02T12:00:00.123456+00:00',price_responded_at:null,evidence_files:[],...s.order};
 const assignment={id:aid,order_id:id,provider_id:provider,status:'accepted',...s.assignment};
 (supabase.auth as any).getUser=async()=>{upstream.push("auth");await s.authGate;if(s.authThrows)throw diagnosticException();return {data:{user:{id:s.actor??provider}},error:null};};
 (supabase as any).from=(table:string)=>{
  upstream.push("db");
  let insert:any;
  const q:any={select(){return q},eq(){return q},not(){return q},in(){return q},update(){assert.fail('transition must not write via from.update')},insert(row:any){insert=row;calls.push(['insert',table,row]);return q},async single(){calls.push(['read',table]);return {data:insert?{id,...insert}:table==='service_orders'?order:table==='profiles'?{id:provider,role:'mechanic',is_active:true}:assignment,error:insert?s.insertError??null:null}},async maybeSingle(){return table==='service_order_assignments'?{data:null,error:null}:q.single()}};
  return q;
 };
 (supabase as any).rpc=async(name:string,args:any)=>{
  calls.push(['rpc',name,structuredClone(args)]);
  if(s.rpcThrows)throw diagnosticException();
  if(s.rpcResults?.length){const result=s.rpcResults.shift();if(result instanceof Error)throw result;return result;}
  if(s.rpcError)return {data:null,error:s.rpcError};
  if(name==='accept_service_order_assignment_atomic')return {data:[{result:s.acceptResult??'accepted',order_id:id,assignment_id:aid}],error:null};
  const next={...order,price_status:args.p_action==='offer'?'offered':args.p_action==='approve'?'confirmed':'rejected'};
  return {data:name==='austa_p2c_order_transition'?{order:{...order,status:args.p_action==='start'?'in_progress':args.p_action==='complete'?'completed':'cancelled'},assignment:{...assignment,status:args.p_action==='start'?'in_progress':'completed'}}:name==='austa_p2c_append_evidence'?order:next,error:null};
 };
 (supabase.storage as any).from=(bucket:string)=>({async upload(p:string){uploads.push(p);upstream.push("upload");await s.uploadGate;if(s.uploadThrows)throw diagnosticException();assert.equal(bucket,'service-evidence');return {error:null}},async remove(paths:string[]){removes.push(...paths);return {error:null}}});
 const rawRequests:any[]=[];
 const logs:string[]=[];const stream=new Writable({write(chunk,_encoding,done){logs.push(String(chunk));done();}});
 const app=Fastify({...diagnosticsOptions,logger:{...diagnosticsOptions.logger,stream}});installDiagnostics(app);installer(app,state);
 app.addHook("onRequest",async request=>{rawRequests.push(request.raw);if(request.routeOptions.url?.includes("/evidence/")){const parts=request.parts.bind(request);request.parts=async function* (options:any){upstream.push("parts");for await(const part of parts(options)){if(part.type==="file"){const buffer=part.toBuffer.bind(part);part.toBuffer=async()=>{upstream.push("buffer");return buffer();};}yield part;}};}});
 app.get("/health",async()=>({status:"ok"}));
 await app.register(multipart,{limits:admissionPolicy.multipart});await routes(app);await authRoutes(app);await app.ready();
 return {app,calls,uploads,removes,order,assignment,logs,upstream,state,rawRequests};
}
async function request(url:string,payload?:any,s:Scenario={},method:'POST'|'PATCH'='PATCH'){
 const f=await fixture(s);try{const response=await f.app.inject({method,url,payload,headers:{authorization:'Bearer test-token'}});return {...f,response};}finally{await f.app.close();}
}
for(const action of ['offer','approve','reject'])test('F03 runtime '+action+' uses authenticated actor and exact snapshot RPC',async()=>{
 const url=action==='offer'?`/service-order-assignments/${aid}/price-offer`:`/service-orders/${id}/price/${action}`;
 const f=await request(url,action==='offer'?{proposed_price:'30.12',actor_id:customer}:undefined,{actor:action==='offer'?provider:customer});assert.equal(f.response.statusCode,200);
 const rpc=f.calls.find(c=>c[0]==='rpc');assert.equal(rpc[1],'austa_p2c_price_transition');assert.equal(rpc[2].p_actor_id,action==='offer'?provider:customer);assert.equal(rpc[2].p_expected.price_offered_at,f.order.price_offered_at);assert.deepEqual(Object.keys(rpc[2].p_expected).sort(),['final_price','price_offered_at','price_responded_at','price_status','proposed_price']);assert.ok(f.response.json().order);assert.ok(f.response.json().price);
});
for(const v of [null,'',false,[],{},' ',Infinity])test('F06 runtime invalid offer rejected before DB '+JSON.stringify(v),async()=>{const f=await request(`/service-order-assignments/${aid}/price-offer`,{proposed_price:v});assert.equal(f.response.statusCode,400);assert.deepEqual(f.calls,[]);});
for(const code of ['40001','55P03','22003','42501'])test('F03 runtime RPC '+code+' mapped safely',async()=>{const f=await request(`/service-order-assignments/${aid}/price-offer`,{proposed_price:25},{rpcError:{code}});assert.equal(f.response.statusCode,code==='22003'?400:code==='42501'?403:409);});
for(const action of ['start','complete','cancel'])test('F05 runtime '+action+' uses one atomic transition',async()=>{
 const stage=action==='complete'?'after':'before',status=action==='complete'?'in_progress':'accepted';
 const f=await request(action==='cancel'?`/service-orders/${id}/cancel`:`/service-order-assignments/${aid}/${action}`,action==='cancel'?undefined:{},{actor:action==='cancel'?customer:provider,order:{status,price_status:'confirmed',final_price:25,evidence_files:[{category:stage,assignment_id:aid,path:'some/path',bucket:'service-evidence'}]},assignment:{status}});
 assert.equal(f.response.statusCode,200);const calls=f.calls.filter(c=>c[0]==='rpc');assert.equal(calls.length,1);assert.equal(calls[0][1],'austa_p2c_order_transition');assert.equal(calls[0][2].p_action,action);assert.equal(calls[0][2].p_actor_id,action==='cancel'?customer:provider);
});
test('F06 supplied invalid completion enum rejected even with confirmed price',async()=>{const f=await request(`/service-order-assignments/${aid}/complete`,{price_status:'invalid'},{order:{price_status:'confirmed'}});assert.equal(f.response.statusCode,400);assert.deepEqual(f.calls,[]);});
test('F06 CREATE ignores managed extras and preserves decimals/nulls',async()=>{const f=await request('/service-orders',{service_category:'mechanic_service',estimated_price_min:'1.234',estimated_price_max:'2.345',customer_id:provider,status:'completed',customer_note:'  note  '},{actor:customer},'POST');assert.equal(f.response.statusCode,201);const row=f.calls.find(c=>c[0]==='insert')[2];assert.equal(row.customer_id,customer);assert.equal(row.estimated_price_min,1.234);assert.equal(row.customer_note,'note');assert.ok(!Object.hasOwn(row,'status'));});
for(const code of ['40001','55P03'])test('F05 assignment INSERT guard maps '+code+' to conflict',async()=>{const f=await request(`/service-orders/${id}/assignments`,{provider_id:provider,provider_type:'mechanic'},{actor:customer,order:{status:'pending',service_category:'mechanic_service',service_mode:'mobile'},insertError:{code}},'POST');assert.equal(f.response.statusCode,409);});

// Runtime evidence route, including actual multipart parsing and attempt-scoped cleanup.
function uploadBody(){const boundary='p2c-boundary';return {payload:Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\nphoto\r\n--${boundary}--\r\n`),headers:{authorization:'Bearer test-token','content-type':`multipart/form-data; boundary=${boundary}`}};}
for(const kind of ['success','definite','ambiguous','committed-lost-response','ambiguous-then-definite'])test('F04 runtime evidence '+kind,async()=>{
 const order={id,customer_id:customer,status:'accepted',evidence_files:[]};
 const result={data:order,error:null};const abort={data:null,error:{code:'40001'}};const unknown={data:null,error:{code:'FETCH_ERROR'}};
 const results=kind==='success'?[result]:kind==='definite'?[abort]:kind==='ambiguous'?[unknown,unknown,unknown]:kind==='committed-lost-response'?[new Error('lost success'),result]:[unknown,abort];
 const f=await fixture({rpcResults:results});try{const res=await f.app.inject({method:'POST',url:`/service-order-assignments/${aid}/evidence/before`,...uploadBody()});assert.equal(res.statusCode,kind==='success'||kind==='committed-lost-response'?201:409);assert.equal(f.uploads.length,1);assert.deepEqual(f.removes,kind==='definite'?f.uploads:[]);const args=f.calls.filter(c=>c[0]==='rpc').map(c=>c[2]);for(const a of args){assert.deepEqual(a,args[0]);assert.equal(a.p_record.path,f.uploads[0]);assert.equal(a.p_actor_id,provider);}}finally{await f.app.close();}
});
test('F04 bounded lock retries keep identity; unknown outcome never permits cleanup',async()=>{let f=await fixture({rpcResults:[{data:null,error:{code:'55P03'}},{data:{id},error:null}]});try{const r=await appendEvidenceSafely({p_record:{path:'frozen'}});assert.equal(r.data.id,id);assert.equal(f.calls.length,2);}finally{await f.app.close();}});

test('F06 mutation: boolean numeric coercion detected by dedicated invalid assertion',async()=>{
 const {readFileSync}=await import('node:fs');const {runInNewContext}=await import('node:vm');const ts=await import('typescript');
 const source=readFileSync(new URL('../src/validation/service-orders.ts',import.meta.url),'utf8');
 const guard='  if (typeof value !== "number" && typeof value !== "string") return null;';assert.ok(source.includes(guard));
 function load(code:string){const output=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports:Record<string,any>={};runInNewContext(output,{exports,require:()=>({admissionPolicy}),Buffer});return exports.serviceNumber;}
 const contract=(number:(v:unknown)=>unknown)=>assert.equal(number(false),null,'explicit boolean numeric input must fail closed');
 contract(load(source));assert.throws(()=>contract(load(source.replace(guard,''))),assert.AssertionError);
});

// Acceptance keeps its existing API; no application retry or compensating writes.
test('acceptance caller uses authenticated provider, original RPC parameters and success shape',async()=>{
 const f=await request(`/service-order-assignments/${aid}/accept`,{provider_id:customer,p_provider_id:customer},{actor:provider,order:{status:'accepted'},assignment:{status:'accepted'}});
 assert.equal(f.response.statusCode,200);const calls=f.calls.filter(c=>c[0]==='rpc');assert.equal(calls.length,1);assert.equal(calls[0][1],'accept_service_order_assignment_atomic');assert.deepEqual(calls[0][2],{p_assignment_id:aid,p_provider_id:provider});assert.deepEqual(Object.keys(f.response.json()).sort(),['assignment','message','order']);
});
for(const [result,status] of [['assignment_not_found',404],['forbidden',403],['assignment_not_offered',409],['order_not_found',404],['order_not_pending',409]] as const)test('acceptance business result remains '+result,async()=>{const f=await request(`/service-order-assignments/${aid}/accept`,undefined,{acceptResult:result});assert.equal(f.response.statusCode,status);assert.equal(f.calls.filter(c=>c[0]==='rpc').length,1);});
for(const code of ['40P01','40001','55P03','FETCH_ERROR'])test('acceptance RPC error '+code+' remains fail-closed without backend retry',async()=>{const f=await request(`/service-order-assignments/${aid}/accept`,undefined,{rpcError:{code}});assert.equal(f.response.statusCode,500);assert.equal(f.calls.filter(c=>c[0]==='rpc').length,1);assert.ok(!Object.hasOwn(f.response.json(),'order'));});

test('P2.E.1 actual auth SDK throw returns safe correlated 500',async()=>{
 const f=await fixture({authThrows:true});
 try {
  const response=await f.app.inject({url:'/auth/me?capability=TEST_SIGNED_CAPABILITY',headers:{authorization:'Bearer TEST_BEARER_SECRET',cookie:'TEST_PRIVATE_BODY_VALUE','x-request-id':'TEST_ENV_VALUE'}});
  assert.equal(response.statusCode,500);
  const body=response.json();
  assert.match(body.request_id,/^[0-9a-f-]{36}$/);
  assert.deepEqual(body,{error:'Internal Server Error',message:'Unexpected server error',request_id:body.request_id});
  assert.equal(response.headers['x-request-id'],body.request_id);
  assert.notEqual(body.request_id,'TEST_ENV_VALUE');
  for(const secret of diagnosticSecrets)assert.ok(!response.body.includes(secret));
  assert.ok(!Object.hasOwn(body,'stack'));
  const events=f.logs.map(line=>JSON.parse(line)),diagnostic=events.find(e=>e.event==='request_diagnostic');
  assert.ok(diagnostic,'unexpected error remains observable');
  assert.equal(diagnostic.request_id,body.request_id);assert.equal(diagnostic.reqId,body.request_id);
  assert.equal(diagnostic.error_name,'TypeError');assert.equal(diagnostic.diagnostic_category,'unexpected_internal');
  assert.equal(diagnostic.route,'/auth/me');assert.equal(diagnostic.status_code,500);
  assertDiagnosticPrivacy(f.logs);
 }finally{await f.app.close();}
});

test('P2.E.1 private body and signed capability never enter unexpected diagnostics',async()=>{
 const f=await fixture({rpcThrows:true});
 try {
  const response=await f.app.inject({method:'PATCH',url:`/service-order-assignments/${aid}/price-offer?token=TEST_SIGNED_CAPABILITY`,headers:{authorization:'Bearer TEST_BEARER_SECRET'},payload:{proposed_price:25,customer_note:'TEST_PRIVATE_BODY_VALUE',phone:'TEST_PRIVATE_BODY_VALUE',address:'TEST_PRIVATE_BODY_VALUE'}});
  assert.equal(response.statusCode,500);assert.equal(response.json().message,'Unexpected server error');
  assert.equal(response.headers['x-request-id'],response.json().request_id);
  assertDiagnosticPrivacy(f.logs);
  assert.equal(f.logs.map(line=>JSON.parse(line)).find(e=>e.event==='request_diagnostic').route,'/service-order-assignments/:assignmentId/price-offer');
 }finally{await f.app.close();}
});

test('P2.E.1 handled SDK error stays request-scoped without raw SDK serialization',async()=>{
 const f=await fixture({rpcError:{code:'FETCH_ERROR',message:'TEST_SQL_DETAIL',details:'TEST_PRIVATE_BODY_VALUE',signed_url:'TEST_SIGNED_CAPABILITY'} as any});
 try {
  const response=await f.app.inject({method:'PATCH',url:`/service-order-assignments/${aid}/accept`,headers:{authorization:'Bearer TEST_BEARER_SECRET'}});
  assert.equal(response.statusCode,500);assert.equal(response.json().message,'Service order assignment could not be accepted');
  const event=f.logs.map(line=>JSON.parse(line)).find(e=>e.event==='request_diagnostic');
  assert.ok(event);assert.equal(event.request_id,response.headers['x-request-id']);assert.equal(event.reqId,event.request_id);
  assert.equal(event.diagnostic_category,'database_or_rpc');assertDiagnosticPrivacy(f.logs);
 }finally{await f.app.close();}
});

for(const [result,status]of [['forbidden',403],['assignment_not_found',404],['assignment_not_offered',409]] as const)test('P2.E.1 handled '+status+' preserved',async()=>{
 const f=await request(`/service-order-assignments/${aid}/accept`,undefined,{acceptResult:result});
 assert.equal(f.response.statusCode,status);assert.deepEqual(Object.keys(f.response.json()).sort(),['error','message']);
 assert.ok(f.response.headers['x-request-id']);
});
test('P2.E.1 handled validation 400 preserved',async()=>{
 const f=await request(`/service-order-assignments/${aid}/price-offer`,{proposed_price:false});
 assert.equal(f.response.statusCode,400);assert.deepEqual(f.response.json(),{error:'Bad Request',message:'proposed_price must be finite numeric input'});assert.deepEqual(f.calls,[]);
});
test('P2.E.1 handled authentication 401 preserved',async()=>{
 const f=await fixture();try{const r=await f.app.inject('/auth/me');assert.equal(r.statusCode,401);assert.deepEqual(r.json(),{error:'Unauthorized',message:'Authentication token is required'});assert.ok(r.headers['x-request-id']);}finally{await f.app.close();}
});
test('P2.E.1 server generates distinct IDs and ignores incoming identity',async()=>{
 const f=await fixture();try{const values=[];for(let i=0;i<2;i++){const r=await f.app.inject({url:'/auth/me',headers:{authorization:'Bearer test-token','x-request-id':'TEST_BEARER_SECRET'}});assert.equal(r.statusCode,200);values.push(r.headers['x-request-id']);}assert.ok(values[0]);assert.notEqual(values[0],values[1]);assertDiagnosticPrivacy(f.logs);}finally{await f.app.close();}
});
test('P2.E.1 unmatched 404 preserves its response without logging capability queries',async()=>{
 const f=await fixture();try{
  const url='/unmatched?token=TEST_SIGNED_CAPABILITY',r=await f.app.inject({url,headers:{authorization:'Bearer TEST_BEARER_SECRET'}});
  assert.equal(r.statusCode,404);assert.deepEqual(r.json(),{statusCode:404,error:'Not Found',message:'Route GET:'+url+' not found'});
  assert.ok(r.headers['x-request-id']);assertDiagnosticPrivacy(f.logs);
 }finally{await f.app.close();}
});
test('P2.E.1 known parser 400/413/415 remain safe client errors',async()=>{
 const f=await fixture();try{
  for(const [payload,contentType,status]of [['{"broken":','application/json',400],[JSON.stringify({customer_note:'x'.repeat(1048576)}),'application/json',413],['private','application/xml',415]] as const){
   const r=await f.app.inject({method:'POST',url:'/service-orders',headers:{'content-type':contentType},payload});assert.equal(r.statusCode,status);assert.ok(r.headers['x-request-id']);
  }
 }finally{await f.app.close();}
});
test('P2.E.1 production server installs diagnostics before route plugins',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../src/config/server.ts',import.meta.url),'utf8');
 assert.ok(source.includes('Fastify(diagnosticsOptions)'));assert.ok(source.indexOf('installDiagnostics(app);')<source.indexOf('await app.register('));assert.ok(source.includes('exposedHeaders: ["x-request-id"]'));
});

// P2.E.2A tests exercise actual Fastify routes and bounded, injectable state.
function latch(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r});return {promise,resolve};}
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
function assert429(r:any){
 assert.equal(r.statusCode,429);const b=r.json();
 assert.deepEqual(b,{error:'Too Many Requests',message:'Please try again later',request_id:r.headers['x-request-id'],retry_after_seconds:b.retry_after_seconds});
 assert.ok(Number.isInteger(b.retry_after_seconds)&&b.retry_after_seconds>0);
 assert.equal(r.headers['retry-after'],String(b.retry_after_seconds));assert.equal(r.headers['cache-control'],'no-store');
}
function loadAdmission(change?:(source:string)=>string){
 let source=readFileSync(new URL('../src/diagnostics/admission.ts',import.meta.url),'utf8');if(change)source=change(source);
 const exports:any={};runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(name:string)=>{assert.equal(name,'node:perf_hooks');return {performance:{now:()=>0}};}});return exports;
}
function replaceOnce(source:string,from:string,to:string){assert.equal(source.split(from).length,2,'unique mutation target');return source.replace(from,to);}
function clockContract(C:typeof Admission){
 let now=0;const state=new C(()=>now,4);
 assert.equal(state.spend('actor','a',[[3,1100]]),0); // L-1
 assert.equal(state.spend('actor','a',[[3,1100]]),0);
 assert.equal(state.spend('actor','a',[[3,1100]]),0); // L
 assert.equal(state.spend('actor','a',[[3,1100]]),2); // L+1 rounded
 now=1099;assert.equal(state.spend('actor','a',[[3,1100]]),1);
 now=1100;assert.equal(state.spend('actor','a',[[3,1100]]),0);
 now=2200;state.cleanup();assert.equal(state.sizes.counters,0);
 assert.equal(new C(()=>now).sizes.counters,0); // restart is deliberately empty
}
test('E2A deterministic L-1/L/L+1, rounding, rollover, expiry and restart',()=>clockContract(Admission));
function cardinalityContract(C:typeof Admission){const s=new C(()=>0,2);s.spend('actor','a',[[1,60000]]);s.spend('actor','b',[[1,60000]]);assert.equal(s.spend('actor','c',[[1,60000]]),1);assert.equal(s.sizes.counters,2);}
test('E2A bounded cardinality and safe saturation',()=>cardinalityContract(Admission));
test('E2A multiple windows are charged atomically; active slots are bounded/idempotent',()=>{
 const s=new Admission(()=>0,3);assert.equal(s.spend('create','a',[[1,1000],[2,2000]]),0);assert.equal(s.spend('create','a',[[1,1000],[2,2000]]),1);
 const release=s.slot('upload','a',1)!;assert.ok(release);assert.equal(s.slot('upload','a',1),undefined);release();release();assert.equal(s.sizes.active,0);
 const releases=['a','b','c'].map(id=>s.slot('pool',id,1)!);assert.equal(s.slot('pool','d',1),undefined);releases.forEach(r=>r());assert.equal(s.sizes.active,0);
});
async function preAuthContract(installer=installAdmission){
 const s=new Admission(()=>0);assert.equal(s.spend('process:read','process',[[admissionPolicy.global.read,60000]]),0);
 for(let i=1;i<admissionPolicy.global.read;i++)s.spend('process:read','process',[[admissionPolicy.global.read,60000]]);
 const f=await fixture({},s,installer);try{
  const r=await f.app.inject({url:'/service-orders?token=TEST_SIGNED_CAPABILITY',headers:{authorization:'Bearer TEST_BEARER_SECRET','x-request-id':'TEST_OBJECT_PATH'}});
  assert429(r);assert.deepEqual(f.upstream,[]);assert.notEqual(r.json().request_id,'TEST_OBJECT_PATH');assertDiagnosticPrivacy(f.logs);
  const event=f.logs.map(l=>JSON.parse(l)).find(e=>e.event==='request_admission_rejected');assert.ok(event);assert.equal(event.request_id,r.json().request_id);
  assert.deepEqual(Object.keys(event).filter(k=>!['level','time','pid','hostname','reqId','msg','event','request_id','route','policy_class','scope_type','retry_after_seconds'].includes(k)),[]);
  assert.equal((await f.app.inject('/health')).statusCode,200);
 }finally{await f.app.close();}
}
test('E2A process rejection is correlated/private with zero Auth/DB/Storage, health independent',()=>preAuthContract());
test('E2A auth concurrency precedes getUser and reserves lifecycle capacity',async()=>{
 const gate=latch(),s:Scenario={authGate:gate.promise};const f=await fixture(s);const pending:any[]=[];
 try{
  for(let i=0;i<admissionPolicy.slots.auth;i++){pending.push(f.app.inject({url:'/auth/me',headers:{authorization:'Bearer test-token'}}));await turn();}
  assert.equal(f.upstream.filter(x=>x==='auth').length,8);
  assert429(await f.app.inject({url:'/auth/me',headers:{authorization:'Bearer test-token'}}));assert.equal(f.upstream.length,8);
  const cancel=f.app.inject({method:'PATCH',url:`/service-orders/${id}/cancel`,headers:{authorization:'Bearer test-token'}});await turn();assert.equal(f.upstream.length,9);
  gate.resolve();await cancel;await Promise.all(pending);assert.equal(f.state.sizes.active,0);
 }finally{gate.resolve();await Promise.all(pending);await f.app.close();}
});
async function actorContract(installer=installAdmission){
 const scenario:Scenario={actor:customer};const f=await fixture(scenario,new Admission(()=>0),installer);
 try{
  for(let i=0;i<5;i++)assert.equal((await f.app.inject({method:'POST',url:'/service-orders',headers:{authorization:'Bearer token-'+i},payload:{service_category:'mechanic_service',customer_id:provider}})).statusCode,201);
  const reads=f.upstream.filter(x=>x==='db').length;
  assert429(await f.app.inject({method:'POST',url:'/service-orders',headers:{authorization:'Bearer different-unverified-token'},payload:{service_category:'mechanic_service'}}));assert.equal(f.upstream.filter(x=>x==='db').length,reads);
  scenario.actor=provider;assert.equal((await f.app.inject({method:'POST',url:'/service-orders',headers:{authorization:'Bearer different-unverified-token'},payload:{service_category:'mechanic_service'}})).statusCode,201);
 }finally{await f.app.close();}
}
test('E2A budgets use verified user, never token/body identity; users isolated',()=>actorContract());
test('E2A create short window and daily limit are both process-local',async()=>{
 let now=0;const f=await fixture({actor:customer},new Admission(()=>now));try{
  const create=()=>f.app.inject({method:'POST',url:'/service-orders',headers:{authorization:'Bearer test-token'},payload:{service_category:'mechanic_service'}});
  for(let window=0;window<6;window++){for(let i=0;i<5;i++)assert.equal((await create()).statusCode,201);now+=600000;}
  assert429(await create());now=86400000;assert.equal((await create()).statusCode,201);
 }finally{await f.app.close();}
});
test('E2A resource budget uses authorized returned ID, never arbitrary route ID',async()=>{
 const scenario:Scenario={};const f=await fixture(scenario,new Admission(()=>0));try{
  const offer=(assignmentId=aid)=>f.app.inject({method:'PATCH',url:`/service-order-assignments/${assignmentId}/price-offer`,headers:{authorization:'Bearer test-token'},payload:{proposed_price:25}});
  for(let i=0;i<6;i++)assert.equal((await offer()).statusCode,200);
  const writes=f.calls.filter(c=>c[0]==='rpc').length;assert429(await offer(id));assert.equal(f.calls.filter(c=>c[0]==='rpc').length,writes);
  f.assignment.provider_id=customer;assert.equal((await offer()).statusCode,403);
 }finally{await f.app.close();}
});
test('E2A unauthorized requests never charge assignment resource budget',async()=>{
 const f=await fixture({assignment:{provider_id:customer}},new Admission(()=>0));try{
  const r=await f.app.inject({method:'PATCH',url:`/service-order-assignments/${aid}/price-offer`,headers:{authorization:'Bearer test-token'},payload:{proposed_price:25}});assert.equal(r.statusCode,403);
  // Six available charges prove the denied request did not touch this budget.
  for(let i=0;i<6;i++)assert.equal(f.state.spend('resource:pricing',aid,[[6,60000]]),0);
 }finally{await f.app.close();}
});
test('E2A upload actor/global slots reject before parsing, are bounded and release',async()=>{
 const gate=latch(),scenario:Scenario={uploadGate:gate.promise};const f=await fixture(scenario,new Admission(()=>0));let first:any,second:any;
 try{
  first=f.app.inject({method:'POST',url:`/service-order-assignments/${aid}/evidence/before`,...uploadBody()});await turn();await turn();assert.equal(f.uploads.length,1);
  const before=f.calls.length;
  assert429(await f.app.inject({method:'POST',url:`/service-order-assignments/${aid}/evidence/before`,headers:{authorization:'Bearer test-token','content-type':'multipart/form-data; boundary=bad'},payload:'not multipart'}));assert.equal(f.calls.length,before);assert.equal(f.uploads.length,1);
  scenario.actor=customer;f.assignment.provider_id=customer;
  second=f.app.inject({method:'POST',url:`/service-order-assignments/${aid}/evidence/before`,...uploadBody()});await turn();await turn();assert.equal(f.uploads.length,2);
  scenario.actor=id;f.assignment.provider_id=id;const upstreamBefore=f.upstream.length;
  assert429(await f.app.inject({method:'POST',url:`/service-order-assignments/${aid}/evidence/before`,headers:{authorization:'Bearer test-token','content-type':'multipart/form-data; boundary=bad'},payload:'broken'}));assert.equal(f.upstream.length,upstreamBefore+1);assert.equal(f.uploads.length,2);
  gate.resolve();await Promise.all([first,second]);assert.equal(f.state.sizes.active,0);
  scenario.uploadThrows=true;assert.equal((await f.app.inject({method:'POST',url:`/service-order-assignments/${aid}/evidence/before`,...uploadBody()})).statusCode,500);assert.equal(f.state.sizes.active,0);
 }finally{gate.resolve();await Promise.all([first,second].filter(Boolean));await f.app.close();}
});
test('E2A handled multipart error and socket abort release only after upstream work settles',async()=>{
 const gate=latch(),f=await fixture({uploadGate:gate.promise});let pending:any;
 try{
  const bad=await f.app.inject({method:'POST',url:`/service-order-assignments/${aid}/evidence/before`,headers:{authorization:'Bearer test-token','content-type':'multipart/form-data; boundary=bad'},payload:'broken'});assert.equal(bad.statusCode,400);assert.equal(f.state.sizes.active,0);
  pending=f.app.inject({method:'POST',url:`/service-order-assignments/${aid}/evidence/before`,...uploadBody()});await turn();await turn();assert.equal(f.uploads.length,1);
  f.rawRequests.at(-1).emit('aborted');await turn();assert.equal(f.state.sizes.active,2);
  gate.resolve();await pending;assert.equal(f.state.sizes.active,0);
 }finally{gate.resolve();if(pending)await pending;await f.app.close();}
});
for(const [field,limit] of Object.entries(admissionPolicy.text))test('E2A UTF-8 byte boundary '+field,()=>{
 const input={service_category:'mechanic_service',[field]:'é'.repeat(limit/2)};
 assert.equal(serviceOrderInputError('/service-orders','POST',input,{}),null);assert.ok(serviceOrderInputError('/service-orders','POST',{...input,[field]:input[field]+'x'},{}));
});
test('E2A rich answer shape, count/item/aggregate bytes, initial evidence and form version bounded',()=>{
 const validate=(b:any)=>serviceOrderInputError('/service-orders','POST',{service_category:'mechanic_service',...b},{});
 assert.equal(validate({answers:[{question:'photo',value:[{name:'a',size:10}],nested:{yes:true}},'text',3,null]}),null);
 assert.equal(validate({answers:Array(64).fill({})}),null);assert.ok(validate({answers:Array(65).fill({})}));
 assert.equal(validate({answers:['x'.repeat(8190)]}),null);assert.ok(validate({answers:['x'.repeat(8191)]}));
 assert.ok(validate({answers:Array(9).fill('x'.repeat(8000))}));
 const evidence={bucket:'service-evidence',path:`${customer}/AU-test/problem/1-photo.jpg`,category:'problem',name:'a.jpg',type:'image/jpeg',size:999999999};
 assert.equal(validate({evidence_files:Array(3).fill(evidence)}),null);assert.ok(validate({evidence_files:Array(4).fill(evidence)}));
 assert.ok(validate({evidence_files:[{...evidence,path:evidence.path+'x'.repeat(1024)}]}));assert.ok(validate({evidence_files:[{...evidence,name:'x'.repeat(1025)}]}));
 assert.ok(validate({evidence_files:[{...evidence,path:`${customer}/../problem/x.jpg`}]}));assert.equal(validate({form_version:'x'.repeat(120)}),null);assert.ok(validate({form_version:'x'.repeat(121)}));
});
test('E2A oversized input rejected before Auth/DB; duplicate client_order_id still 409',async()=>{
 const f=await fixture({actor:customer,insertError:{code:'23505'}});try{
  const create=(payload:any)=>f.app.inject({method:'POST',url:'/service-orders',headers:{authorization:'Bearer test-token'},payload});
  assert.equal((await create({service_category:'mechanic_service',customer_note:'x'.repeat(65537)})).statusCode,400);assert.deepEqual(f.upstream,[]);
  assert.equal((await create({service_category:'mechanic_service',client_order_id:'same'})).statusCode,409);
 }finally{await f.app.close();}
});
test('E2A multipart extra field/part and oversized file reject without upload',async()=>{
 const f=await fixture();try{
  const body=uploadBody();body.payload=Buffer.from(body.payload.toString().replace('--p2c-boundary--','--p2c-boundary\r\nContent-Disposition: form-data; name="extra"\r\n\r\nx\r\n--p2c-boundary--'));
  const r=await f.app.inject({method:'POST',url:`/service-order-assignments/${aid}/evidence/before`,...body});assert.equal(r.statusCode,400);assert.equal(f.uploads.length,0);
 }finally{await f.app.close();}
});
// These mutations run the real acceptance contracts against altered module
// exports in isolated VM contexts, without modifying source or the Git index.
for(const [name,change,contract]of [
 ['cleanup removed',(s:string)=>replaceOnce(s,'if (value.expires <= now) this.counters.delete(key);','if (false) this.counters.delete(key);'),(m:any)=>clockContract(m.Admission)],
 ['cardinality removed',(s:string)=>replaceOnce(s,'if (this.counters.size + missing > this.maxKeys) return 1;',''),(m:any)=>cardinalityContract(m.Admission)],
 ['pre-auth admission removed',(s:string)=>replaceOnce(s,'if (wait) return rejectAdmission(request, reply, kind, "process", wait);',''),(m:any)=>preAuthContract(m.installAdmission)],
 ['429 becomes 500',(s:string)=>replaceOnce(s,'reply.code(429)','reply.code(500)'),(m:any)=>preAuthContract(m.installAdmission)],
 ['Retry-After removed',(s:string)=>replaceOnce(s,'.header("Retry-After", String(retry))',''),(m:any)=>preAuthContract(m.installAdmission)],
 ['correlation broken',(s:string)=>replaceOnce(s,'request_id: request.id, retry_after_seconds: retry','request_id: "wrong", retry_after_seconds: retry'),(m:any)=>preAuthContract(m.installAdmission)],
 ['unverified bearer actor key',(s:string)=>replaceOnce(s,'const actor = (request as FastifyRequest & { user: { id: string } }).user.id;\n        if (!admitActor','const actor = String(request.headers.authorization);\n        if (!admitActor'),(m:any)=>actorContract(m.installAdmission)],
] as const)test('E2A mutation detected: '+name,async()=>{
 await contract(loadAdmission());const mutated=loadAdmission(change);await assert.rejects(async()=>contract(mutated),(e:any)=>e?.name==='AssertionError');
});

async function uploadRejectedContract(installer=installAdmission){
 const state=new Admission(()=>0),releases=[state.slot('upload','process',2)!,state.slot('upload','process',2)!];
 const f=await fixture({},state,installer);try{
  const r=await f.app.inject({method:'POST',url:`/service-order-assignments/${aid}/evidence/before`,...uploadBody()});assert429(r);
  assert.deepEqual(f.upstream,['auth']);assert.deepEqual(f.uploads,[]); // no parts(), buffer, DB or Storage
 }finally{releases.forEach(r=>r());await f.app.close();}
}
test('E2A upload global rejection precedes multipart parser and every DB/Storage call',()=>uploadRejectedContract());
function loadRoutes(change:(s:string)=>string){
 const source=change(readFileSync(new URL('../src/routes/service-orders.ts',import.meta.url),'utf8'));
 const exports:any={};const imports:any={'../diagnostics/admission.js':admissionAPI,'../diagnostics/foundation.js':foundationAPI,'../validation/service-orders.js':validationAPI,'node:crypto':{randomUUID},'../config/supabase.js':{supabase},'../middleware/auth.js':authAPI};
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,require:(name:string)=>{assert.ok(imports[name],name);return imports[name];}});return exports.serviceOrderRoutes;
}
async function resourceAuthorizationContract(routes=serviceOrderRoutes){
 const f=await fixture({assignment:{provider_id:customer}},new Admission(()=>0),installAdmission,routes);try{
  for(let i=0;i<6;i++)f.state.spend('resource:pricing',aid,[[6,60000]]);
  const r=await f.app.inject({method:'PATCH',url:`/service-order-assignments/${aid}/price-offer`,headers:{authorization:'Bearer test-token'},payload:{proposed_price:25}});assert.equal(r.statusCode,403);assert.ok(!f.calls.some(c=>c[0]==='rpc'));
 }finally{await f.app.close();}
}
test('E2A resource-before-authorization mutation detected on actual route',async()=>{
 await resourceAuthorizationContract();
 const mutated=loadRoutes(source=>{
  const line='      if (!admitResource(app, request, reply, "pricing", assignment.id)) return;';
  source=replaceOnce(source,line,'');const start=source.indexOf('"/service-order-assignments/:assignmentId/price-offer"');
  const at=source.indexOf('    if (\n      assignment.provider_id !==',start);assert.ok(at>start);return source.slice(0,at)+line+'\n'+source.slice(at);
 });await assert.rejects(()=>resourceAuthorizationContract(mutated),(e:any)=>e?.name==='AssertionError');
});
for(const [name,change,contract]of [
 ['pre-auth moved after getUser',(s:string)=>replaceOnce(replaceOnce(s,'if (wait) return rejectAdmission(request, reply, kind, "process", wait);',''),'try { await authenticate.call(this, request, reply, () => {}); }','try { await authenticate.call(this, request, reply, () => {}); const wait = state.spend("process:" + kind, "process", [[admissionPolicy.global[kind], minute]]); if (wait) return rejectAdmission(request, reply, kind, "process", wait); }'),(m:any)=>preAuthContract(m.installAdmission)],
 ['upload global slot moved after buffering',(s:string)=>replaceOnce(replaceOnce(s,'const release = state.slot(kind, "process", admissionPolicy.slots[kind]);','const release = kind === "upload" ? (() => {}) : state.slot(kind, "process", admissionPolicy.slots[kind]);'),'return await handler.call(this, request, reply);','const result = await handler.call(this, request, reply); if (kind === "upload") { const late = state.slot(kind, "process", admissionPolicy.slots[kind]); late?.(); } return result;'),(m:any)=>uploadRejectedContract(m.installAdmission)],
 ['upload release removed',(s:string)=>replaceOnce(s,'finally { actorRelease?.(); release(); }','finally { actorRelease?.(); }'),async(m:any)=>{const f=await fixture({},new Admission(()=>0),m.installAdmission);try{assert.equal((await f.app.inject({method:'POST',url:`/service-order-assignments/${aid}/evidence/before`,...uploadBody()})).statusCode,201);assert.equal(f.state.sizes.active,0);}finally{await f.app.close();}}],
 ['privacy logs actor/resource values',(s:string)=>replaceOnce(s,'scope_type: scope,','scope_type: scope, actor_id: (request as FastifyRequest & {user?:{id:string}}).user?.id, resource_id: (request.params as {assignmentId?:string})?.assignmentId,'),(m:any)=>actorPrivacyContract(m.installAdmission)],
] as const)test('E2A mutation detected: '+name,async()=>{await contract(loadAdmission());const mutated=loadAdmission(change);await assert.rejects(async()=>contract(mutated),(e:any)=>e?.name==='AssertionError');});

for(const [name,size,mime,status]of [
 ['10 MiB boundary',10*1024*1024,'image/jpeg',201],
 ['over 10 MiB',10*1024*1024+1,'image/jpeg',400],
 ['empty',0,'image/jpeg',400],
 ['unsupported MIME',10,'application/pdf',400],
] as const)test('E2A real multipart '+name,async()=>{
 const f=await fixture();try{
  const payload=Buffer.concat([Buffer.from(`--limit-boundary\r\nContent-Disposition: form-data; name="file"; filename="photo.jpg"\r\nContent-Type: ${mime}\r\n\r\n`),Buffer.alloc(size,97),Buffer.from('\r\n--limit-boundary--\r\n')]);
  const r=await f.app.inject({method:'POST',url:`/service-order-assignments/${aid}/evidence/before`,headers:{authorization:'Bearer test-token','content-type':'multipart/form-data; boundary=limit-boundary'},payload});assert.equal(r.statusCode,status);assert.equal(f.uploads.length,status===201?1:0);assert.equal(f.state.sizes.active,0);
 }finally{await f.app.close();}
});

async function actorPrivacyContract(installer=installAdmission){
 const state=new Admission(()=>0);for(let i=0;i<20;i++)state.spend('actor:pricing',provider,admissionPolicy.actor.pricing);
 const f=await fixture({},state,installer);try{
  const r=await f.app.inject({method:'PATCH',url:`/service-order-assignments/${aid}/price-offer`,headers:{authorization:'Bearer TEST_BEARER_SECRET'},payload:{proposed_price:25}});assert429(r);
  for(const secret of [provider,aid,'TEST_BEARER_SECRET'])assert.ok(!f.logs.join('').includes(secret));
 }finally{await f.app.close();}
}
