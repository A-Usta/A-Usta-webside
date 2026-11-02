import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { serviceNumber, serviceOrderInputError } from "../src/validation/service-orders.js";
process.env.SUPABASE_URL="https://example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY="test-only-not-a-secret";
const {supabase}=await import("../src/config/supabase.js");
const {serviceOrderRoutes,appendEvidenceSafely}=await import("../src/routes/service-orders.js");
const customer="11111111-1111-4111-8111-111111111111",provider="22222222-2222-4222-8222-222222222222",id="33333333-3333-4333-8333-333333333333",aid="44444444-4444-4444-8444-444444444444";
const blank=(v:unknown)=>v===undefined||v===null||v==="";
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

type Scenario={acceptResult?:string;actor?:string;order?:Record<string,unknown>;assignment?:Record<string,unknown>;rpcError?:{code?:string};rpcResults?:any[];insertError?:{code:string};};
async function fixture(s:Scenario={}){
 const calls:any[]=[],uploads:string[]=[],removes:string[]=[];
 const order={id,customer_id:customer,status:'accepted',price_status:'offered',proposed_price:25,final_price:null,price_offered_at:'2026-11-02T12:00:00.123456+00:00',price_responded_at:null,evidence_files:[],...s.order};
 const assignment={id:aid,order_id:id,provider_id:provider,status:'accepted',...s.assignment};
 (supabase.auth as any).getUser=async()=>({data:{user:{id:s.actor??provider}},error:null});
 (supabase as any).from=(table:string)=>{
  let insert:any;
  const q:any={select(){return q},eq(){return q},not(){return q},in(){return q},update(){assert.fail('transition must not write via from.update')},insert(row:any){insert=row;calls.push(['insert',table,row]);return q},async single(){calls.push(['read',table]);return {data:insert?{id,...insert}:table==='service_orders'?order:table==='profiles'?{id:provider,role:'mechanic',is_active:true}:assignment,error:insert?s.insertError??null:null}},async maybeSingle(){return table==='service_order_assignments'?{data:null,error:null}:q.single()}};
  return q;
 };
 (supabase as any).rpc=async(name:string,args:any)=>{
  calls.push(['rpc',name,structuredClone(args)]);
  if(s.rpcResults?.length){const result=s.rpcResults.shift();if(result instanceof Error)throw result;return result;}
  if(s.rpcError)return {data:null,error:s.rpcError};
  if(name==='accept_service_order_assignment_atomic')return {data:[{result:s.acceptResult??'accepted',order_id:id,assignment_id:aid}],error:null};
  const next={...order,price_status:args.p_action==='offer'?'offered':args.p_action==='approve'?'confirmed':'rejected'};
  return {data:name==='austa_p2c_order_transition'?{order:{...order,status:args.p_action==='start'?'in_progress':args.p_action==='complete'?'completed':'cancelled'},assignment:{...assignment,status:args.p_action==='start'?'in_progress':'completed'}}:name==='austa_p2c_append_evidence'?order:next,error:null};
 };
 (supabase.storage as any).from=(bucket:string)=>({async upload(p:string){uploads.push(p);assert.equal(bucket,'service-evidence');return {error:null}},async remove(paths:string[]){removes.push(...paths);return {error:null}}});
 const app=Fastify();await app.register(multipart);await serviceOrderRoutes(app);await app.ready();
 return {app,calls,uploads,removes,order,assignment};
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
 function load(code:string){const output=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports:Record<string,any>={};runInNewContext(output,{exports});return exports.serviceNumber;}
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
