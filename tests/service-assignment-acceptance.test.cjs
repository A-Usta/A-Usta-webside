const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function section(source,name,next){
  const start=source.indexOf('  async function '+name+'('),end=source.indexOf('  async function '+next+'(',start);
  assert.ok(start>=0&&end>start,'unique real handler boundaries');
  return source.slice(start,end);
}
function fixture(source=html,{error,file={type:'image/jpeg',size:5}}={}){
  const calls=[],statuses=[],forms=[];
  class Multipart {constructor(){this.parts=[];forms.push(this);}append(...part){this.parts.push(part);}}
  const context={JSON,encodeURIComponent,CSS:{escape:x=>x},FormData:Multipart,
    document:{querySelector:()=>({files:file?[file]:[]})},
    apiRequest:async(...args)=>{calls.push(args);if(error)throw error;return {message:'ok',evidence:{path:'legacy/photo.jpg'}};},
    showStatus:(...args)=>statuses.push(args)};
  vm.createContext(context);
  vm.runInContext(section(source,'acceptAssignment','rejectAssignment')+section(source,'uploadEvidence','offerPrice')+';this.handlers={acceptAssignment,uploadEvidence};',context);
  return {calls,statuses,forms,file,...context.handlers};
}
test('acceptance sends exactly one PATCH accept with empty JSON and success handling',async()=>{
  const f=fixture();await f.acceptAssignment('id/with space');
  assert.equal(f.calls.length,1);const [url,options]=f.calls[0];
  assert.equal(url,'/service-order-assignments/id%2Fwith%20space/accept');
  assert.equal(options.method,'PATCH');assert.equal(options.body,'{}');assert.equal(options.headers,undefined);
  assert.equal(f.statuses.length,1);assert.match(f.statuses[0][0],/Sifariş qəbul edildi/);assert.equal(f.statuses[0][1],'success');assert.equal(f.forms.length,0);
});
test('acceptance error propagates unchanged without upload/status lookup or success',async()=>{
  const error=new Error('acceptance rejected'),f=fixture(html,{error});
  await assert.rejects(()=>f.acceptAssignment('assignment'),e=>e===error);
  assert.equal(f.calls.length,1);assert.match(f.calls[0][0],/\/accept$/);assert.equal(f.statuses.length,0);
});
for(const stage of ['before','after'])test(stage+' upload preserves one legacy multipart request and response',async()=>{
  const f=fixture();await f.uploadEvidence('assignment',stage);
  assert.equal(f.calls.length,1);const [url,options]=f.calls[0];
  assert.equal(url,'/service-order-assignments/assignment/evidence/'+stage);assert.equal(options.method,'POST');
  assert.equal(options.headers,undefined);assert.equal(options.body,f.forms[0]);
  assert.equal(f.forms.length,1);assert.equal(f.forms[0].parts.length,1);assert.equal(f.forms[0].parts[0][0],'file');assert.equal(f.forms[0].parts[0][1],f.file);
  assert.equal(f.statuses.length,1);assert.equal(f.statuses[0][1],'success');
});
test('uncertain legacy upload error is not retried or converted into durable recovery',async()=>{
  const error=new Error('response lost'),f=fixture(html,{error});
  await assert.rejects(()=>f.uploadEvidence('assignment','before'),e=>e===error);
  assert.equal(f.calls.length,1);assert.equal(f.forms.length,1);assert.equal(f.statuses.length,0);
});
for(const file of [null,{type:'text/plain',size:1},{type:'image/jpeg',size:10485761}])test('invalid upload stops before API: '+JSON.stringify(file),async()=>{
  const f=fixture(html,{file});await assert.rejects(()=>f.uploadEvidence('assignment','before'));
  assert.equal(f.calls.length,0);assert.equal(f.forms.length,0);
});
test('legacy evidence function remains byte-identical to reviewed pre-hotfix main',()=>{
  const baseline=cp.execFileSync('git',['show','d013f5076f4e5aa0bd0eb92c8a9f5f9bf16f6e9e:index.html'],{cwd:root,encoding:'utf8',maxBuffer:6e6});
  assert.equal(section(html,'uploadEvidence','offerPrice'),section(baseline,'uploadEvidence','offerPrice'));
});
test('regression proof: misplaced E2B acceptance block fails before any request',async()=>{
  const broken=cp.execFileSync('git',['show','d013f5076f4e5aa0bd0eb92c8a9f5f9bf16f6e9e:index.html'],{cwd:root,encoding:'utf8',maxBuffer:6e6});
  const f=fixture(broken);await assert.rejects(()=>f.acceptAssignment('assignment'),e=>e.name==='ReferenceError'&&/stage/.test(e.message));assert.equal(f.calls.length,0);
  assert.throws(()=>require('./helpers/e2b-baseline.cjs').normalize(broken),/exact restored acceptance contract/);
});
