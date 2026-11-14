'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {createNetworkGate,runOfflineProbe}=require('./helpers/geoapify-browser-probe.cjs');
const key='syntheticBrowserCredentialOnly12345';
const usage=async()=>({credits:0,observedAt:Date.now()});
const settings={runtimeKey:key,readUsage:usage,restrictionsVerified:true};
function request(overrides={}){return {method:'GET',url:'https://api.geoapify.com/v1/geocode/search?'+new URLSearchParams({text:'Bakı',filter:'countrycode:az',limit:'5',lang:'az',apiKey:key}),headers:{Origin:'https://a-usta.github.io',Referer:'https://a-usta.github.io/'},...overrides};}
const preflight=()=>request({method:'OPTIONS',headers:{...request().headers,'Access-Control-Request-Method':'GET'}});
function safe(value){const text=JSON.stringify(value);assert(!text.includes(key));assert(!text.includes('apiKey'));assert(!text.includes('https://'));}
test('one intended GET is admitted, sanitized and runtime key reference disposed',async()=>{const g=createNetworkGate(settings);assert((await g.authorize(request())).allowed);g.response(0,200);assert.equal(g.snapshot().reservedCredits,1);safe(g.snapshot());g.destroy();assert(!(await g.authorize(request())).allowed);});
test('optional preflight plus GET reserves exactly two slots/credits; third rejected',async()=>{const g=createNetworkGate(settings);assert((await g.authorize(preflight())).allowed);assert((await g.authorize(request())).allowed);assert.equal((await g.authorize(request())).reason,'http-budget');assert.equal(g.snapshot().admitted,2);assert.equal(g.snapshot().reservedCredits,2);safe(g.snapshot());g.destroy();});
test('concurrent duplicate GET and retry are rejected atomically',async()=>{const g=createNetworkGate(settings);const result=await Promise.all([g.authorize(request()),g.authorize(request()),g.authorize(request())]);assert.equal(result.filter(x=>x.allowed).length,1);assert.equal(result[1].reason,'duplicate-get');assert.equal(result[2].reason,'closed');g.destroy();});
for(const [name,change] of [
 ['Places',{url:'https://api.geoapify.com/v2/places?apiKey='+key}],
 ['tiles',{url:'https://maps.geoapify.com/v1/tile/osm-carto/1/1/1.png?apiKey='+key}],
 ['unexpected host',{url:'https://attacker.invalid/'+key}],
 ['unexpected method',{method:'POST'}],['redirect',{redirected:true}],
 ['wrong Origin',{headers:{...request().headers,Origin:'null'}}],
 ['wrong Referer',{headers:{...request().headers,Referer:'https://a-usta.github.io/A-Usta-webside/'}}],
 ['credential header',{headers:{...request().headers,Authorization:key}}],
 ['duplicate key',{url:request().url+'&apiKey='+key}],
 ['wrong key',{url:request().url.replace(key,'wrongSyntheticBrowserCredential123')}],
 ['invalid URL',{url:key}],['OPTIONS wrong method',{...preflight(),headers:{...preflight().headers,'Access-Control-Request-Method':'POST'}}]
])test(name+' fails closed without reflecting credentials or targets',async()=>{const g=createNetworkGate(settings);assert(!(await g.authorize(request(change))).allowed);assert(!(await g.authorize(request())).allowed);assert.equal(g.snapshot().admitted,0);safe(g.snapshot());g.destroy();});
test('OPTIONS after GET cannot be used as retry slot',async()=>{const g=createNetworkGate(settings);await g.authorize(request());assert.equal((await g.authorize(preflight())).reason,'preflight-contract');g.destroy();});
test('duplicate OPTIONS rejected',async()=>{const g=createNetworkGate(settings);await g.authorize(preflight());assert.equal((await g.authorize(preflight())).reason,'preflight-contract');g.destroy();});
for(const [name,reader] of [['missing',undefined],['stale',async()=>({credits:0,observedAt:Date.now()-11000})],['future',async()=>({credits:0,observedAt:Date.now()+60000})],['failure',async()=>{throw Error(key);}],['timeout',()=>new Promise(()=>{})]])test(name+' authoritative reader blocks dispatch',async()=>{const g=createNetworkGate({...settings,readUsage:reader});assert.equal((await g.authorize(request())).reason,'credit-or-freshness');safe(g.snapshot());assert.equal(g.snapshot().admitted,0);g.destroy();});
test('increasing measured consumption enforces credit ceiling',async()=>{let n=0;const g=createNetworkGate({...settings,readUsage:async()=>({credits:n++?2:0,observedAt:Date.now()})});await g.authorize(preflight());assert.equal((await g.authorize(request())).reason,'credit-or-freshness');g.destroy();});
test('cancelled request cannot dispatch',async()=>{const c=new AbortController();c.abort();const g=createNetworkGate({...settings,signal:c.signal});assert.equal((await g.authorize(request())).reason,'cancelled');g.destroy();});
for(const value of [undefined,'','short','sb_secret_syntheticCredential123456789'])test('invalid/missing key rejected '+String(value).slice(0,9),()=>{assert.throws(()=>createNetworkGate({...settings,runtimeKey:value}),/^Error: Invalid runtime browser key$/);});
for(const [name,options,reason] of [['live',{mode:'live'},'live-not-authorized'],['manual',{manualReconciliation:true},'manual-policy-not-approved'],['missing reader',{},'restriction-or-credit-reader-missing'],['missing key',{readUsage:usage,restrictionsVerified:true},'runtime-key-missing']])test('runner precondition '+name,async()=>{const r=await runOfflineProbe(options);assert.equal(r.status,'BLOCKED');assert.equal(r.reason,reason);assert.equal(r.providerRequests,0);assert.equal(r.network.admitted,0);safe(r);});
for(const scenario of ['success','preflight','http-error','network-failure','redirect'])test('real Chromium entirely offline '+scenario,async()=>{const r=await runOfflineProbe({keyProvider:()=>key,readUsage:usage,restrictionsVerified:true,scenario});assert.equal(r.providerRequests,0);assert.equal(r.realNetworkForwarding,false);assert.equal(r.providerCreditUsage,null);assert.equal(r.egressFuseDenials,0);assert.equal(r.credentialsDisposed,true);assert.equal(r.network.get,1);assert.equal(r.network.options,scenario==='preflight'?1:0);assert(r.network.reservedCredits<=2);assert.equal(r.status,['success','preflight'].includes(scenario)?'PASS':'BLOCKED');if(r.status==='PASS'){assert(r.parsed);assert(r.selectedArea);}safe(r);});
test('original browser assertions remain byte identical after fixture extraction',()=>{const file='tests/automotive-map.browser.test.cjs',before=execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',cwd:root}),after=fs.readFileSync(path.join(root,file),'utf8');const marker='for(const width of';assert.equal(after.slice(after.indexOf(marker)),before.slice(before.indexOf(marker)));});
test('probe has no live forwarding, persistence, screenshots, HAR or tracing API',()=>{const source=fs.readFileSync(path.join(__dirname,'helpers/geoapify-browser-probe.cjs'),'utf8');for(const forbidden of ['Fetch.continueRequest','route.continue(','writeFile','storageState(','screenshot(','recordHar:','tracing.start(','console.log('])assert(!source.includes(forbidden),forbidden);assert(source.includes('Fetch.enable'));assert(source.includes('Fetch.fulfillRequest'));assert(source.includes('Fetch.failRequest'));assert(source.includes('serviceWorkers:\'block\''));});
// Separate child processes keep fault injection isolated from real browser tests.
for(const mode of ['context','both','browser','timeout','cancel'])test('independent cleanup and sanitized original failure: '+mode,()=>{
 const script=`
 const Module=require('node:module');
 const controller=new AbortController();
 const mode=${JSON.stringify(mode)};
 const fixture=require('./tests/helpers/automotive-map-fixture.cjs');
 fixture.fixture=async()=>{if(mode==='cancel')controller.abort();const error=Error('private '+${JSON.stringify(key)}+' https://api.geoapify.com/?apiKey='+${JSON.stringify(key)});if(mode==='timeout')error.name='TimeoutError';throw error;};
 let contextCloseCalls=0,browserCloseCalls=0;
 const page={isClosed:()=>false,evaluate:async()=>{}};
 const context={newPage:async()=>page,newCDPSession:async()=>({send:async()=>{},on(){}}),close:async()=>{contextCloseCalls++;if(mode!=='browser')throw Error('context private '+${JSON.stringify(key)});}};
 const browser={newContext:async()=>context,close:async()=>{browserCloseCalls++;if(mode==='both'||mode==='browser')throw Error('browser private '+${JSON.stringify(key)});}};
 const original=Module._load;Module._load=function(name,...args){if(name==='playwright')return {chromium:{launch:async()=>browser}};return original.call(this,name,...args);};
 const {runOfflineProbe}=require('./tests/helpers/geoapify-browser-probe.cjs');
 (async()=>{const result=await runOfflineProbe({keyProvider:()=>${JSON.stringify(key)},readUsage:async()=>({credits:0,observedAt:Date.now()}),restrictionsVerified:true,signal:controller.signal});process.stdout.write(JSON.stringify({result,contextCloseCalls,browserCloseCalls}));})().catch(()=>{process.exitCode=1;});
 `;
 const output=execFileSync(process.execPath,['-e',script],{encoding:'utf8',timeout:10000,cwd:root});
 const {result:r,contextCloseCalls,browserCloseCalls}=JSON.parse(output);
 assert.equal(contextCloseCalls,1);assert.equal(browserCloseCalls,1);
 assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'cleanup-or-accounting-uncertain');
 assert.equal(r.credentialReferencesDisposed,true);assert.equal(r.credentialsDisposed,!['both','browser'].includes(mode));
 assert.equal(r.primaryFailure.reason,mode==='cancel'?'cancelled':'runner-or-transport-failure');
 assert.equal(r.primaryFailure.phase,'fixture');assert.equal(r.primaryFailure.type,mode==='timeout'?'TimeoutError':'Error');
 assert.deepEqual(r.cleanup.failures.map(f=>f.stage),mode==='both'?['context-close','browser-close']:mode==='browser'?['browser-close']:['context-close']);
 assert(r.cleanup.contextAttempted);assert(r.cleanup.browserAttempted);
 assert.equal(r.providerRequests,0);assert.equal(r.network.admitted,0);safe(r);
});
