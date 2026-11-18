'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
test('server-only proxy: real persistent multi-process budgets and offline security contracts',()=>{
 const result=spawnSync('python3',['-B','-m','unittest','discover','-s','tests/geoapify','-p','test_proxy.py','-v'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:30000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stderr,/Ran 18 tests/);
 assert.match(result.stderr,/\nOK\n/);
});

test('real Chromium offline same-origin GET works without Origin but still requires session authentication',{timeout:30000},async()=>{
 const {chromium}=require('playwright');
 const browser=await chromium.launch({args:['--no-sandbox']});
 // This is a synthetic WSGI/provider/session bridge, not live regional QA.
 const bridge=String.raw`import runpy,json,sys,tempfile,hashlib,time
m=runpy.run_path('tests/geoapify/test_proxy.py')
c=m['core'];env=json.loads(sys.stdin.read())
with tempfile.TemporaryDirectory() as directory:
 store=c.Store(directory+'/usage.sqlite',initialize=True)
 boundary=c.Boundary(m['RAW'],hashlib.sha256(m['RAW']).hexdigest())
 proxy=c.Proxy(server_key=m['KEY'],store=store,boundary=boundary,fetch=lambda u:('application/json',m['backend'](u)[1].replace(m['KEY'].encode(),b'IGNORED')))
 app=m['application'](proxy,authenticate=lambda e:c.Principal(m['SUBJECT'],time.time()+60) if e.get('HTTP_COOKIE')=='austa_fixture=verified' else None,allowed_origin='https://proxy-contract.test')
 response=[]
 body=b''.join(app(env,lambda status,headers:response.append((status,dict(headers)))))
 print(json.dumps({'status':int(response[0][0].split()[0]),'headers':response[0][1],'body':body.decode()}))`;
 let routeError;
 try{
  const context=await browser.newContext({serviceWorkers:'block',ignoreHTTPSErrors:false});
  await context.addCookies([{name:'austa_fixture',value:'verified',url:'https://proxy-contract.test/',httpOnly:true,secure:true,sameSite:'Strict'}]);
  const p=await context.newPage(),seen=[];
  await p.route('**/*',async r=>{try{
   const u=new URL(r.request().url());assert.equal(u.origin,'https://proxy-contract.test');
   if(u.pathname==='/')return r.fulfill({contentType:'text/html',body:'<!doctype html><title>Offline proxy contract</title>'});
   const h=await r.request().allHeaders();seen.push({origin:h.origin||null,referer:!!h.referer});
   const env={REQUEST_METHOD:r.request().method(),PATH_INFO:u.pathname,QUERY_STRING:u.search.slice(1),HTTP_ORIGIN:h.origin||'',HTTP_REFERER:h.referer||'',HTTP_COOKIE:h.cookie||''};
   if(h['sec-fetch-site'])env.HTTP_SEC_FETCH_SITE=h['sec-fetch-site'];
   const result=spawnSync('python3',['-B','-c',bridge],{cwd:path.resolve(__dirname,'..'),input:JSON.stringify(env),encoding:'utf8',timeout:10000});
   assert.equal(result.status,0,result.stderr);const response=JSON.parse(result.stdout);
   assert(!response.body.includes('SYNTHETIC_SERVER_ONLY'));
   return r.fulfill({status:response.status,headers:response.headers,body:response.body});
  }catch(error){routeError=error;await r.abort();}});
  await p.goto('https://proxy-contract.test/');
  const query='/places?box=49.84,40.38,49.90,40.44&category=fuel';
  const first=await p.evaluate(async q=>{const r=await fetch(q);return {status:r.status,body:await r.json(),cookieVisible:document.cookie};},query);
  assert.equal(first.status,200);assert.equal(first.body.features.length,1);assert.equal(first.cookieVisible,'');
  const hidden=await p.evaluate(async q=>(await fetch(q,{referrerPolicy:'no-referrer'})).status,query);assert.equal(hidden,403);
  await context.clearCookies();const denied=await p.evaluate(async q=>(await fetch(q)).status,query);assert.equal(denied,401);
  assert.equal(seen.length,3);assert(seen.every(x=>x.origin===null));assert(seen[0].referer);assert(!seen[1].referer);
 }catch(error){throw routeError||error;}finally{await browser.close();}
});
