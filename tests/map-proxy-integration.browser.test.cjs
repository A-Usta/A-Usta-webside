'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process'),{chromium}=require('playwright');
const {preview}=require('../tools/geoapify/preview.cjs');
const root=path.resolve(__dirname,'..'),base='https://austa-map-test-fixture.onrender.com/';
const bridge=String.raw`import sys,json,time,struct,zlib,urllib.parse
from tools.geoapify.proxy.core import Store
from tools.geoapify.proxy.test_app import create_application
p=json.loads(sys.stdin.read())
if p.get('init'):
 Store(p['env']['AUSTA_MAP_LEDGER'],initialize=True,network_client_minute=60)
 print('{}');sys.exit(0)
def upstream(url):
 u=urllib.parse.urlsplit(url);q=urllib.parse.parse_qs(u.query)
 if u.hostname=='maps.geoapify.com':
  def chunk(k,b):return struct.pack('>I',len(b))+k+b+struct.pack('>I',zlib.crc32(k+b)&0xffffffff)
  png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00\xed\xf0\xee'))+chunk(b'IEND',b'')
  return 'image/png',png
 if u.path=='/v1/geocode/search':return 'application/json',json.dumps({'type':'FeatureCollection','features':[{'properties':{'country_code':'az','name':'Naxçıvan','formatted':'Naxçıvan — SYNTHETIC TEST'},'geometry':{'type':'Point','coordinates':[45.41,39.21]}}]}).encode()
 w,s,e,n=map(float,q['filter'][0][5:].split(','));cats=q['categories'][0].split(',');features=[]
 for i,kind in enumerate(['fuel','charging_station','repair','car_wash']):
  category='service.vehicle.'+kind
  if category not in cats:continue
  features.append({'properties':{'country_code':'az','name':'SYNTHETIC '+kind,'place_id':'fixture-'+kind,'categories':[category],'formatted':'Offline fixture only','contact':{'phone':'+994 00 000 00 00'}},'geometry':{'type':'Point','coordinates':[(w+e)/2+i*.004,(s+n)/2+i*.004]}})
 return 'application/json',json.dumps({'type':'FeatureCollection','features':features}).encode()
app=create_application(p['env'],fetch=upstream);response=[]
body=b''.join(app(p['request'],lambda status,headers:response.append((status,dict(headers)))))
import base64
print(json.dumps({'status':int(response[0][0].split()[0]),'headers':response[0][1],'body':base64.b64encode(body).decode()}))`;
for(const width of [1536,390])test('integrated key-free guest map, actual WSGI/SQLite and synthetic provider '+width,{timeout:60000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'map-proxy-integration-'));fs.chmodSync(dir,0o700);let browser,error;
 const env={AUSTA_MAP_MODE:'TEST',AUSTA_MAP_TEST_ORIGIN:base.slice(0,-1),AUSTA_MAP_PREVIEW_ROOT:path.join(dir,'preview'),AUSTA_MAP_LEDGER:path.join(dir,'meter.sqlite'),GEOAPIFY_SERVER_KEY:'SYNTHETIC_SERVER_CREDENTIAL_NOT_LIVE',AUSTA_MAP_SESSION_SECRET:'1'.repeat(64)};
 const invoke=payload=>{const r=spawnSync('python3',['-B','-c',bridge],{cwd:root,input:JSON.stringify({env,...payload}),encoding:'utf8',timeout:10000,maxBuffer:3e6});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 try{
  preview(env.AUSTA_MAP_PREVIEW_ROOT);invoke({init:true});browser=await chromium.launch({args:['--no-sandbox']});const context=await browser.newContext({viewport:{width,height:1100},serviceWorkers:'block',ignoreHTTPSErrors:false}),p=await context.newPage(),requests=[],external=[],errors=[];p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async r=>{try{const u=new URL(r.request().url());if(u.origin!==base.slice(0,-1)){external.push(u);return r.abort();}const h=await r.request().allHeaders();requests.push(u);assert(!u.searchParams.has('apiKey'));const e={REQUEST_METHOD:r.request().method(),PATH_INFO:u.pathname,QUERY_STRING:u.search.slice(1),HTTP_HOST:u.host,'wsgi.url_scheme':'https',REMOTE_ADDR:'127.0.0.1',HTTP_ORIGIN:h.origin||'',HTTP_REFERER:h.referer||'',HTTP_COOKIE:h.cookie||'',HTTP_X_AUSTA_MAP_SESSION:h['x-austa-map-session']||'',CONTENT_LENGTH:h['content-length']||''};if(h['sec-fetch-site'])e.HTTP_SEC_FETCH_SITE=h['sec-fetch-site'];const response=invoke({request:e});await r.fulfill({status:response.status,headers:response.headers,body:Buffer.from(response.body,'base64')});}catch(e){error=e;await r.abort();}});
  await p.goto(base);await p.locator('#austaMapEntry').click();await p.waitForSelector('.am-marker');await p.waitForFunction(()=>document.querySelectorAll('.am-result').length===4);await p.waitForFunction(()=>document.querySelector('.am-tile-status').hidden);
  assert.equal(await p.locator('.am-marker').count(),4);assert(requests.some(u=>u.pathname==='/map-api/session'));assert(requests.some(u=>u.pathname==='/map-api/tile'));assert.equal(await p.evaluate(()=>AUSTA_MAP_SETTINGS.geoapifyBrowserKey),'');assert.equal(await p.evaluate(()=>document.cookie),'');
  await p.locator('.am-marker').first().click();await p.waitForSelector('.leaflet-popup');const href=await p.locator('.leaflet-popup').getByRole('link',{name:'Xəritədən marşrut qur'}).getAttribute('href');assert(href.startsWith('https://www.google.com/maps/dir/'));await p.locator('.leaflet-popup-close-button').click();
  await p.locator('.am-filters').getByRole('button',{name:'Yanacaqdoldurma',exact:true}).click();await p.waitForFunction(()=>document.querySelectorAll('.am-result').length===1);assert.match(await p.locator('.am-result').innerText(),/SYNTHETIC fuel/);
  // Await the actual bounded request instead of assuming debounce/network timing.
  const [nakh]=await Promise.all([p.waitForResponse(r=>{const u=new URL(r.url());return u.pathname==='/map-api/places'&&u.searchParams.get('box')?.startsWith('45.');}),p.getByRole('button',{name:'Naxçıvan',exact:true}).click()]);assert.equal(nakh.status(),200);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(external.length,0);assert.deepEqual(errors,[]);assert(!JSON.stringify(await p.evaluate(()=>AUSTA_MAP_SETTINGS)).includes(env.GEOAPIFY_SERVER_KEY));if(error)throw error;
 }catch(e){throw error||e;}finally{await browser?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
