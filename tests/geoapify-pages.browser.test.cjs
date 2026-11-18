'use strict';
// Fully intercepted offline Chromium contract. No live provider/Supabase traffic.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),pages='https://a-usta.github.io',proxy='https://austa-map-test.austahelper.workers.dev';
const token='eyJzIjoiZml4dHVyZSIsImUiOjB9.'+'a'.repeat(64),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==','base64');
for(const width of [1536,390])test('offline Pages cross-origin map, memory session and all filters '+width,async()=>{
 const browser=await chromium.launch({args:['--no-sandbox'],...(process.env.AUSTA_CHROMIUM?{executablePath:process.env.AUSTA_CHROMIUM}:{})});
 try{const c=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),p=await c.newPage(),requests=[];
 await p.addInitScript(()=>{window.AUSTA_SUPABASE={rpc(_name,a){return Promise.resolve({data:['usta','service'].filter(k=>['all','austa',k,'repair'].includes(a.category)).map((k,i)=>({listing_id:i?'11111111-1111-4111-8111-111111111112':'11111111-1111-4111-8111-111111111111',provider_type:k,public_name:'OFFLINE TEST '+k,public_area:'Bakı',public_address:'TEST workplace',location_kind:'business',latitude:40.409+i*.001,longitude:49.865,services:['repair']}))});}};});
 await p.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());
 if(u.origin===proxy){const h=r.headers();requests.push({path:u.pathname,page:u.searchParams.get('page'),category:u.searchParams.get('category'),token:h['x-austa-map-token'],cookie:h.cookie});const cors={'Access-Control-Allow-Origin':pages,'Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'X-AUSTA-Map-Token, X-AUSTA-Map-Session'};
 if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
 if(u.pathname==='/map-api/session')return route.fulfill({json:{ready:true,token},headers:cors});
 assert.equal(h['x-austa-map-token'],token);assert.equal(h.cookie,undefined);
 if(u.pathname==='/map-api/tile')return route.fulfill({body:png,contentType:'image/png',headers:cors});
 if(u.pathname==='/map-api/places'){const cat=u.searchParams.get('category'),all=['fuel','charging','wash','repair'],kinds=cat==='all'?all:[cat],page=Number(u.searchParams.get('page')||0);return route.fulfill({json:{features:kinds.map((k,i)=>({type:'Feature',properties:{place_id:k+page,name:'OFFLINE TEST '+k+page,country_code:'az',categories:['service.vehicle.'+({fuel:'fuel',charging:'charging_station',wash:'car_wash',repair:'repair.car'}[k])]},geometry:{type:'Point',coordinates:[49.867+i*.001,40.409]}})),hasMore:cat==='all'&&page===0},headers:cors});}
 return route.abort();}
 if(u.origin!==pages)return route.abort();
 assert(!u.pathname.startsWith('/map-api'),'Pages is static; no implicit same-origin API');
 if(u.pathname.endsWith('/runtime-config.json'))return route.fulfill({status:404,body:'not published'});
 const rel=u.pathname.replace('/A-Usta-webside/','');if(!rel||rel==='index.html')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="austaTopUrgentV24"></div><link rel="stylesheet" href="assets/map/map.css"><script src="assets/map/config.js"></script><script src="assets/map/data.js"></script><script src="assets/map/map.js"></script>'});
 const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({path:file});});
 await p.goto(pages+'/A-Usta-webside/');assert.equal(await p.evaluate(()=>document.characterSet),'UTF-8');await p.locator('#austaMapEntry').click();await p.waitForSelector('.am-marker-austa');await p.waitForSelector('.leaflet-tile-loaded');
 const select=p.locator('.am-dialog select').first();
 for(const category of ['fuel','charging','wash','repair','austa','usta','service']){await select.selectOption(category);await p.waitForFunction(()=>!document.querySelector('.am-dialog .am-status').textContent.includes('axtarılır'));await p.waitForSelector('.am-marker');const names=await p.locator('.am-result').allTextContents();assert(names.some(n=>n.includes(category==='austa'?'usta':category)));}
 await select.selectOption('all');await p.getByRole('button',{name:'Daha çox məntəqə',exact:true}).waitFor({state:'visible'}).catch(async()=>{throw Error(JSON.stringify({state:await p.evaluate(()=>({status:document.querySelector('.am-status').textContent,errors:document.querySelector('.am-errors').textContent,filter:document.querySelector('.am-dialog select').value,buttons:[...document.querySelectorAll('.am-list>button')].map(x=>({text:x.textContent,hidden:x.hidden}))})),calls:requests.filter(x=>x.path.endsWith('/places')).map(({page,category})=>({page,category}))}));});await p.getByRole('button',{name:'Daha çox məntəqə',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.am-status').textContent.includes('nəticə qrupu'));assert(requests.some(r=>r.page==='1'));
 await p.locator('.am-marker').first().click();await p.waitForSelector('.leaflet-popup .am-directions');assert.match(await p.locator('.leaflet-popup .am-directions').getAttribute('href'),/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
 assert.equal(await p.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.equal((await c.cookies()).length,0);assert(!JSON.stringify(await p.evaluate(()=>AUSTA_MAP_SETTINGS)).includes(token));
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert(requests.some(r=>r.token===token));
 }finally{await browser.close();}
});
