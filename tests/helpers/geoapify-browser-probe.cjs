'use strict';
/* TEST ONLY: no live dispatch implementation. All browser traffic is fulfilled or
 * rejected before dispatch, with a deny-only loopback egress fuse underneath.
 * keyProvider supplies a runtime string; callers must clear their own copies.
 * No CLI key, storage state, screenshots, HAR, traces, console or raw URL logs.
 * Manual dashboard reconciliation is a separate, UNAPPROVED policy option.
 * It never substitutes for the unchanged automatic <=10-second usage gate.
 * JS strings cannot be forensically zeroed: clear references and close context.
 */
const http=require('node:http');
const {randomUUID}=require('node:crypto');
const {spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
async function deadline(work,ms=2000){let timer;try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>{const e=Error('Deadline');e.name='TimeoutError';reject(e);},ms);})]);}finally{clearTimeout(timer);}}
const {fixture}=require('./automotive-map-fixture.cjs');
const BASE='https://a-usta.github.io/A-Usta-webside/';
const ORIGIN='https://a-usta.github.io',REFERER=ORIGIN+'/';
const ENDPOINT='/v1/geocode/search';
const validKey=k=>typeof k==='string'&&/^[A-Za-z0-9_-]{20,100}$/.test(k)&&!/^sb_(secret|publishable)/.test(k);
const lower=headers=>Object.fromEntries(Object.entries(headers||{}).map(([k,v])=>[k.toLowerCase(),String(v)]));

// Local reader contract only; no provider format or accounting API is assumed.
// Exact decimal scale18, range0..10^12, exponent[-18,18], <=32 significand digits.
const REFLECTION_CLOCK='austa-probe-epoch-ms/v1';
const CREDIT_SCALE=10n**18n,MAX_CREDIT_UNITS=10n**12n*CREDIT_SCALE,BUDGET_UNITS=2n*CREDIT_SCALE;
function creditUnits(input){
 const numeric=typeof input==='number';
 if(!numeric&&typeof input!=='string')throw Error('Unsupported accounting value');
 if(numeric&&(!Number.isFinite(input)||input<0||Object.is(input,-0)||(Number.isInteger(input)&&!Number.isSafeInteger(input))))throw Error('Unsafe accounting number');
 const text=numeric?String(input):input;
 if(text.length>64)throw Error('Unsupported accounting precision');
 const match=/^(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?(?:0|[1-9]\d*)))?$/.exec(text);
 if(!match||match[0]!==text)throw Error('Unsupported accounting representation');
 const fraction=match[2]||'',digits=match[1]+fraction,exponent=Number(match[3]||0),scale=fraction.length-exponent;
 if(digits.length>32||!Number.isSafeInteger(exponent)||Math.abs(exponent)>18||scale>18)throw Error('Unsupported accounting precision');
 const units=BigInt(digits)*10n**BigInt(18-scale);
 if(units>MAX_CREDIT_UNITS)throw Error('Accounting range exceeded');
 if(numeric&&input!==0){
  // Verify the primitive's IEEE-754 rational, not a rounded decimal rendering.
  const bytes=new DataView(new ArrayBuffer(8));bytes.setFloat64(0,input);
  const bits=bytes.getBigUint64(0),field=Number((bits>>52n)&2047n),fractionBits=bits&((1n<<52n)-1n);
  const mantissa=field?(1n<<52n)|fractionBits:fractionBits,power=field?field-1023-52:-1074;
  if(power<0?(units<<BigInt(-power))!==mantissa*CREDIT_SCALE:units!==(mantissa<<BigInt(power))*CREDIT_SCALE)throw Error('Inexact accounting number');
 }
 return units;
}
function displayCredits(units){
 if(units===null)return null;
 const whole=units/CREDIT_SCALE,remainder=units%CREDIT_SCALE;
 return remainder===0n?Number(whole):String(whole)+'.'+String(remainder).padStart(18,'0').replace(/0+$/,'');
}

function createNetworkGate({runtimeKey,readUsage,restrictionsVerified=false,signal,reflectionVerifier,now=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 if(!validKey(runtimeKey))throw Error('Invalid runtime browser key');
 let secret=runtimeKey,closed=false,terminal=false,get=0,options=0,attempted=0,lane=Promise.resolve();
 const events=[],ledger=[];let latest=null,initialUnits=null,measurementSequence=0,requestCount=0,last=-Infinity,checkedProjection=null,boundContract=null;
 const evidenceBindings=new Map(),runId=randomUUID();
 const fresh=(value,time=now())=>Boolean(value&&value.authoritative===true&&value.uncertain!==true&&Number.isSafeInteger(value.observedAt)&&value.observedAt>=0&&Number.isSafeInteger(time)&&time>=value.observedAt&&time-value.observedAt<=10000);
 // Verification is a separately trusted adapter, never a field in a reading.
 // No real provider adapter is supplied by the offline browser/IPC runner.
 async function reflectionProof(measurement,units,observedAt,claims){
  if(!claims.length)return {ids:[],uncertain:false};
  if(typeof reflectionVerifier!=='function')return {ids:[],uncertain:true};
  try{
   const dispatches=Object.freeze(claims.map(id=>{const row=ledger.find(item=>item.id===id);return Object.freeze({id,costUnits:String(CREDIT_SCALE),dispatchedAt:row.dispatchedAt,clockDomain:row.clockDomain});}));
   const context=Object.freeze({runId,measurement,creditsUnits:String(units),observedAt,claimedDispatches:Object.freeze([...claims]),dispatches});
   const proof=await deadline(()=>reflectionVerifier(context));
   const validToken=v=>typeof v==='string'&&v.length>=1&&v.length<=96&&!/[^A-Za-z0-9_.:/-]/.test(v);
   if(!proof||proof.runId!==runId||proof.trusted!==true||proof.clockDomainVerified!==true||proof.clockDomain!==REFLECTION_CLOCK||!validToken(proof.contractId)||!validToken(proof.evidenceId)||proof.creditsUnits!==String(units)||proof.observedAt!==observedAt||!Number.isSafeInteger(proof.coveredThrough)||proof.coveredThrough<0||proof.coveredThrough>observedAt)throw Error('Unproven reflection');
   if(!Array.isArray(proof.includedDispatches)||proof.includedDispatches.length!==claims.length||new Set(proof.includedDispatches).size!==claims.length||proof.includedDispatches.some(id=>!Number.isInteger(id)||!claims.includes(id)))throw Error('Unproven identity');
   if(dispatches.some(row=>row.clockDomain!==REFLECTION_CLOCK||!Number.isSafeInteger(row.dispatchedAt)||row.dispatchedAt<0||proof.coveredThrough<=row.dispatchedAt))throw Error('Unproven temporal coverage');
   const contract=proof.contractId+'|'+proof.clockDomain;
   if(boundContract!==null&&boundContract!==contract)throw Error('Contract changed');
   const fingerprint=JSON.stringify([runId,contract,String(units),observedAt,proof.coveredThrough,[...claims].sort((a,b)=>a-b)]);
   if(evidenceBindings.has(proof.evidenceId)&&evidenceBindings.get(proof.evidenceId)!==fingerprint)throw Error('Evidence reused');
   boundContract=contract;evidenceBindings.set(proof.evidenceId,fingerprint);
   return {ids:[...claims],uncertain:false};
  }catch{return {ids:[],uncertain:true};}
 }
 const usage=typeof readUsage==='function'?async()=>{
  const value=await deadline(readUsage);
  if(!fresh(value))throw Error('Accounting unavailable');
  const units=creditUnits(value.credits),observedAt=value.observedAt;
  if(latest&&(units<latest.units||observedAt<latest.observedAt))throw Error('Accounting regression');
  const reported=value.accountedDispatches;
  if(reported!==undefined&&!Array.isArray(reported))throw Error('Unproven attribution');
  const reflected=reported===undefined?undefined:Object.freeze([...reported]);
  if(reflected!==undefined&&(!Array.isArray(reflected)||new Set(reflected).size!==reflected.length||reflected.some(id=>!Number.isInteger(id)||!ledger.some(row=>row.id===id&&row.state==='dispatched'))))throw Error('Unproven attribution');
  if(latest?.accountedDispatches?.some(id=>!reflected?.includes(id)))throw Error('Attribution regression');
  if(initialUnits===null)initialUnits=units;
  if((reflected||[]).reduce((sum,id)=>sum+BigInt(ledger.find(row=>row.id===id).cost)*CREDIT_SCALE,0n)>units-initialUnits)throw Error('Unproven attribution');
  const verified=await reflectionProof(value,units,observedAt,reflected||[]);
  const ambiguous=units>initialUnits&&ledger.some(row=>row.state==='dispatched')&&reflected===undefined;
  latest=Object.freeze({units,observedAt,authoritative:true,sequence:++measurementSequence,accountedDispatches:Object.freeze(verified.ids),reflectionUncertain:verified.uncertain||ambiguous});
  return latest;
 }:undefined;
 // Aggregate credits alone cannot prove which dispatched requests are reflected.
 // Optional accountedDispatches must be a complete authoritative attribution set,
 // not an inference from counters or local estimates. No provider reader exists here.
 function projectedCost(time=now()){
  if(!fresh(latest,time)||latest.units<initialUnits)return null;
  const measured=latest.units-initialUnits;
  const reflected=new Set(latest.accountedDispatches||[]);
  return measured+ledger.reduce((sum,row)=>sum+(row.state==='reserved'||!reflected.has(row.id)?BigInt(row.cost)*CREDIT_SCALE:0n),0n);
 }
 const withinBudget=(proposed=0n,time=now())=>{const total=projectedCost(time);checkedProjection=total===null?null:total+proposed;return checkedProjection!==null&&!latest.reflectionUncertain&&checkedProjection<=BUDGET_UNITS;};
 function deny(method,reason){terminal=true;const row={method:['GET','OPTIONS','POST','PUT','PATCH','DELETE','HEAD'].includes(method)?method:'OTHER',kind:'blocked',allowed:false,reason};events.push(row);return {allowed:false,reason};}
 async function check(request){
  attempted++;const method=request?.method;
  if(closed||terminal)return deny(method,'closed');
  if(signal?.aborted)return deny(method,'cancelled');
  if(get+options>=2)return deny(method,'http-budget');
  let u;try{u=new URL(request.url);}catch{return deny(method,'invalid-target');}
  if(u.protocol!=='https:'||u.hostname!=='api.geoapify.com'||u.port||u.username||u.password)return deny(method,'unexpected-host');
  if(u.pathname!==ENDPOINT||u.hash)return deny(method,'unexpected-endpoint');
  if(request.redirected)return deny(method,'redirect');
  if(!['GET','OPTIONS'].includes(method))return deny(method,'unexpected-method');
  const allowed=['text','filter','limit','lang','apiKey'];
  if([...u.searchParams.keys()].some(k=>!allowed.includes(k)||u.searchParams.getAll(k).length!==1)||u.searchParams.get('text')!=='Bakı'||u.searchParams.get('filter')!=='countrycode:az'||u.searchParams.get('limit')!=='5'||u.searchParams.get('lang')!=='az'||u.searchParams.get('apiKey')!==secret)return deny(method,'query-contract');
  const headers=lower(request.headers);
  if(headers.origin!==ORIGIN||headers.referer!==REFERER||headers.authorization||headers.cookie||headers['x-api-key'])return deny(method,'origin-or-credentials');
  if(method==='GET'&&get)return deny(method,'duplicate-get');
  if(method==='OPTIONS'&&(options||get||headers['access-control-request-method']!=='GET'))return deny(method,'preflight-contract');
  // No caller may smuggle a redirect/retry through the unused OPTIONS slot.
  let reservation;
  try{if(!restrictionsVerified||typeof usage!=='function'||requestCount>=2)throw Error('Accounting unavailable');await usage();if(!withinBudget(CREDIT_SCALE))throw Error('Budget exhausted');const pause=Math.max(0,last+1000-now());if(pause)await wait(pause);last=now();requestCount++;reservation={id:ledger.length+1,cost:1,state:'reserved'};ledger.push(reservation);await usage();if(!withinBudget())throw Error('Accounting unavailable');}catch{return deny(method,'credit-or-freshness');}
  if(signal?.aborted||closed)return deny(method,'cancelled');
  if(method==='GET')get++;else options++;
  const row={method,reservationId:reservation.id,kind:'geocoding',allowed:true,host:'api.geoapify.com',path:ENDPOINT,status:null};events.push(row);
  return {allowed:true,index:events.length-1};
 }
 return Object.freeze({
  authorize(request){const next=lane.then(()=>check(request));lane=next.catch(()=>{});return next;},
  dispatch(index){const time=now();if(closed||terminal||signal?.aborted||!events[index]?.allowed||events[index].dispatched||!withinBudget(0n,time))return deny(events[index]?.method,'dispatch-denied');const row=ledger.find(row=>row.id===events[index].reservationId);row.state='dispatched';row.dispatchedAfter=latest.sequence;row.dispatchedAt=time;row.clockDomain=REFLECTION_CLOCK;events[index].dispatched=true;return {allowed:true};},
  response(index,status){if(events[index]?.allowed&&Number.isInteger(status)&&status>=100&&status<=599)events[index].status=status;},
  snapshot(){return {runId,attempted,admitted:get+options,get,options,reservedCredits:requestCount,ledger:ledger.map(row=>({...row})),projectedCredits:displayCredits(projectedCost()),checkedProjectedCredits:displayCredits(checkedProjection),reflectionUncertain:latest?.reflectionUncertain===true,stopped:terminal||closed,events:events.map(x=>({...x}))};},
  destroy(){closed=true;secret='';reflectionVerifier=undefined;evidenceBindings.clear();}
 });
}

async function denyEgress(){
 let attempts=0;
 const server=http.createServer((_req,res)=>{attempts++;res.writeHead(403,{'Connection':'close'});res.end();});
 server.on('connect',(_req,socket)=>{attempts++;socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {address:'http://127.0.0.1:'+server.address().port,attempts:()=>attempts,close:async()=>{server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}};
}
const defaults=()=>({mode:'offline-synthetic',status:'BLOCKED',reason:'not-started',httpStatus:null,corsAccepted:false,parsed:false,rows:0,selectedArea:false,providerCreditUsage:null,providerRequests:0,realNetworkForwarding:false,credentialsDisposed:false});
function emptyNetwork(){return {attempted:0,admitted:0,get:0,options:0,reservedCredits:0,stopped:true,events:[]};}

async function runOfflineWorker({keyProvider,readUsage,restrictionsVerified=false,signal,scenario='success',manualReconciliation=false,mode='offline',cleanupMs=750}={}){
 let key='',browser,context,page,session,fuse,gate,closing=false,uncertain=false;
 const report=defaults(),routes=[];report.phase='preflight';
 try{
  if(mode!=='offline'){report.reason='live-not-authorized';return report;}
  if(manualReconciliation){report.reason='manual-policy-not-approved';return report;}
  if(process.env.DEBUG||process.env.PWDEBUG||process.env.NODE_DEBUG){report.reason='debug-logging-enabled';return report;}
  if(signal?.aborted){report.reason='cancelled';return report;}
  if(!restrictionsVerified||typeof readUsage!=='function'){report.reason='restriction-or-credit-reader-missing';return report;}
  if(typeof keyProvider!=='function'){report.reason='runtime-key-missing';return report;}
  key=await keyProvider();
  if(!validKey(key)){report.reason='runtime-key-invalid';return report;}
  gate=createNetworkGate({runtimeKey:key,readUsage,restrictionsVerified,signal});
  fuse=await denyEgress();
  const {chromium}=require('playwright');
  const env={};for(const name of ['PATH','HOME','TMPDIR','TEMP','TMP','LANG','LC_ALL','LD_LIBRARY_PATH','DISPLAY'])if(process.env[name])env[name]=process.env[name];
  browser=await chromium.launch({headless:true,dumpio:false,env,args:['--no-sandbox','--disable-quic','--disable-background-networking','--proxy-server='+fuse.address,'--proxy-bypass-list=<-loopback>']});
  context=await browser.newContext({serviceWorkers:'block'});
  page=await context.newPage();session=await context.newCDPSession(page);
  await session.send('Network.enable');await session.send('Network.setCacheDisabled',{cacheDisabled:true});
  const fulfil=async(id,options={})=>{
   let body=options.body||'',headers={...(options.headers||{})};
   if(options.json!==undefined){body=JSON.stringify(options.json);headers['Content-Type']='application/json';}
   if(options.contentType)headers['Content-Type']=options.contentType;
   await session.send('Fetch.fulfillRequest',{requestId:id,responseCode:options.status||200,responseHeaders:Object.entries(headers).map(([name,value])=>({name,value:String(value)})),body:Buffer.from(body).toString('base64')});
  };
  session.on('Fetch.requestPaused',async event=>{
   try{
    const u=new URL(event.request.url);
    if(u.origin===ORIGIN&&u.pathname.startsWith('/A-Usta-webside/')&&!u.search&&!u.hash&&!u.username&&!u.password&&event.request.method==='GET'&&!event.redirectedRequestId){
     const route=routes.find(r=>event.request.url.startsWith(r.prefix));
     if(route){await route.handler({request:()=>({url:()=>event.request.url}),fulfill:options=>fulfil(event.requestId,options)});return;}
    }
    const decision=await gate.authorize({url:event.request.url,method:event.request.method,headers:event.request.headers,redirected:Boolean(event.redirectedRequestId)});
    if(!decision.allowed){await session.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
    if(!gate.dispatch(decision.index).allowed){await session.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});return;}
    const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET','Access-Control-Allow-Headers':'x-offline-probe','Access-Control-Max-Age':'0'};
    if(event.request.method==='OPTIONS'){gate.response(decision.index,204);await fulfil(event.requestId,{status:204,headers:cors});return;}
    if(scenario==='network-failure'){await session.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'Failed'});return;}
    const status=scenario==='http-error'?401:scenario==='redirect'?302:200;
    gate.response(decision.index,status);
    if(scenario==='redirect'){await fulfil(event.requestId,{status,headers:{...cors,Location:'https://unexpected.invalid/'}});return;}
    const json=scenario==='http-error'?{message:'Synthetic private error; must not be reflected'}:{features:[{properties:{country_code:'az',formatted:'Synthetic Bakı',city:'Bakı'},geometry:{coordinates:[49.8671,40.4093]}}]};
    await fulfil(event.requestId,{status,headers:cors,json});
   }catch{if(!closing)uncertain=true;try{await session.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});}catch{/* Closing target, never log raw protocol error. */}}
  });
  await session.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  const routing={route:async(pattern,handler)=>{if(pattern!==BASE+'**')throw Error('Unexpected fixture route');routes.push({prefix:BASE,handler});}};
  // Isolate the existing geocoding probe: its deny-only gate must not authorize automatic tiles/Places.
  report.phase='fixture';await fixture(page,false,false,{base:BASE,routing,externalMocks:false,runtimeKey:key,isolated:true,includeConfig:true,beforeModules:scenario==='preflight'?async p=>p.evaluate(()=>{const native=window.fetch;window.fetch=(url,options)=>native(url,{...options,headers:{...options?.headers,'x-offline-probe':'1'}});}):undefined});
  if(signal?.aborted){report.reason='cancelled';return report;}
  await page.evaluate(value=>{window.AUSTA_MAP_SETTINGS=Object.freeze({geoapifyBrowserKey:value});},key);
  report.phase='geocode-input';await page.getByLabel('Şəhər / rayon / qəsəbə / kənd',{exact:true}).fill('Bakı');
  report.phase='geocode-request';await page.getByRole('button',{name:'Ərazini tap',exact:true}).click();
  report.phase='geocode-completion';await page.waitForFunction(()=>Boolean(document.querySelector('.am-geocode button'))||!document.querySelector('.am-status').textContent.includes('Ərazi axtarılır'),{},{timeout:10000});
  report.phase='geocode-parse';report.rows=await page.locator('.am-geocode button').count();
  const empty=await page.locator('.am-status').evaluate(n=>n.textContent==='Ərazi tapılmadı.');
  report.parsed=report.rows>0||empty;
  if(report.rows){report.phase='geocode-selection';await page.locator('.am-geocode button').first().click();report.selectedArea=await page.locator('.am-status').evaluate(n=>n.textContent.includes('məntəqələr yenilənir'));}
  const snapshot=gate.snapshot();report.httpStatus=snapshot.events.find(r=>r.method==='GET'&&r.allowed)?.status??null;
  report.corsAccepted=report.httpStatus===200&&report.parsed;
  report.status=report.corsAccepted&&!snapshot.events.some(r=>!r.allowed)&&!uncertain&&!fuse.attempts()?'PASS':'BLOCKED';
  report.phase='complete';report.reason=report.status==='PASS'?'synthetic-only-pass':uncertain||fuse.attempts()?'network-accounting-uncertain':snapshot.events.find(r=>!r.allowed)?.reason||'synthetic-request-failed';
 }catch(error){report.status='BLOCKED';report.reason=signal?.aborted?'cancelled':'runner-or-transport-failure';report.failureType=error?.name==='TimeoutError'?'TimeoutError':'Error';}
 finally{
  closing=true;
  // Synthetic faults never affect production code or enable network forwarding.
  if(['hang-context','hang-both'].includes(scenario)&&context)context.close=()=>new Promise(()=>{});
  if(['hang-browser','hang-both','survival'].includes(scenario)&&browser)browser.close=()=>new Promise(()=>{});
  // Preserve the pre-cleanup outcome using only fixed enums, never raw errors.
  if(report.status==='BLOCKED')report.primaryFailure={reason:report.reason,phase:report.phase,type:report.failureType||null};
  const cleanup={contextAttempted:false,contextClosed:false,browserAttempted:false,browserClosed:false,failures:[]};
  report.cleanup=cleanup;
  const failed=(stage,error)=>cleanup.failures.push({stage,type:error?.name==='TimeoutError'?'TimeoutError':'Error'});
  try{
   report.network=gate?.snapshot()||emptyNetwork();report.egressFuseDenials=fuse?.attempts()||0;
  }catch(error){failed('network-snapshot',error);}
  // Clear owned references even if a preceding cleanup operation fails.
  try{gate?.destroy();}catch(error){failed('gate-disposal',error);}finally{key='';report.credentialReferencesDisposed=true;}
  try{if(page&&!page.isClosed())await deadline(()=>page.evaluate(()=>{window.AUSTA_AUTOMOTIVE_MAP?.close();window.AUSTA_MAP_DATA?.clear();delete window.AUSTA_MAP_SETTINGS;}),cleanupMs);}catch(error){failed('page-reset',error);}
  try{
   if(context){cleanup.contextAttempted=true;await deadline(()=>context.close(),cleanupMs);cleanup.contextClosed=true;}
  }catch(error){failed('context-close',error);}
  finally{
   // An independent attempt is mandatory even when context.close() throws.
   try{if(browser){cleanup.browserAttempted=true;await deadline(()=>browser.close(),cleanupMs);cleanup.browserClosed=true;}}
   catch(error){failed('browser-close',error);}
   finally{try{await deadline(()=>fuse?.close(),cleanupMs);}catch(error){failed('egress-close',error);}}
  }
  report.credentialsDisposed=report.credentialReferencesDisposed&&(!browser||cleanup.browserClosed);
  if(cleanup.failures.length||uncertain||report.egressFuseDenials){report.status='BLOCKED';report.reason='cleanup-or-accounting-uncertain';}

 }
 return report;
}

/* New Linux-only lifecycle broker. Its only child is the disposable worker.
 * Subreaper adoption keeps double-fork/setsid descendants inside the ownership
 * tree. No process-name matching, numeric-PID kill, shell, or persisted key.
 * /proc verifies ancestry and birth before/after pidfd_open; the pinned kernel
 * handle, not a later lookup of the PID, is used for signals and exit polling.
 */
const brokerProgram=String.raw`
import os,sys,json,time,signal,select,selectors,ctypes,subprocess
records=[]; latest={}; faults=[]
def fail(code):
 if code not in faults:faults.append(code)
def stat(pid):
 fields=open('/proc/%d/stat'%pid).read().rsplit(')',1)[1].split()
 return int(fields[1]),int(fields[19])
def ours(pid):
 seen=set()
 while pid!=os.getpid():
  if pid<=1 or pid in seen:return False
  seen.add(pid);pid=stat(pid)[0]
 return True
def dead(record):
 poll=select.poll();poll.register(record['fd'],select.POLLIN)
 return bool(poll.poll(0))
def pin(pid):
 try:
  before=stat(pid)
  if not ours(pid):fail('ownership');return
  prior=latest.get(pid)
  if prior and prior['birth']==before[1]:return
  if prior and not dead(prior):fail('identity');return
  fd=os.pidfd_open(pid,0)
  try:
   after=stat(pid)
   if before[1]!=after[1] or not ours(pid):fail('identity');os.close(fd);return
   record={'fd':fd,'birth':after[1]};records.append(record);latest[pid]=record
  except BaseException:os.close(fd);raise
 except (FileNotFoundError,ProcessLookupError):pass
 except BaseException:fail('inspection')
def census():
 parents={}
 try:
  for item in os.listdir('/proc'):
   if item.isdigit():
    try:parents[int(item)]=stat(int(item))[0]
    except (FileNotFoundError,ProcessLookupError):pass
    except BaseException:fail('inspection')
 except BaseException:fail('inspection')
 found={os.getpid()};pending=True
 while pending:
  pending=False
  for pid,parent in parents.items():
   if parent in found and pid not in found:found.add(pid);pending=True
 found.discard(os.getpid())
 for pid in found:pin(pid)
 return found
def send_signal(record,value):
 try:
  if not dead(record):signal.pidfd_send_signal(record['fd'],value,None,0)
 except ProcessLookupError:pass
 except BaseException:fail('signal')
def reap():
 while True:
  try:
   if os.waitpid(-1,os.WNOHANG)[0]==0:return
  except ChildProcessError:return
  except BaseException:fail('reap');return
def terminate():
 end=time.monotonic()+1.5;stable=0;count=-1
 while stable<2 and time.monotonic()<end:
  census()
  for record in records:send_signal(record,signal.SIGSTOP)
  stable=stable+1 if count==len(records) else 0;count=len(records);time.sleep(.01)
 while time.monotonic()<end:
  census()
  for record in records:send_signal(record,signal.SIGKILL)
  reap()
  try:
   children=census();remaining=sum(not dead(record) for record in records)
   if not children and not remaining:return {'confirmed':not faults,'workerExited':True,'remaining':0,'tracked':len(records),'faults':faults}
  except BaseException:fail('confirmation')
  time.sleep(.01)
 fail('timeout')
 return {'confirmed':False,'workerExited':False,'remaining':None,'tracked':len(records),'faults':faults}
def emit(message):
 sys.stdout.write(json.dumps(message,separators=(',',':'))+'\n');sys.stdout.flush()
def main():
 if not sys.platform.startswith('linux') or not hasattr(os,'pidfd_open') or not hasattr(signal,'pidfd_send_signal'):emit({'type':'unsupported'});return
 libc=ctypes.CDLL(None,use_errno=True)
 if libc.prctl(36,1,0,0,0)!=0:emit({'type':'unsupported'});return
 fd=os.pidfd_open(os.getpid(),0);signal.pidfd_send_signal(fd,0,None,0);os.close(fd)
 worker=subprocess.Popen([sys.argv[1],sys.argv[2],'--disposable-worker'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env=os.environ,start_new_session=True)
 # A direct, unreaped child cannot be PID-reused. Pin before inspection.
 root={'fd':os.pidfd_open(worker.pid,0),'birth':None};records.append(root);latest[worker.pid]=root
 try:root['birth']=stat(worker.pid)[1]
 except BaseException:fail('inspection')
 selector=selectors.DefaultSelector();selector.register(sys.stdin.buffer,selectors.EVENT_READ,'parent');selector.register(worker.stdout,selectors.EVENT_READ,'worker')
 buffers={'parent':b'','worker':b''};cause=None;done=False;scenario=None;diagnostic={};end=time.monotonic()+int(sys.argv[3])/1000
 try:
  census()
  if faults:cause='inspection';return
  emit({'type':'ready'})
  while not done:
   census();reap()
   if faults:cause='inspection';break
   if time.monotonic()>=end:cause='deadline';break
   for event,_ in selector.select(.01):
    who=event.data;chunk=os.read(event.fileobj.fileno(),65536)
    if not chunk:cause='channel-closed';done=True;break
    buffers[who]+=chunk
    if len(buffers[who])>65536:raise ValueError()
    while b'\n' in buffers[who]:
     line,buffers[who]=buffers[who].split(b'\n',1);message=json.loads(line)
     if who=='parent':
      if message.get('type')=='stop':cause='cancelled';done=True;break
      if message.get('type')=='start':scenario=message.get('scenario')
      worker.stdin.write(json.dumps(message,separators=(',',':')).encode()+b'\n');worker.stdin.flush()
     else:
      if message.get('type')=='result':
       census()
       if scenario=='survival':
        browsers=[r for r in records if r is not root and not dead(r)]
        for record in browsers:send_signal(record,signal.SIGSTOP)
        send_signal(root,signal.SIGKILL);time.sleep(.03);reap()
        diagnostic={'stoppedBrowsers':sum(not dead(r) for r in browsers),'workerGoneBeforeCleanup':dead(root)}
       emit(message);done=True;break
      if message.get('type')!='usage':raise ValueError()
      emit(message)
 except BaseException:cause='protocol'
 finally:
  summary=terminate();summary.update(diagnostic);selector.close();emit({'type':'final','summary':summary,'cause':cause})
  for record in records:os.close(record['fd'])
if __name__=='__main__':
 try:main()
 except BaseException:
  try:emit({'type':'final','summary':terminate(),'cause':'broker-failure'})
  except BaseException:pass
`;

// All controller I/O failures enter the same sticky state. EOF asks the separate
// broker to clean its descendants. Neither EOF nor worker exit is an attestation.
async function runOfflineProbe({keyProvider,readUsage,restrictionsVerified=false,signal,scenario='success',mode='offline',manualReconciliation=false,timeoutMs=20000,cleanupMs=750}={}){
 const blocked=reason=>({...defaults(),reason,network:emptyNetwork(),credentialReferencesDisposed:true});
 if(mode!=='offline')return blocked('live-not-authorized');
 if(manualReconciliation)return blocked('manual-policy-not-approved');
 if(process.env.DEBUG||process.env.PWDEBUG||process.env.NODE_DEBUG)return blocked('debug-logging-enabled');
 if(signal?.aborted)return blocked('cancelled');
 if(!restrictionsVerified||typeof readUsage!=='function')return blocked('restriction-or-credit-reader-missing');
 if(typeof keyProvider!=='function')return blocked('runtime-key-missing');
 if(process.platform!=='linux'||!Number.isInteger(timeoutMs)||timeoutMs<250||timeoutMs>45000||!Number.isInteger(cleanupMs)||cleanupMs<50||cleanupMs>2000)return blocked('unsupported-policy');
 if(!['success','preflight','http-error','network-failure','redirect','hang-context','hang-browser','hang-both','hang-worker','survival'].includes(scenario))return blocked('unsupported-policy');
 let key='';try{key=await deadline(keyProvider);}catch{return blocked('runtime-key-unavailable');}
 if(!validKey(key)){key='';return blocked('runtime-key-invalid');}
 return new Promise(resolve=>{
  let broker,reader,result,summary,reason=null,failure=null,done=false,closed=false,started=false,watchdog,fallback,grace;
  const env={};for(const name of ['PATH','HOME','TMPDIR','TEMP','TMP','LANG','LC_ALL','LD_LIBRARY_PATH','DISPLAY','NODE_PATH','PLAYWRIGHT_BROWSERS_PATH'])if(process.env[name])env[name]=process.env[name];
  const finish=()=>{
   if(done)return;done=true;key='';clearTimeout(watchdog);clearTimeout(fallback);clearTimeout(grace);signal?.removeEventListener('abort',cancel);
   try{reader?.close();}catch{failure=failure||'reader-disposal';}
   try{broker?.stdin.end();}catch{failure=failure||'input-disposal';}
   const confirmed=closed&&summary?.confirmed===true&&summary?.workerExited===true&&summary?.remaining===0;
   const report=result||blocked(reason||'worker-failure');report.supervisor={terminationConfirmed:confirmed,workerExited:summary?.workerExited===true,tracked:summary?.tracked||0,remaining:summary?.remaining??null,faults:summary?.faults||[],stoppedBrowsers:summary?.stoppedBrowsers||0,workerGoneBeforeCleanup:summary?.workerGoneBeforeCleanup===true};
   report.credentialReferencesDisposed=confirmed;
   if(failure)report.controlChannel={failed:true,stage:failure};
   if(failure||reason||!confirmed){report.status='BLOCKED';report.reason=!confirmed?'termination-unconfirmed':failure?'control-channel-failure':reason;}
   if(!confirmed)report.credentialsDisposed=false;
   if(!closed){broker?.unref();broker?.stdout.destroy();}
   resolve(report);
  };
  const fail=stage=>{
   if(done||failure)return;failure=stage;key='';
   try{broker?.stdin.destroy();}catch{/* Confirmation remains mandatory. */}
   fallback=setTimeout(finish,2000);
  };
  const send=value=>{
   if(done||failure)return;
   try{if(!broker?.stdin.writable||broker.stdin.destroyed||broker.stdin.writableEnded){fail('input-unavailable');return;}broker.stdin.write(JSON.stringify(value)+'\n',error=>{if(error)fail('write-callback');});}
   catch{fail('write-throw');}
  };
  const premature=stage=>{if(!done&&!summary&&!grace)grace=setTimeout(()=>{if(!done&&!summary)fail(stage);},25);};
  const cancel=()=>{if(!done){reason=reason||'cancelled';send({type:'stop'});}};
  try{
   broker=spawn('python3',['-u','-c',brokerProgram,process.execPath,__filename,String(timeoutMs)],{env,stdio:['pipe','pipe','ignore']});
   broker.stdin.on('error',()=>fail('input-error'));broker.stdin.on('close',()=>premature('input-close'));
   broker.stdout.on('error',()=>fail('output-error'));broker.stdout.on('end',()=>premature('output-end'));broker.stdout.on('close',()=>premature('output-close'));
   reader=createInterface({input:broker.stdout});reader.on('error',()=>fail('reader-error'));reader.on('close',()=>premature('reader-close'));
   reader.on('line',async line=>{
    if(done)return;
    let message;try{message=JSON.parse(line);}catch{fail('protocol');return;}
    if(!message||typeof message!=='object'||Array.isArray(message)){fail('protocol');return;}
    if(message.type==='ready'){
     if(started){fail('duplicate-ready');return;}started=true;send({type:'start',key,scenario,cleanupMs});key='';
    }else if(message.type==='usage'&&Number.isInteger(message.id)){
     if(failure)return;
     try{const v=await deadline(readUsage);send({type:'usage-result',id:message.id,value:v&&{credits:v.credits,observedAt:v.observedAt,authoritative:v.authoritative===true,uncertain:v.uncertain===true,accountedDispatches:v.accountedDispatches}});}
     catch{send({type:'usage-result',id:message.id,value:null});}
    }else if(message.type==='result'&&message.report?.mode==='offline-synthetic')result=message.report;
    else if(message.type==='final'){if(summary){fail('duplicate-final');return;}summary=message.summary;reason=reason||message.cause;}
    else if(message.type==='unsupported')reason=reason||'supervisor-unavailable';
    else fail('protocol');
   });
   broker.on('error',()=>fail('broker-error'));broker.on('exit',()=>premature('broker-exit'));
   broker.on('close',(code,sig)=>{closed=true;if(code!==0||sig)fail('broker-exit');finish();});
   watchdog=setTimeout(()=>{reason=reason||'deadline';send({type:'stop'});if(!fallback)fallback=setTimeout(finish,2000);},timeoutMs+2500);
   signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  }catch{fail('setup');}
 });
}

if(require.main===module&&process.argv[2]==='--disposable-worker'){
 const input=createInterface({input:process.stdin});let started=false,id=0,secret='';const pending=new Map();
 const output=value=>{try{process.stdout.write(JSON.stringify(value)+'\n',()=>{});}catch{/* Parent broker still owns termination. */}};
 process.stdout.on('error',()=>process.exitCode=1);
 input.on('line',line=>{
  let message;try{message=JSON.parse(line);}catch{return;}
  if(message.type==='usage-result'){const resolve=pending.get(message.id);pending.delete(message.id);resolve?.(message.value);return;}
  if(started||message.type!=='start')return;started=true;secret=message.key;delete message.key;
  if(message.scenario==='hang-worker'){secret='';setInterval(()=>{},1000);return;}
  const readUsage=()=>new Promise(resolve=>{pending.set(++id,resolve);output({type:'usage',id});});
  runOfflineWorker({keyProvider:()=>{const value=secret;secret='';return value;},readUsage,restrictionsVerified:true,scenario:message.scenario,cleanupMs:message.cleanupMs})
   .then(report=>{secret='';pending.clear();output({type:'result',report});input.close();})
   .catch(()=>{secret='';output({type:'result',report:{...defaults(),reason:'worker-failure',network:emptyNetwork()}});input.close();});
 });
}
module.exports={createNetworkGate,runOfflineProbe,runOfflineWorker,brokerProgram};
