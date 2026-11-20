'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

for(const width of [1366,390])test(`Dealer order badge renders at the image’s lower-right on Chromium ${width}px`,async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:12px;font:14px Arial}#cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}</style></head><body><main id="cards"></main></body></html>');
  await page.addStyleTag({path:path.join(root,'assets/marketplace/listing-cards.css')});
  await page.evaluate(()=>{window.AUSTA_MARKETPLACE_CARD_DATA={heart:()=>''};window.AUSTA_VEHICLE_VIN={valid:()=>false};});
  await page.addScriptTag({path:path.join(root,'assets/marketplace/listing-cards.js')});
  await page.evaluate(()=>{
   const api=window.AUSTA_LISTING_CARDS,grid=document.getElementById('cards');
   grid.innerHTML=api.render('dealer',{id:'order',dealer_name:'Sifarişli salon',details:{order_type:'order'},_austaV151Image:'https://example.test/order.jpg'},{home:true,promotion:'premium'})+
    api.render('dealer',{id:'sale',dealer_name:'Adi satış salonu',details:{order_type:'sale'},_austaV151Image:'https://example.test/sale.jpg'},{home:true,promotion:'premium'});
  });
  const badges=page.locator('.austa-card-order-badge');
  assert.equal(await badges.count(),1);
  assert.equal(await badges.textContent(),'SİFARİŞLƏ');
  const geometry=await badges.evaluate(node=>{const b=node.getBoundingClientRect(),m=node.closest('.austa-card-media').getBoundingClientRect();return {right:m.right-b.right,bottom:m.bottom-b.bottom,position:getComputedStyle(node).position};});
  assert.equal(geometry.position,'absolute');assert.ok(geometry.right>=0&&geometry.right<=12);assert.ok(geometry.bottom>=0&&geometry.bottom<=12);
 }finally{await browser.close();}
});
