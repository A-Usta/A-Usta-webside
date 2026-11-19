'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/marketplace/listing-detail-v36.js'),'utf8');
const favorites=fs.readFileSync(path.join(root,'assets/marketplace/card-data.js'),'utf8');
const cards=fs.readFileSync(path.join(root,'assets/marketplace/listing-cards.js'),'utf8');
const cardsCss=fs.readFileSync(path.join(root,'assets/marketplace/listing-cards.css'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/marketplace/listing-detail-v36.css'),'utf8');
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;font:14px Arial;color:#26332d}#austaFinalListingPage{position:fixed;inset:0;overflow:auto}.austa-final-wrap{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:26px;max-width:1440px;margin:auto;padding:24px}.austa-final-main{min-width:0}.austa-final-side-sticky{display:grid;gap:14px}.austa-final-side-card,.austa-final-info-section{padding:16px;background:white}.austa-final-gallery{margin-top:10px}.austa-final-main-media{aspect-ratio:16/10;background:#111}.austa-v147-main-stage{position:relative;height:100%}.austa-v147-main-image,.austa-v147-main-video{width:100%;height:100%;object-fit:contain}.austa-final-thumb{width:70px;height:46px}.austa-final-spec-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.austa-final-spec{padding:8px}.austa-final-spec small,.austa-final-spec strong{display:block}.austa-final-title{font-size:28px}.austa-final-price{font-size:28px}.austa-final-section-title{font-size:16px}
</style></head><body><div id="austaFinalListingPage"><div class="austa-final-page"><header class="austa-final-top"><button class="austa-final-back">← Geri</button></header><div class="austa-final-wrap"><main class="austa-final-main"><div class="austa-final-category">Avtomobil</div><h1 class="austa-final-title">Mercedes-Benz E-Class</h1><span class="austa-p16-status">Aktiv</span><section class="austa-final-gallery"><div class="austa-final-main-media" data-austa-final-main-media><div class="austa-v147-main-stage"><img class="austa-v147-main-image" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="></div></div><div class="austa-final-thumbs" data-austa-final-thumbs></div></section><section class="austa-final-info-section"><h3 class="austa-final-section-title">AVTOMOBİL HAQQINDA</h3><div class="austa-final-spec-grid">${[['Şəhər','Bakı'],['Sürətlər qutusu','Avtomat'],['Marka','Mercedes-Benz'],['Ötürücü','Arxa'],['Buraxılış ili','2023'],['Vəziyyəti','Yaxşı']].map(([k,v])=>`<div class="austa-final-spec"><small>${k}</small><strong>${v}</strong></div>`).join('')}</div></section><section class="austa-final-description">Təsvir</section></main><aside class="austa-final-sidebar"><div class="austa-final-side-sticky"><section class="austa-final-side-card"><div class="austa-final-price">42 000 AZN</div><div data-professional-seller></div><div class="austa-final-seller">Elan sahibi</div></section><section class="austa-final-side-card" data-austa-final-owner hidden><button data-owner-vip>VIP</button></section></div></aside></div></div>
<script>window.favoriteWrites=[];window.AUSTA_LISTING_DETAIL={lookup:async()=>({listing:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',owner_id:'owner',__austa_source:'vehicle',region:'Bakı',updated_at:'2026-11-18T12:00:00Z'}}),share:async()=>{window.__shared=true},promote:async(_id,_source,type)=>{window.__promoted=type}};window.AUSTA_SUPABASE={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>({select(){return this},eq(){return this},in:async()=>({data:window.favoriteRows||[],error:null}),insert:async(row)=>{window.favoriteWrites.push(row);return {error:null}},delete(){return this},then(resolve){resolve({error:null})}}),rpc:async(name)=>({data:name==='austa_get_listing_detail_metadata'?[{public_number:1254565,view_count:12817,updated_at:'2026-11-18T12:00:00Z'}]:name==='austa_get_listing_price_history'?[{price:42000,currency:'AZN',changed_at:'2026-11-18T12:00:00Z',initial_known:true}]:null,error:null})};</script><script>${favorites.replace(/<\/script/gi,'<\\/script')}</script><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
let server,origin;
test('V3.6 listing detail layout and actions fit desktop/tablet/mobile viewports',async(t)=>{
 server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try{
  try{browser=await chromium.launch({executablePath:process.env.AUSTA_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});}
  catch(error){t.skip(`Chromium unavailable in this environment: ${error.message.split('\n')[0]}`);return;}
  for(const width of [1920,1536,1366,900,390]){
   const page=await browser.newPage({viewport:{width,height:1000}});await page.goto(origin+'/?listing=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&source=vehicle');await page.addStyleTag({content:css});await page.addScriptTag({content:js});await page.evaluate(()=>document.body.appendChild(document.getElementById('austaFinalListingPage')));
   await page.waitForSelector('[data-v36-listing-metadata] span');
   assert.equal(await page.locator('.austa-v36-title-actions button').count(),3);
   assert.equal(await page.locator('.austa-v36-spec-row').count(),3);
   assert.equal(await page.locator('[data-v36-promotion]').count(),3);
   assert.equal(await page.locator('.austa-v36-promotion-card').isHidden(),true,'owner keeps original promotion flow without a duplicate card');
   assert.equal(await page.locator('[data-owner-vip]').count(),1,'existing owner promotion control remains in the DOM');
   assert.match(await page.locator('[data-v36-listing-metadata]').innerText(),/№ 1254565.*Baxışların sayı: 12 817.*Yeniləndi: 18\.11\.2026/s);
   assert.equal(await page.locator('[data-v36-listing-metadata]').evaluate(node=>node.previousElementSibling?.classList.contains('austa-final-gallery')),true,'metadata qalereyanın dərhal altındadır');
   assert.doesNotMatch((await page.locator('#austaFinalListingPage').innerText()),/YERLƏŞMƏ|ELAN MƏLUMATI/);
   if(width===1536){
    const favorite=page.locator('.austa-v36-favorite');await page.waitForFunction(()=>{const b=document.querySelector('.austa-v36-favorite');return b&&b.getAttribute('aria-busy')==='false';});
    await favorite.click();await page.waitForFunction(()=>window.favoriteWrites.length===1);
    assert.equal(await favorite.getAttribute('aria-pressed'),'true');assert.equal(await favorite.isDisabled(),false);
    await page.locator('[data-v36-price-history]').click();await page.waitForSelector('.austa-v36-dialog [data-v36-history]');
    assert.match(await page.locator('.austa-v36-dialog [data-v36-history]').innerText(),/İlkin qeydə alınan qiymət.*42.*18\.11\.2026/s);
   }
   const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,specColumns:getComputedStyle(document.querySelector('.austa-v36-spec-row')).gridTemplateColumns,wrap:getComputedStyle(document.querySelector('.austa-final-wrap')).gridTemplateColumns}));
   assert.equal(layout.overflow,false,`horizontal overflow at ${width}px`);
   assert.equal(layout.specColumns.split(' ').length,width<=600?1:2,`spec columns at ${width}px`);
   if(width<=1000)assert.equal(layout.wrap.split(' ').length,1,`content columns at ${width}px`);
   if(process.env.V36_SCREENSHOTS){fs.mkdirSync(process.env.V36_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.V36_SCREENSHOTS,`detail-${width}.png`),fullPage:true});}
   await page.close();
  }
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});

const cardExamples=[
 ['cars',{listing_type:'sale',brand:'Mercedes-Benz',model:'E-Class',year:2023,engine:'2.0 L',mileage:45000,price:35000,region:'Bakı',created_at:'2026-11-19T02:42:00Z'}],
 ['rent',{listing_type:'rent',brand:'Toyota',model:'Camry',year:2022,daily_price:80,rental_type:'Günlük',deposit:300,mileage:50000,region:'Bakı',created_at:'2026-11-19T02:42:00Z'}],
 ['parts',{title:'Ön fara',price:150,condition:'used',details:{part_name:'Ön fara',compatibility:'Toyota Camry 2020–2023',oem:'81150-06A30',stock:'Anbarda'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'}],
 ['accessories',{title:'Döşəmə örtüyü',price:70,brand:'Toyota',model:'Camry',condition:'new',details:{stock:'Anbarda'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'}],
 ['moto',{title:'Yamaha NMAX',year:2024,price:7000,condition:'used',details:{moto_type:'Skuter',mileage:8000},region:'Bakı',created_at:'2026-11-19T02:42:00Z'}],
 ['special',{title:'Mini ekskavator',year:2021,price:25000,details:{special_type:'Ekskavator',work_hours:1200,sale_rent:'Satış'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'}],
 ['bus',{title:'Yol avtobusu',year:2020,price:90000,details:{capacity:45,sale_rent:'Satış'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'}],
 ['water',{title:'Motorlu qayıq',year:2022,price:18000,condition:'used',details:{water_type:'Qayıq',engine:'90 hp'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'}],
 ['caravan',{title:'Səyahət karavanı',year:2023,price:22000,details:{caravan_type:'Karavan',beds:4,sale_rent:'Satış'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'}],
 ['trailer',{title:'Yük qoşqusu',year:2021,price:6000,condition:'used',details:{trailer_type:'Qoşqu',load_capacity:1500},region:'Bakı',created_at:'2026-11-19T02:42:00Z'}],
 ['plate',{title:'10-AA-100',price:12000,details:{plate_number:'10-AA-100',plate_series:'10 AA',document_status:'Sənədlər qaydasında'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'}],
 ['service',{name:'Servis Mərkəzi',specialty:'Mühərrik təmiri',experience:'12 il',working_hours:'09:00–18:00',price:50,region:'Bakı',created_at:'2026-11-19T02:42:00Z',details:{price_policy:'Diaqnostika 50 AZN'}}],
 ['usta',{name:'Usta Rauf',specialty:'Avtoelektrik',experience:'8 il',working_hours:'09:00–18:00',region:'Gəncə',created_at:'2026-11-19T02:42:00Z'}],
 ['dealer',{dealer_name:'A-USTA Avtosalon',details:{brands:'Toyota / Lexus',working_hours:'10:00–19:00',vehicle_condition:'Yeni və işlənmiş',credit_available:true},region:'Bakı',created_at:'2026-11-19T02:42:00Z'}]
];
test('V3.6 all active category cards preserve category data and align at desktop/mobile',async(t)=>{
 let browser;
 try{browser=await chromium.launch({executablePath:process.env.AUSTA_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});}
 catch(error){t.skip(`Chromium unavailable in this environment: ${error.message.split('\n')[0]}`);return;}
 try{
  const page=await browser.newPage({viewport:{width:1536,height:1100}});
  await page.setContent('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f5f7f5;font:14px Arial}.qa-card-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}@media(max-width:600px){body{padding:12px}.qa-card-grid{grid-template-columns:1fr}}</style><main class="qa-card-grid"></main>');
  await page.addStyleTag({content:cardsCss});
  await page.addScriptTag({content:`window.AUSTA_MARKETPLACE_CARD_DATA={heart:()=>''};window.AUSTA_VEHICLE_TECHNICAL={engineLabel:item=>({text:item.engine||'',fuelIncluded:false})};window.AUSTA_VEHICLE_VIN={valid:()=>false};${cards}`});
  await page.evaluate(rows=>{const grid=document.querySelector('.qa-card-grid');rows.forEach(([type,item],i)=>grid.insertAdjacentHTML('beforeend',AUSTA_LISTING_CARDS.render(type,{...item,id:'QA-'+i})));},cardExamples);
  for(const width of [1536,390]){
   await page.setViewportSize({width,height:1100});
   const checks=await page.locator('.austa-market-card').evaluateAll(nodes=>nodes.map(card=>{const content=card.querySelector('.austa-card-content'),price=content.querySelector('.austa-card-price'),title=content.querySelector('.austa-card-title'),summary=content.querySelector('.austa-card-summary'),location=content.querySelector('.austa-card-location-time');return {width:card.getBoundingClientRect().width,overflow:card.scrollWidth>card.clientWidth,order:[price,title,summary,location].filter(Boolean).map(n=>n.className),align:getComputedStyle(title||content).textAlign,locationAlign:getComputedStyle(location||content).textAlign,summary:getComputedStyle(summary||content).whiteSpace};}));
   assert.equal(checks.length,cardExamples.length);
   assert(checks.every(x=>x.width>0&&!x.overflow&&x.align==='left'&&x.locationAlign==='left'&&x.summary==='nowrap'),`card overflow/alignment at ${width}px`);
   assert(checks.every(x=>x.order.at(-1)==='austa-card-location-time'&&x.order.includes('austa-card-title')&&x.order.includes('austa-card-summary')),`card content order at ${width}px`);
   if(process.env.V36_SCREENSHOTS){fs.mkdirSync(process.env.V36_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.V36_SCREENSHOTS,`cards-all-categories-${width}.png`),fullPage:true});}
  }
 }finally{await browser.close();}
});
