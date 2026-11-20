'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

const homeUrl=pathToFileURL(path.resolve(__dirname,'..','index.html')).href;

for(const viewport of [
 {name:'desktop',width:1440,height:1000},
 {name:'mobile',width:390,height:844}
])test(`CarCareKiosk link displays and opens safely on ${viewport.name}`,async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
  await context.route('https://www.carcarekiosk.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>CarCareKiosk test destination</title>'}));
  const page=await context.newPage();
  await page.goto(homeUrl,{waitUntil:'domcontentloaded'});
  const link=page.locator('.austa-carcarekiosk-link');
  assert.equal(await link.count(),1);
  assert.equal(await link.getAttribute('href'),'https://www.carcarekiosk.com/');
  assert.equal(await link.getAttribute('target'),'_blank');
  assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
  assert.match(await link.innerText(),/Avtomobilinizdəki problemləri axtarın/);
  assert.match(await link.innerText(),/CarCareKiosk saytında araşdırın/);
  const box=await link.boundingBox();
  assert(box&&box.width>0&&box.height>0);
  assert(box.x>=0&&box.x+box.width<=viewport.width);
  const prevented=await link.evaluate(anchor=>{const event=new MouseEvent('click',{bubbles:true,cancelable:true});anchor.dispatchEvent(event);return event.defaultPrevented;});
  assert.equal(prevented,false,'homepage scripts do not cancel the external link');
  const isolated=await context.newPage();
  await isolated.setContent('<!doctype html><html><body>'+await link.evaluate(anchor=>anchor.outerHTML)+'</body></html>');
  const popupPromise=isolated.waitForEvent('popup',{timeout:8000});
  await isolated.locator('.austa-carcarekiosk-link').click();
  const popup=await popupPromise;
  assert.equal(popup.url(),'https://www.carcarekiosk.com/');
  assert.equal(await popup.evaluate(()=>window.opener),null);
  await context.close();
 }finally{
  await browser.close();
 }
});
