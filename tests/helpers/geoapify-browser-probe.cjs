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
const {createGuard}=require('./geoapify-live-guard.cjs');
const {fixture}=require('./automotive-map-fixture.cjs');
const BASE='https://a-usta.github.io/A-Usta-webside/';
const ORIGIN='https://a-usta.github.io',REFERER=ORIGIN+'/';
const ENDPOINT='/v1/geocode/search';
const validKey=k=>typeof k==='string'&&/^[A-Za-z0-9_-]{20,100}$/.test(k)&&!/^sb_(secret|publishable)/.test(k);
const lower=headers=>Object.fromEntries(Object.entries(headers||{}).map(([k,v])=>[k.toLowerCase(),String(v)]));

function createNetworkGate({runtimeKey,readUsage,restrictionsVerified=false,signal}={}){
 if(!validKey(runtimeKey))throw Error('Invalid runtime browser key');
 let secret=runtimeKey,closed=false,terminal=false,get=0,options=0,attempted=0,lane=Promise.resolve();
 const events=[];
 // Bounded callback, not a fabricated reader. No timestamp is manufactured here.
 const usage=typeof readUsage==='function'?async()=>{let timer;try{return await Promise.race([Promise.resolve().then(()=>readUsage()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Usage reader timeout')),2000);})]);}finally{clearTimeout(timer);}}:undefined;
 const guard=createGuard({readUsage:usage,restrictionsVerified,maxRequests:2,maxCredits:2});
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
  try{await guard.permit(u.href);}catch{return deny(method,'credit-or-freshness');}
  if(signal?.aborted||closed)return deny(method,'cancelled');
  if(method==='GET')get++;else options++;
  const row={method,kind:'geocoding',allowed:true,host:'api.geoapify.com',path:ENDPOINT,status:null};events.push(row);
  return {allowed:true,index:events.length-1};
 }
 return Object.freeze({
  authorize(request){const next=lane.then(()=>check(request));lane=next.catch(()=>{});return next;},
  response(index,status){if(events[index]?.allowed&&Number.isInteger(status)&&status>=100&&status<=599)events[index].status=status;},
  snapshot(){const s=guard.snapshot();return {attempted,admitted:get+options,get,options,reservedCredits:s.reservedCredits,stopped:terminal||closed,events:events.map(x=>({...x}))};},
  destroy(){closed=true;secret='';}
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

async function runOfflineProbe({keyProvider,readUsage,restrictionsVerified=false,signal,scenario='success',manualReconciliation=false,mode='offline'}={}){
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
  report.phase='fixture';await fixture(page,true,false,{base:BASE,routing,externalMocks:false,runtimeKey:key,isolated:true,includeConfig:true,beforeModules:scenario==='preflight'?async p=>p.evaluate(()=>{const native=window.fetch;window.fetch=(url,options)=>native(url,{...options,headers:{...options?.headers,'x-offline-probe':'1'}});}):undefined});
  if(signal?.aborted){report.reason='cancelled';return report;}
  report.phase='geocode-input';await page.getByLabel('Şəhər / rayon / qəsəbə / kənd',{exact:true}).fill('Bakı');
  report.phase='geocode-request';await page.getByRole('button',{name:'Ərazini tap',exact:true}).click();
  report.phase='geocode-completion';await page.waitForFunction(()=>Boolean(document.querySelector('.am-geocode button'))||!document.querySelector('.am-status').textContent.includes('Ərazi axtarılır'),{},{timeout:10000});
  report.phase='geocode-parse';report.rows=await page.locator('.am-geocode button').count();
  const empty=await page.locator('.am-status').evaluate(n=>n.textContent==='Ərazi tapılmadı.');
  report.parsed=report.rows>0||empty;
  if(report.rows){report.phase='geocode-selection';await page.locator('.am-geocode button').first().click();report.selectedArea=await page.locator('.am-status').evaluate(n=>n.textContent.includes('Bu ərazidə axtar'));}
  const snapshot=gate.snapshot();report.httpStatus=snapshot.events.find(r=>r.method==='GET'&&r.allowed)?.status??null;
  report.corsAccepted=report.httpStatus===200&&report.parsed;
  report.status=report.corsAccepted&&!snapshot.events.some(r=>!r.allowed)&&!uncertain&&!fuse.attempts()?'PASS':'BLOCKED';
  report.phase='complete';report.reason=report.status==='PASS'?'synthetic-only-pass':uncertain||fuse.attempts()?'network-accounting-uncertain':snapshot.events.find(r=>!r.allowed)?.reason||'synthetic-request-failed';
 }catch(error){report.status='BLOCKED';report.reason=signal?.aborted?'cancelled':'runner-or-transport-failure';report.failureType=error?.name==='TimeoutError'?'TimeoutError':'Error';}
 finally{
  closing=true;
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
  try{if(page&&!page.isClosed())await page.evaluate(()=>{window.AUSTA_AUTOMOTIVE_MAP?.close();window.AUSTA_MAP_DATA?.clear();delete window.AUSTA_MAP_SETTINGS;});}catch(error){failed('page-reset',error);}
  try{
   if(context){cleanup.contextAttempted=true;await context.close();cleanup.contextClosed=true;}
  }catch(error){failed('context-close',error);}
  finally{
   // An independent attempt is mandatory even when context.close() throws.
   try{if(browser){cleanup.browserAttempted=true;await browser.close();cleanup.browserClosed=true;}}
   catch(error){failed('browser-close',error);}
   finally{try{await fuse?.close();}catch(error){failed('egress-close',error);}}
  }
  report.credentialsDisposed=report.credentialReferencesDisposed&&(!browser||cleanup.browserClosed);
  if(cleanup.failures.length||uncertain||report.egressFuseDenials){report.status='BLOCKED';report.reason='cleanup-or-accounting-uncertain';}

 }
 return report;
}
module.exports={createNetworkGate,runOfflineProbe};
