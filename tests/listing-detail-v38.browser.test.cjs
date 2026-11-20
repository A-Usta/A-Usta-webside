'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const http=require('node:http');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/marketplace/listing-detail-v36.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/marketplace/listing-detail-v36.css'),'utf8');
const v38css=fs.readFileSync(path.join(root,'assets/marketplace/listing-detail-v38.css'),'utf8');
const messaging=fs.readFileSync(path.join(root,'assets/marketplace/seller-messaging.js'),'utf8');
const cases=[
 ['cars','vehicle',{engine:'2.0',year:2020,mileage:85000},['2.0 L','2020','85 000 km']],
 ['rent','vehicle',{engine:'1.6 L',year:2022,mileage:41000},['1.6 L','2022','41 000 km']],
 ['parts','marketplace',{details:{condition:'Yeni',brand:'Bosch',part_category:'Alternator'}},['Yeni','Bosch','Alternator']],
 ['accessories','marketplace',{details:{condition:'Yeni',brand:'OEM',accessory_type:'Salon aksesuarı'}},['Yeni','OEM','Salon aksesuarı']],
 ['moto','marketplace',{details:{brand:'Honda',model:'CB500',year:2023}},['Honda','CB500','2023']],
 ['special','marketplace',{details:{brand:'Caterpillar',model:'320',year:2021}},['Caterpillar','320','2021']],
 ['bus','marketplace',{details:{brand:'Mercedes-Benz',model:'Sprinter',year:2020}},['Mercedes-Benz','Sprinter','2020']],
 ['water','marketplace',{details:{vessel_type:'Qayıq',year:2024,length:'6 m'}},['Qayıq','2024','6 m']],
 ['caravan','marketplace',{details:{caravan_type:'Səyyar ev',year:2023,beds:4}},['Səyyar ev','2023','4']],
 ['trailer','marketplace',{details:{trailer_type:'Platforma',load_capacity:'3 t',year:2022}},['Platforma','3 t','2022']],
 ['plate','marketplace',{details:{plate_number:'10-AA-100',plate_series:'10 AA'}},['10-AA-100','10 AA']],
 ['service','service_provider',{specialty:'Mühərrik təmiri',services:'Diaqnostika',working_hours:'09:00–18:00'},['Mühərrik təmiri','Diaqnostika','09:00–18:00']],
 ['usta','service_provider',{specialty:'Avtoelektrik',experience:'8 il',working_hours:'09:00–18:00'},['Avtoelektrik','8 il','09:00–18:00']],
 ['dealer','auto_dealer',{brands:'Toyota / Lexus',vehicle_condition:'Yeni',working_hours:'10:00–19:00'},['Toyota / Lexus','Yeni','10:00–19:00']],
 ['leasing','service_provider',{details:{service_category:'leasing',vehicle_categories:['Sedan','SUV'],customer_types:['Fiziki şəxslər'],minimum_term:12}},['Sedan, SUV','Fiziki şəxslər','12']],
 ['insurance','service_provider',{details:{service_category:'insurance',insurance_types:['İcbari','KASKO'],coverage:'Şirkət şərtlərinə uyğun',contract_months:12}},['İcbari, KASKO','Şirkət şərtlərinə uyğun','12']],
 ['sober_driver','service_provider',{details:{service_category:'sober_driver',service_24_7:true,service_area:['Bakı','Sumqayıt'],rate_per_km:1.5}},['Bəli','Bakı, Sumqayıt','1.5']]
];
test('universal title facts, metadata, seller order and overflow at five viewports across all 17 categories',async t=>{
 let browser,server;try{browser=await chromium.launch({executablePath:process.env.AUSTA_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});}catch(error){t.skip(`Chromium unavailable: ${error.message.split('\n')[0]}`);return;}
 try{
  const html='<!doctype html><html lang="az"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font:14px Arial;color:#26332d}#austaFinalListingPage{position:fixed;inset:0;overflow:auto;background:#f4f6f5}.austa-final-wrap{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;max-width:1440px;margin:auto;padding:24px}.austa-final-main{min-width:0}.austa-final-side-sticky{display:grid;gap:14px}.austa-final-side-card{padding:16px;background:white}.austa-final-title{font-size:28px}.austa-final-gallery{margin-top:12px}.austa-final-main-media{height:180px;background:#111}.austa-final-thumbs{height:30px}.austa-final-info-section{margin-top:16px;padding:16px;background:white}@media(max-width:650px){.austa-final-wrap{grid-template-columns:1fr;padding:12px}}</style></head><body></body></html>';
  server=http.createServer((_req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(html);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  const page=await browser.newPage({viewport:{width:1536,height:1100}});await page.goto(origin);await page.addStyleTag({content:css+v38css});
  await page.addScriptTag({content:`window.__item=null;window.AUSTA_LISTING_DETAIL={lookup:async()=>({listing:window.__item}),share:async()=>{},promote:async()=>{}};window.AUSTA_SUPABASE={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},rpc:async(name)=>({data:name==='austa_get_listing_detail_metadata'?{public_number:12541265,view_count:1154,updated_at:'2026-11-20T00:00:00Z'}:name==='austa_get_listing_seller_registered_at'?{registered_at:'2017-08-12T00:00:00Z'}:null,error:null})};${js}`});
  await page.addScriptTag({content:messaging});
  let n=0;
  for(const [category,source,fields,expected] of cases){
   const id=`10000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;const item={id,owner_id:'owner',category,title:`Test ${category}`,status:'active',created_at:'2026-01-01T00:00:00Z',updated_at:'2026-11-20T00:00:00Z',phone:'+994501234567',region:'Bakı',district:'Nəsimi',price:100,provider_type:category==='service'||category==='usta'?'service':category==='dealer'?'dealer':category==='leasing'||category==='insurance'||category==='sober_driver'?'service':'service',...fields};
   await page.evaluate(({item,id,source})=>{window.__item=item;history.replaceState(null,'',`/?listing=${id}&source=${source}`);document.querySelector('#austaFinalListingPage')?.remove();document.body.insertAdjacentHTML('beforeend',`<div id="austaFinalListingPage"><div class="austa-final-page"><div class="austa-final-wrap"><main class="austa-final-main"><h1 class="austa-final-title">${item.title}</h1><div data-v38-title-facts hidden></div><section class="austa-final-gallery"><div class="austa-final-main-media" data-austa-final-main-media><div class="austa-v147-main-stage"></div></div><div class="austa-final-thumbs"></div></section><section class="austa-final-info-section"><h3 class="austa-final-section-title">ELAN MƏLUMATI</h3><dl><div><dt>Elan №</dt><dd>id</dd></div><div><dt>Status</dt><dd>Aktiv</dd></div></dl></section></main><aside class="austa-final-sidebar"><div class="austa-final-side-sticky"><section class="austa-final-side-card"><div class="austa-final-price">100 AZN</div><h2 class="austa-final-section-title">Satıcı və əlaqə</h2><div data-professional-seller></div><div class="austa-final-seller">Satıcı adı</div><button data-austa-phone data-phone="+994501234567">Telefon nömrəsini göstər</button><button class="austa-final-message" data-austa-detail-message>Mesaj yaz</button></section></div></aside></div></div></div>`);}, {item,id,source});
   const facts=page.locator('[data-v38-title-facts]');await facts.waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('[data-v38-seller-joined]'));
   const text=await facts.textContent();for(const value of expected)assert.ok(text.includes(value),`${category} title facts missing ${value}: ${text}`);
   assert.equal(await page.locator('[data-v36-listing-metadata]').count(),1);assert.match(await page.locator('[data-v36-listing-metadata]').innerText(),/12541265[\s\S]*1 154[\s\S]*20\.11\.2026/);
   assert.equal(await page.locator('.austa-final-info-section .austa-final-section-title').count(),0);assert.equal(await page.locator('[data-austa-detail-share]').count(),0);assert.equal(await page.locator('[data-austa-detail-message]').innerText(),'Mesaj yaz');assert.match(await page.locator('[data-v38-seller-joined]').innerText(),/08\.2017/);
   for(const width of [1920,1536,1366,900,390]){await page.setViewportSize({width,height:1024});const over=await page.evaluate(()=>document.querySelector('#austaFinalListingPage').scrollWidth>document.querySelector('#austaFinalListingPage').clientWidth);assert.equal(over,false,`${category} horizontal overflow at ${width}px`);if(process.env.V38_SCREENSHOTS&&['cars','leasing','insurance','sober_driver'].includes(category)&&[1920,390].includes(width)){const dir=process.env.V38_SCREENSHOTS;fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,`detail-${category}-${width}.png`),fullPage:false});}}
  }
 }finally{await browser.close();server.close();}
});
