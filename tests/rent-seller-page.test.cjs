'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'assets/marketplace/seller-page.js'),'utf8');

test('Rent a Car seller profile lists only its active rent vehicles without changing vehicle lifecycle',async t=>{
 let browser;
 try{browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});}
 catch(error){t.skip('Chromium əlçatan deyil: '+error.message.split('\\n')[0]);return;}
 try{
  const page=await browser.newPage();
  await page.setContent('<!doctype html><html lang="az"><body></body></html>');
  await page.evaluate(()=>{
   window.queryLog=[];
   const rows=[
    {id:'r1',listing_type:'rent',status:'active',seller_profile_id:'seller',brand:'BMW',model:'X5'},
    {id:'s1',listing_type:'sale',status:'active',seller_profile_id:'seller',brand:'Audi',model:'A4'},
    {id:'r2',listing_type:'rent',status:'draft',seller_profile_id:'seller',brand:'Kia',model:'Rio'}
   ];
   window.AUSTA_SUPABASE={
    auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}},
    from(table){const filters=[];const query={
     select(){return query;},eq(key,value){filters.push([key,value]);return query;},
     order(){return query;},range(){return query;},
     then(resolve,reject){window.queryLog.push({table,filters:[...filters]});const data=rows.filter(row=>filters.every(([key,value])=>row[key]===value));return Promise.resolve({data,error:null}).then(resolve,reject);}
    };return query;}
   };
   window.AUSTA_SELLER_IDENTITY={
    async resolveFresh(id){return id==='seller'?{id,display_name:'A-USTA Rent',business_type:'dealer',status:'active',verification_status:'verified'}:null;},
    isOfficial(){return false;}
   };
   window.AUSTA_V151_MARKETPLACE={
    async hydrateVehicleCardMedia(){},
    vehicleCardHtml(item){return '<article data-listing-id="'+item.id+'" data-listing-type="'+item.listing_type+'">'+item.brand+' '+item.model+'</article>';}
   };
  });
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.AUSTA_SELLER_PAGE.open('seller','rent'));
  await page.waitForSelector('[data-listing-id="r1"]');
  assert.equal(await page.locator('#austaSellerPageTitle').textContent(),'A-USTA Rent');
  assert.match(await page.locator('.austa-seller-page-meta').textContent(),/Rent a Car/);
  assert.deepEqual(await page.locator('[data-listing-id]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.listingId,n.dataset.listingType])),[['r1','rent']]);
  const query=await page.evaluate(()=>queryLog[0]);
  assert.equal(query.table,'vehicle_listings');
  assert.deepEqual(query.filters,[['status','active'],['listing_type','rent'],['seller_profile_id','seller']]);
  assert.equal(await page.locator('[data-seller-more]').isHidden(),true);
 }finally{await browser.close();}
});
