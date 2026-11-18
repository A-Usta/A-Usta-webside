'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/marketplace/listing-detail-v36.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/marketplace/listing-detail-v36.css'),'utf8');
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;font:14px Arial;color:#26332d}#austaFinalListingPage{position:fixed;inset:0;overflow:auto}.austa-final-wrap{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:26px;max-width:1440px;margin:auto;padding:24px}.austa-final-main{min-width:0}.austa-final-side-sticky{display:grid;gap:14px}.austa-final-side-card,.austa-final-info-section{padding:16px;background:white}.austa-final-gallery{margin-top:10px}.austa-final-main-media{aspect-ratio:16/10;background:#111}.austa-v147-main-stage{position:relative;height:100%}.austa-v147-main-image,.austa-v147-main-video{width:100%;height:100%;object-fit:contain}.austa-final-thumb{width:70px;height:46px}.austa-final-spec-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.austa-final-spec{padding:8px}.austa-final-spec small,.austa-final-spec strong{display:block}.austa-final-title{font-size:28px}.austa-final-price{font-size:28px}.austa-final-section-title{font-size:16px}
</style></head><body><div id="austaFinalListingPage"><div class="austa-final-page"><header class="austa-final-top"><button class="austa-final-back">← Geri</button></header><div class="austa-final-wrap"><main class="austa-final-main"><div class="austa-final-category">Avtomobil</div><h1 class="austa-final-title">Mercedes-Benz E-Class</h1><span class="austa-p16-status">Aktiv</span><section class="austa-final-gallery"><div class="austa-final-main-media" data-austa-final-main-media><div class="austa-v147-main-stage"><img class="austa-v147-main-image" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="></div></div><div class="austa-final-thumbs" data-austa-final-thumbs></div></section><section class="austa-final-info-section"><h3 class="austa-final-section-title">AVTOMOBİL HAQQINDA</h3><div class="austa-final-spec-grid">${[['Şəhər','Bakı'],['Sürətlər qutusu','Avtomat'],['Marka','Mercedes-Benz'],['Ötürücü','Arxa'],['Buraxılış ili','2023'],['Vəziyyəti','Yaxşı']].map(([k,v])=>`<div class="austa-final-spec"><small>${k}</small><strong>${v}</strong></div>`).join('')}</div></section><section class="austa-final-description">Təsvir</section></main><aside class="austa-final-sidebar"><div class="austa-final-side-sticky"><section class="austa-final-side-card"><div class="austa-final-price">42 000 AZN</div><div data-professional-seller></div><div class="austa-final-seller">Elan sahibi</div></section><section class="austa-final-side-card" data-austa-final-owner hidden><button data-owner-vip>VIP</button></section></div></aside></div></div>
<script>window.AUSTA_LISTING_DETAIL={lookup:async()=>({listing:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',__austa_source:'vehicle',region:'Bakı',updated_at:'2026-11-18T12:00:00Z'}}),share:async()=>{window.__shared=true},promote:async(_id,_source,type)=>{window.__promoted=type}};window.AUSTA_SUPABASE={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},rpc:async(name)=>({data:name==='austa_get_listing_detail_metadata'?[{public_number:1254565,view_count:12817,updated_at:'2026-11-18T12:00:00Z'}]:name==='austa_get_listing_price_history'?[{price:42000,currency:'AZN',changed_at:'2026-11-18T12:00:00Z',initial_known:true}]:null,error:null})};</script><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
let server,origin;
test('V3.6 listing detail layout and actions fit desktop/tablet/mobile viewports',async(t)=>{
 server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try{
  try{browser=await chromium.launch({executablePath:process.env.AUSTA_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});}
  catch(error){t.skip(`Chromium unavailable in this environment: ${error.message.split('\n')[0]}`);return;}
  for(const width of [1536,1366,900,390]){
   const page=await browser.newPage({viewport:{width,height:1000}});await page.goto(origin+'/?listing=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&source=vehicle');await page.addStyleTag({content:css});await page.addScriptTag({content:js});await page.evaluate(()=>document.body.appendChild(document.getElementById('austaFinalListingPage')));
   await page.waitForSelector('[data-v36-listing-metadata] span');
   assert.equal(await page.locator('.austa-v36-title-actions button').count(),3);
   assert.equal(await page.locator('.austa-v36-spec-row').count(),3);
   assert.equal(await page.locator('[data-v36-promotion]').count(),3);
   assert.match(await page.locator('[data-v36-listing-metadata]').innerText(),/№ 1254565.*Baxışların sayı: 12 817.*Yeniləndi: 18\.11\.2026/s);
   const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,specColumns:getComputedStyle(document.querySelector('.austa-v36-spec-row')).gridTemplateColumns,wrap:getComputedStyle(document.querySelector('.austa-final-wrap')).gridTemplateColumns}));
   assert.equal(layout.overflow,false,`horizontal overflow at ${width}px`);
   assert.equal(layout.specColumns.split(' ').length,width<=600?1:2,`spec columns at ${width}px`);
   if(width<=1000)assert.equal(layout.wrap.split(' ').length,1,`content columns at ${width}px`);
   if(process.env.V36_SCREENSHOTS){fs.mkdirSync(process.env.V36_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.V36_SCREENSHOTS,`detail-${width}.png`),fullPage:true});}
   await page.close();
  }
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
