const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const id='11111111-1111-4111-8111-111111111111';
const reply=(body,status=200)=>({ok:status<400,status,json:async()=>body});
const offered={order_id:id,discovered_count:1,offered_count:1,skipped_count:0,assignments:[{order_id:id,status:'offered'}]};
function fixture({create=()=>reply({order:{id}},201),dispatch=()=>reply(offered),session=true,value='answer'}={}){
  const calls=[],result={innerHTML:''},button={disabled:false},target={querySelector:()=>null};
  const c={qs:[['Question','text']],name:'Usta çağır',N:String,E:s=>String(s).replace(/[<>&]/g,'_'),
    AUSTA_API_BASE:'https://isolated.invalid',FormData:class{get(){return value;}},
    o:{querySelector:s=>s.startsWith('button')?button:result},
    window:{AUSTA_SUPABASE:{auth:{getUser:async()=>({data:{user:{id:'fixture-user'}}}),getSession:async()=>({data:{session:session?{access_token:'fixture-token'}:null}})}},AUSTA_LOCATION_CORE:{getCurrentPosition:async()=>({latitude:40,longitude:49})}},
    fetch:async(url,options)=>{calls.push({url,options});return url.endsWith('/dispatch')?dispatch():create();},console:{error(){}}};
  const start=html.indexOf('async function createBackendServiceOrder('),end=html.indexOf('function openProtected(name)',start);
  const setup=html.indexOf('let submitting=false;',end),marker="o.querySelector('form').onsubmit=",a=html.indexOf(marker,setup)+marker.length,b=html.indexOf('\n};',a);
  assert.ok(start>=0&&setup>end&&b>a);vm.createContext(c);
  vm.runInContext(html.slice(start,end)+html.slice(setup,a-marker.length)+';this.submit='+html.slice(a,b+2)+';',c);
  return {calls,result,button,submit:()=>c.submit({preventDefault(){},target})};
}
test('one create followed by one authenticated bodyless dispatch of returned UUID',async()=>{
  const f=fixture();await f.submit();assert.equal(f.calls.length,2);
  assert.equal(f.calls[0].url,'https://isolated.invalid/service-orders');assert.equal(f.calls[0].options.method,'POST');
  assert.notEqual(JSON.parse(f.calls[0].options.body).client_order_id,id);
  assert.equal(f.calls[1].url,'https://isolated.invalid/service-orders/'+id+'/dispatch');
  assert.equal(f.calls[1].options.method,'POST');assert.equal(f.calls[1].options.body,undefined);
  for(const call of f.calls)assert.equal(call.options.headers.Authorization,'Bearer fixture-token');
  assert.match(f.result.innerHTML,/Sifariş yaradıldı/);assert.match(f.result.innerHTML,/Ustalara təklif göndərildi/);
  assert.doesNotMatch(f.result.innerHTML,/✓.*qəbul edildi/);
});
test('definite creation rejection prevents dispatch and reports not created',async()=>{
  const f=fixture({create:()=>reply({error:'invalid'},400)});await f.submit();assert.equal(f.calls.length,1);assert.match(f.result.innerHTML,/Sifariş yaradılmadı/);
});
test('missing session prevents both requests',async()=>{const f=fixture({session:false});await f.submit();assert.equal(f.calls.length,0);assert.match(f.result.innerHTML,/Sifariş yaradılmadı/);});
test('no providers is distinct from offers',async()=>{const f=fixture({dispatch:()=>reply({order_id:id,discovered_count:0,offered_count:0,skipped_count:0,assignments:[]})});await f.submit();assert.match(f.result.innerHTML,/Hazırda uyğun usta tapılmadı/);assert.equal(f.calls.length,2);});
for(const status of [403,409,500])test('dispatch HTTP '+status+' preserves order and warns about partial offers',async()=>{
  const f=fixture({dispatch:()=>reply({},status)});await f.submit();assert.match(f.result.innerHTML,/Sifariş yaradıldı/);assert.match(f.result.innerHTML,/xəta ilə dayandı/);assert.match(f.result.innerHTML,/Bəzi təkliflər/);assert.equal(f.calls.length,2);
});
test('network failure leaves dispatch unknown without retry',async()=>{const f=fixture({dispatch:()=>{throw Error('lost response');}});await f.submit();await f.submit();assert.equal(f.calls.length,2);assert.match(f.result.innerHTML,/nəticəsi təsdiqlənmədi/);});
for(const body of [{...offered,order_id:'other'},{...offered,offered_count:'1'},{...offered,assignments:[]},{order_id:id,discovered_count:1,offered_count:0,skipped_count:1,assignments:[]}])test('unconfirmed dispatch DTO is conservative: '+JSON.stringify(body),async()=>{
  const f=fixture({dispatch:()=>reply(body)});await f.submit();assert.match(f.result.innerHTML,/nəticəsi təsdiqlənmədi/);assert.doesNotMatch(f.result.innerHTML,/Hazırda uyğun usta tapılmadı/);
});
test('malformed dispatch JSON is unknown',async()=>{const f=fixture({dispatch:()=>({ok:true,json:async()=>{throw Error('bad JSON');}})});await f.submit();assert.match(f.result.innerHTML,/nəticəsi təsdiqlənmədi/);});
for(const create of [()=>{throw Error('lost create');},()=>reply({},201),()=>reply({},500)])test('uncertain creation never dispatches or automatically recreates: '+String(create),async()=>{
  const f=fixture({create});await f.submit();await f.submit();assert.equal(f.calls.length,1);assert.match(f.result.innerHTML,/yaradılması təsdiqlənmədi/);assert.equal(f.button.disabled,true);
});
test('concurrent and repeated submit cannot duplicate create or dispatch',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);const f=fixture({create:()=>pending});const first=f.submit();await f.submit();assert.equal(f.button.disabled,true);resolve(reply({order:{id}},201));await first;await f.submit();assert.equal(f.calls.length,2);
});
test('validation performs no requests and reenables submit',async()=>{const f=fixture({value:''});await f.submit();assert.equal(f.calls.length,0);assert.equal(f.button.disabled,false);assert.match(f.result.innerHTML,/Bütün sualları/);});
test('legacy form and F1 acceptance/evidence region stay byte-identical',()=>{
  const base=cp.execFileSync('git',['show','b36badbc5e4535975915bd0450435aa4fdb4b3d4:index.html'],{cwd:root,encoding:'utf8',maxBuffer:6e6});
  const prefix=s=>s.slice(0,s.indexOf('<script id="austa-v55-protected-service-forms">'));
  assert.equal(prefix(require('./helpers/personal-account-baseline.cjs').normalize(html)),prefix(base));
  const tail=s=>s.slice(s.indexOf('<!-- =========================================================\n     A-USTA REAL PROVIDER SERVICE ORDER FLOW'));
  assert.equal(tail(require('./helpers/personal-account-baseline.cjs').normalize(html)),tail(base));
});

test('historical normalization allows exact hotfix only; removed dispatch is detected',()=>{
  const normalize=require('./helpers/p2f1-baseline.cjs').normalize;
  const base=cp.execFileSync('git',['show','b36badbc5e4535975915bd0450435aa4fdb4b3d4:index.html'],{cwd:root,encoding:'utf8',maxBuffer:6e6});
  assert.equal(normalize(require('./helpers/personal-account-baseline.cjs').normalize(html)),base);
  assert.throws(()=>normalize(html.replace('const dispatchOutcome=await dispatchProtectedServiceOrder(backendResult.order.id);',"const dispatchOutcome='none';")),/exact P2.F1 protected-form scope/);
});
