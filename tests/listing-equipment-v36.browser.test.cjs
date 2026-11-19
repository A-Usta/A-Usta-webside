'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/marketplace/listing-detail-v36.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/marketplace/listing-detail-v36.css'),'utf8');
const expected=['cars','rent','parts','accessories','moto','special','bus','water','caravan','trailer','plate','service','usta','dealer'];

test('V3.6 avadanlıq seçimləri bütün kateqoriyalarda seçilir, saxlanır və redaktədə bərpa olunur',async t=>{
 let browser;
 try{browser=await chromium.launch({executablePath:process.env.AUSTA_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});}
 catch(error){t.skip(`Chromium əlçatan deyil: ${error.message.split('\n')[0]}`);return;}
 try{
  const page=await browser.newPage({viewport:{width:1536,height:1100}});
  await page.setContent('<!doctype html><html lang="az"><meta name="viewport" content="width=device-width,initial-scale=1"><select id="austaV153CCategory"></select><main id="forms"></main></html>');
  await page.addStyleTag({content:css});
  await page.addScriptTag({content:source});
  const actual=await page.evaluate(types=>{
   const api=window.AUSTA_LISTING_EQUIPMENT_V36,root=document.querySelector('#forms'),select=document.querySelector('#austaV153CCategory');
   const results=[];
   for(const type of types){
    select.value=type;const section=document.createElement('section');section.className='austa-v153c-field-grid';root.append(section);api.mount(section,type);
    const box=section.querySelector('[data-v36-equipment]'),checks=[...box.querySelectorAll('[data-v36-equipment-choice]')];
    if(!checks.length)throw Error('Seçim yoxdur: '+type);
    checks[0].checked=true;checks[0].dispatchEvent(new Event('change',{bubbles:true}));
    const hidden=box.querySelector('[data-v153c-key="equipment"]'),saved=JSON.parse(hidden.value);
    api.restore(section,hidden.value);
    if(!box.querySelector('[data-v36-equipment-choice]:checked'))throw Error('Redaktə bərpası olmadı: '+type);
    results.push({type,count:checks.length,selected:saved[0],heading:box.querySelector('legend').textContent});
   }
   return {categories:api.categories,results};
  },expected);
  assert.deepEqual(actual.categories,expected);
  assert.equal(actual.results.length,expected.length);
  assert(actual.results.every(row=>row.count>0&&row.selected&&row.heading==='Avadanlıq və təchizat'));
  for(const width of [1920,1536,1366,900,390]){
   await page.setViewportSize({width,height:1100});
   const layout=await page.locator('.austa-v36-equipment-field').first().evaluate(node=>({scroll:node.scrollWidth,client:node.clientWidth,options:getComputedStyle(node.querySelector('.austa-v36-equipment-options')).gridTemplateColumns}));
   assert(layout.client>0&&layout.scroll<=layout.client,`Avadanlıq forması ${width}px ölçüdə daşır`);
   if(process.env.V36_SCREENSHOTS){fs.mkdirSync(process.env.V36_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.V36_SCREENSHOTS,`equipment-${width}.png`),fullPage:true});}
  }
 }finally{await browser.close();}
});
