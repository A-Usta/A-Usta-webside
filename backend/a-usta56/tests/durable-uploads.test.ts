import {test} from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
process.env.SUPABASE_URL="https://example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY="local-only-fixture";
const {supabase}=await import("../src/config/supabase.js");
const {managedUpload}=await import("../src/authority/upload-reservations.js");
const {reconcileCycle}=await import("../src/authority/reconcile-uploads.js");
const {installDiagnostics,diagnosticsOptions}=await import("../src/diagnostics/foundation.js");
const actor="11111111-1111-4111-8111-111111111111",aid="22222222-2222-4222-8222-222222222222",rid="33333333-3333-4333-8333-333333333333";
const digest=createHash('sha256').update('photo').digest('hex');
const row={reservation_id:rid,actor_id:actor,assignment_id:aid,generation:0,state:'reserved',bucket:'service-evidence',path:'private/path',stage:'before',content_type:'image/jpeg',candidate_bytes:5,content_sha256:digest};
async function fixture(mode:string, handler=managedUpload){const events:string[]=[];let state={...row};let parser=0;
 (supabase as any).rpc=async(name:string,args:any)=>{
  events.push(name);
  if(mode==='unavailable')return {error:{message:'SECRET_JWT PRIVATE_PATH'},data:null};
  if(name==='austa_e2b_reserve_evidence')return {data:mode==='quota'?{code:'quota_exhausted'}:mode==='retry'?{...state,replay:true,state:'reconciling'}:state,error:null};
  if(name==='austa_e2b_begin_upload'){assert.equal(args.p_bytes,5);state={...state,state:'uploading',generation:1};return {data:state,error:null};}
  if(name==='austa_e2b_finalize_evidence'){if(mode==='db-failure')throw Error('SECRET_JWT');state={...state,state:'finalized'};return {data:state,error:null};}
  if(name==='austa_e2b_resolve_upload'){state={...state,state:'reconciling',generation:2};return {data:state,error:null};}
  if(name==='austa_e2b_release_evidence'){state={...state,state:'released'};return {data:state,error:null};}
  throw Error('Unexpected RPC');
 };
 (supabase.storage as any).from=()=>({upload:async()=>{events.push('storage');if(mode==='timeout')throw Error('SECRET_JWT');return {error:mode==='storage-reject'?{statusCode:'413'}:null};},createSignedUrl:async()=>({data:{signedUrl:'https://example.invalid/object'},error:null})});
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(mode==='mismatch'?'other':'photo');
 const app=Fastify(diagnosticsOptions);installDiagnostics(app);await app.register(multipart);
 app.addHook('onRequest',async req=>{const fn=req.parts.bind(req);req.parts=async function*(o){parser++;for await(const p of fn(o))yield p;};});
 app.post('/upload',async(req,reply)=>{await handler(req,reply,actor,aid,'before');});
 return {app,events,get state(){return state;},get parser(){return parser;},close:async()=>{globalThis.fetch=original;await app.close();}};
}
function body(invalid=false){return {headers:{'content-type':'multipart/form-data; boundary=x','idempotency-key':rid,'x-evidence-content-type':'image/jpeg'},payload:`--x\r\nContent-Disposition: form-data; name="file"; filename="x.jpg"\r\nContent-Type: ${invalid?'text/plain':'image/jpeg'}\r\n\r\nphoto\r\n--x--\r\n`};}
for(const mode of ['quota','unavailable','retry'])test('durable '+mode+' performs no buffering or write',async()=>{const f=await fixture(mode);try{const r=await f.app.inject({method:'POST',url:'/upload',...body()});assert.equal(r.statusCode,mode==='quota'?429:mode==='unavailable'?503:202);assert.equal(f.parser,0);assert.ok(!f.events.includes('storage'));assert.ok(!r.body.includes('SECRET_JWT'));assert.ok(!r.body.includes('private/path'));assert.equal(r.headers['cache-control'],'no-store');}finally{await f.close();}});
test('reservation before buffering; begin before Storage; observed bytes finalize',async()=>{const f=await fixture('success');try{const r=await f.app.inject({method:'POST',url:'/upload',...body()});assert.equal(r.statusCode,201);assert.deepEqual(f.events,['austa_e2b_reserve_evidence','austa_e2b_begin_upload','storage','austa_e2b_finalize_evidence']);assert.equal(f.parser,1);assert.equal(f.state.state,'finalized');assert.ok(!r.body.includes('private/path'));}finally{await f.close();}});
for(const mode of ['timeout','storage-reject','db-failure','mismatch'])test(mode+' remains charged and never deletes',async()=>{const f=await fixture(mode);try{const r=await f.app.inject({method:'POST',url:'/upload',...body()});assert.equal(r.statusCode,202);assert.equal(f.state.state,'reconciling');assert.ok(!f.events.includes('austa_e2b_release_evidence'));}finally{await f.close();}});
test('invalid envelope releases only never-issued reservation',async()=>{const f=await fixture('success');try{const r=await f.app.inject({method:'POST',url:'/upload',...body(true)});assert.equal(r.statusCode,400);assert.equal(f.state.state,'released');assert.ok(!f.events.includes('storage'));}finally{await f.close();}});
for(const observation of [null,{bytes:5,sha256:digest},{bytes:6,sha256:digest}])test('reconciler observation '+JSON.stringify(observation),async()=>{
 const calls:string[]=[];const io:any={now:()=>0,alert:()=>{},observe:async()=>observation,rpc:async(name:string)=>{calls.push(name);if(name==='austa_e2b_claim_reconciliation')return [{...row,state:'uploading'}];return {...row,state:'reconciling',generation:1};}};
 assert.equal(await reconcileCycle(io),1);assert.ok(!calls.includes('austa_e2b_release_evidence'));assert.equal(calls.includes('austa_e2b_finalize_evidence'),observation?.bytes===5);
});
test('reconciler maximum external concurrency two',async()=>{let active=0,max=0;const io:any={now:()=>0,alert:()=>{},rpc:async(name:string)=>name==='austa_e2b_claim_reconciliation'?Array.from({length:20},()=>({...row,state:'reconciling'})):{...row,state:'reconciling'},observe:async()=>{max=Math.max(max,++active);await new Promise(r=>setTimeout(r,1));active--;return null;}};assert.equal(await reconcileCycle(io),20);assert.equal(max,2);});

async function loadAuthorityModule(file:string,change:(s:string)=>string){
 const imports:any={"node:crypto":{createHash},"../config/supabase.js":{supabase},"../diagnostics/admission.js":await import("../src/diagnostics/admission.js"),"./durable-quotas.js":await import("../src/authority/durable-quotas.js"),"./upload-reservations.js":await import("../src/authority/upload-reservations.js")};
 const source=change(readFileSync(new URL('../src/authority/'+file,import.meta.url),'utf8')),exports:any={};
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(name:string)=>{assert.ok(imports[name],name);return imports[name];},Buffer,AbortSignal,fetch:(...args:Parameters<typeof fetch>)=>globalThis.fetch(...args),setInterval,clearInterval,setTimeout,clearTimeout,console});return exports;
}
test('E2B mutation detected: bypass reservation before Storage',async()=>{
 const contract=async(handler=managedUpload)=>{const f=await fixture('quota',handler);try{await f.app.inject({method:'POST',url:'/upload',...body()});assert.equal(f.parser,0);assert.ok(!f.events.includes('storage'));}finally{await f.close();}};
 await contract();const module=await loadAuthorityModule('upload-reservations.ts',s=>{const re=/const reserved=await authority<Upload>\("austa_e2b_reserve_evidence",\{[\s\S]*?\}\);/;assert.ok(re.test(s));return s.replace(re,'const reserved='+JSON.stringify(row)+';');});await assert.rejects(()=>contract(module.managedUpload));
});
test('E2B mutation detected: release on object absence',async()=>{
 const contract=async(fn= reconcileCycle)=>{const calls:string[]=[];await fn({now:()=>0,alert:()=>{},observe:async()=>null,rpc:async(name:string)=>{calls.push(name);return (name==='austa_e2b_claim_reconciliation'?[{...row,state:'reconciling'}]:{...row,state:'reconciling'}) as any;}});assert.ok(!calls.includes('austa_e2b_release_evidence'));};
 await contract();const module=await loadAuthorityModule('reconcile-uploads.ts',s=>{const key='const found=await bounded(io.observe(pending));';assert.ok(s.includes(key));return s.replace(key,key+'if(!found)await io.rpc("austa_e2b_release_evidence",args);');});await assert.rejects(()=>contract(module.reconcileCycle));
});

test('E2B mutation detected: client-declared bytes replace server buffer length',async()=>{
 const contract=async(handler=managedUpload)=>{const f=await fixture('success',handler);try{const r=await f.app.inject({method:'POST',url:'/upload',...body()});assert.equal(r.statusCode,201);}finally{await f.close();}};
 await contract();const module=await loadAuthorityModule('upload-reservations.ts',s=>{const from='p_bytes:buffer.length';assert.ok(s.includes(from));return s.replace(from,'p_bytes:Number(request.headers["content-length"])');});await assert.rejects(()=>contract(module.managedUpload));
});
