const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const block=id=>html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'))[1];
const media=block('austa-v153d-14-category-media-js'),form=block('austa-v153c-real-listing-form-js');
const between=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
test('Dealer legacy condition: real Chromium select, edit hydration and UPDATE',async t=>{
 const browser=await chromium.launch({executablePath:'/tmp/category-chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<select id="austaV153CCategory"><option value="dealer">Dealer</option></select><div id="austaV153CFields"></div><button id="austaV153CSave"></button>');
 await page.evaluate(()=>{
  window.timers=[];window.setTimeout=fn=>{timers.push(fn);return timers.length};
  window.row={};window.ops=[];
  window.AUSTA_SUPABASE={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){
   const q={filters:[],update(payload){this.payload=payload;return this},eq(k,v){this.filters.push([k,v]);return this},select(){return this},single:async function(){
    ops.push({table,payload:this.payload,filters:this.filters});
    Object.assign(row,this.payload);return {data:{...row},error:null};
   }};return q;
  }};
  window.AUSTA_V153={detailsFromForm:()=>({}),preserveDetails:async()=>undefined};
  window.AUSTA_V153C={categories:{}};
 });
 const prefix=between(media,'function sb(){','/* =========================================================\n   ADD AUTO DEALER');
 // Extract declarations by their following named boundary; no copied production logic.
 const installStart=media.indexOf('function installDealerCategory(){');
 const installEnd=media.indexOf('let dealerEditItem=',installStart);
 const code="const DEALER_TYPE='dealer';let dealerEditItem=null;\n"+prefix+media.slice(installStart,installEnd)+
  between(form,'function esc(value){','function numeric(')+
  between(form,'function renderFields(){','function readFields(){')+
  between(media,'async function editDealer(item){','window.AUSTA_EDIT_DEALER_V156')+
  between(media,'async function updateDealer(item){','function ensureDealerOption(){')+
  between(media,'function yesNo(value){','async function saveDealer(')+
  `installDealerCategory();const CATEGORIES=window.AUSTA_V153C.categories;
  window.AUSTA_V153C.open=()=>renderFields();
  window.qa={editDealer,updateDealer,renderFields,readCurrentFields};`;
 await page.addScriptTag({content:code});
 const open=async value=>page.evaluate(async value=>{
  row={id:'listing',owner_id:'owner',dealer_name:'Salon',phone:'123',region:'Bakı',address:'Address',vehicle_condition:value};
  ops=[];await qa.editDealer({...row});while(timers.length)timers.shift()();
 },value);
 const state=()=>page.evaluate(()=>{
  const s=document.querySelector('[data-v153c-key="vehicle_condition"]');
  return {value:s.value,options:[...s.options].map(o=>({value:o.value,text:o.textContent,legacy:o.dataset.dealerLegacyCondition==='true'}))};
 });
 for(const value of ['Yeni','Sürülmüş','Yeni və sürülmüş',null]){
  await t.test('hydration '+String(value),async()=>{await open(value);const s=await state();assert.equal(s.value,value??'');assert.equal(s.options.filter(o=>o.legacy).length,0)});
 }
 await t.test('legacy option has exact value and clear label',async()=>{
  await open('İkinci əl');const s=await state();assert.equal(s.value,'İkinci əl');
  assert.deepEqual(s.options.filter(o=>o.legacy),[{value:'İkinci əl',text:'İkinci əl (mövcud dəyər)',legacy:true}]);
 });
 for(const value of ['İkinci əl','  İkinci əl  ']){
  await t.test('unrelated phone edit preserves exact '+JSON.stringify(value),async()=>{
   await open(value);const result=await page.evaluate(async()=>{
    document.querySelector('[data-v153c-key="phone"]').value='456';
    await qa.updateDealer({id:'listing'});return {value:row.vehicle_condition,op:ops[0]};
   });
   assert.equal(result.value,value);assert.deepEqual(result.op.filters,[['id','listing'],['owner_id','owner']]);
  });
 }
 for(const [value,expected] of [['Sürülmüş','Sürülmüş'],['',null]]){
  await t.test('legacy explicit change to '+JSON.stringify(value),async()=>{
   await open('İkinci əl');const result=await page.evaluate(async value=>{
    document.querySelector('[data-v153c-key="vehicle_condition"]').value=value;
    await qa.updateDealer({id:'listing'});return row.vehicle_condition;
   },value);assert.equal(result,expected);
  });
 }
 await t.test('same-control repeated hydration does not duplicate',async()=>{
  await open('İkinci əl');await page.evaluate(async()=>{
   window.AUSTA_V153C.open=()=>{};
   await qa.editDealer({...row});while(timers.length)timers.shift()();
  });assert.equal((await state()).options.filter(o=>o.legacy).length,1);
 });
 await t.test('listing B replaces A legacy option even on reused control',async()=>{
  await page.evaluate(async()=>{
   await qa.editDealer({...row,id:'B',vehicle_condition:'Legacy B'});while(timers.length)timers.shift()();
  });const s=await state();assert.equal(s.value,'Legacy B');assert.equal(s.options.some(o=>o.value==='İkinci əl'),false);
 });
 await t.test('canonical replaces temporary legacy without duplicate',async()=>{
  await page.evaluate(async()=>{await qa.editDealer({...row,vehicle_condition:'Yeni'});while(timers.length)timers.shift()()});
  const s=await state();assert.equal(s.value,'Yeni');assert.equal(s.options.filter(o=>o.legacy).length,0);assert.equal(s.options.filter(o=>o.value==='Yeni').length,1);
 });
 await t.test('CREATE rebuild contains only unchanged canonical choices',async()=>{
  await page.evaluate(()=>qa.renderFields());const s=await state();
  assert.deepEqual(s.options.map(o=>o.value),['','Yeni','Sürülmüş','Yeni və sürülmüş']);
  assert.equal(s.value,'');
 });
 await t.test('global field definitions remain canonical',async()=>{
  assert.deepEqual(await page.evaluate(()=>AUSTA_V153C.categories.dealer.fields.find(f=>f[0]==='vehicle_condition')[3]),['Yeni','Sürülmüş','Yeni və sürülmüş']);
 });
 await t.test('HTML-like legacy content is inert text',async()=>{
  const value='<img src=x onerror="window.attacked=true"> & "legacy"';
  await page.evaluate(()=>{window.AUSTA_V153C.open=()=>qa.renderFields()});await open(value);
  const s=await state();assert.equal(s.value,value);
  assert.equal(s.options.find(o=>o.legacy).text,value+' (mövcud dəyər)');
  assert.equal(await page.locator('#austaV153CFields img').count(),0);
  assert.equal(await page.evaluate(()=>window.attacked),undefined);
 });
 await t.test('no new browser runtime errors',()=>assert.deepEqual(errors,[]));
 }finally{await browser.close()}
});
