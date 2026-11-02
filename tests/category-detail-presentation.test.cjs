const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const base=cp.execFileSync('git',['show','origin/main:index.html'],{cwd:root,encoding:'utf8',maxBuffer:1e7});
const between=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const helpers=between(html,'function escapeHtml(value){','function maskedPhone(phone){');
const entry=between(html,'async function openFullListing(id,source,expectedCategory){','/* =========================================================\n   EXACT LISTING CLICK OVERRIDE');
const technical=fs.readFileSync(path.join(root,'assets/vehicle/technical.js'),'utf8');
const definitions={
 parts:[['part_name','Hissənin adı'],['oem','OEM / kod'],['compatibility','Uyğunluq'],['stock','Stok vəziyyəti']],
 accessories:[['accessory_name','Aksessuarın adı'],['stock','Stok vəziyyəti']],
 moto:[['moto_type','Nəqliyyat növü'],['mileage','Yürüş']],
 special:[['special_type','Texnika növü'],['work_hours','İş saatı'],['sale_rent','Təklif növü']],
 bus:[['capacity','Sərnişin tutumu'],['sale_rent','Təklif növü']],
 water:[['water_type','Su nəqliyyatı növü'],['engine','Mühərrik']],
 caravan:[['caravan_type','Karavan növü'],['beds','Yataq sayı'],['sale_rent','Təklif növü']],
 trailer:[['trailer_type','Qoşqu növü'],['load_capacity','Yük tutumu']],
 plate:[['plate_number','Qeydiyyat nişanı'],['plate_series','Seriya'],['document_status','Sənəd vəziyyəti']]
};
const hooks=`
 globalThis.__calls=[];
 window.AUSTA_SUPABASE={from(table){__calls.push(['table',table]);return {
  select(projection){__calls.push(['select',projection]);return this},eq(){return this},
  async maybeSingle(){return {data:globalThis.__item,error:null}}
 }}};
 window.AUSTA_SELLER_IDENTITY={hydrate(items){__calls.push(['identity',items[0].seller_profile_id])}};
 globalThis.hydrateSupabaseListingMedia=async item=>{__calls.push(['media-hydrate',item.id]);return item};
 globalThis.removeOldListingOverlays=()=>{};
 globalThis.similarHtml=()=>'';
 globalThis.ownerControls=async()=>{__calls.push(['owner-controls'])};
 globalThis.mediaGallery=async()=>{__calls.push(['gallery'])};
 globalThis.hydrateSimilarImages=async()=>{__calls.push(['similar-images'])};
`;
function fixture(){
 const f=require('./helpers/listing-detail-fixture.cjs').fixture();
 return {c:f.c,document:f.document,rows(item){return JSON.parse(JSON.stringify(f.window.__detail.specsFor(item)));},async render(item){
  const category=item.category||'cars',source=['cars','rent'].includes(category)?'vehicle':['service','usta'].includes(category)?'service_provider':category==='dealer'?'auto_dealer':'marketplace';
  const extra={...item};if(source==='vehicle')extra.listing_type=category==='rent'?'rent':'sale';if(source==='service_provider')extra.provider_type=category;
  assert.equal(await f.open(source,extra),true);return f.markup();
 }};
}
for(const [category,fields] of Object.entries(definitions)){
 const details=Object.fromEntries(fields.map(([key])=>[key,'value-'+key]));
 test(category+': all canonical JSON fields have professional labels',()=>{
  assert.deepEqual(fixture().rows({category,details}),fields.map(([key,label])=>[label,'value-'+key]));
 });
 test(category+': actual detail entry renders persisted JSON through mapper',async()=>{
  const f=fixture(),markup=await f.render({category,details,seller_profile_id:'business'});
  for(const [key,label] of fields){assert.ok(markup.includes(label));assert.ok(markup.includes('value-'+key));}
  assert.match(markup,/Elan haqqında məlumat/);
  assert.equal(f.document.body.children.filter(p=>p.isConnected).length,1);
 });
 test(category+': unknown legacy and other-category JSON keys never leak',()=>{
  const all=Object.fromEntries(Object.values(definitions).flat().map(([key])=>[key,'foreign-'+key]));
  Object.assign(all,{legacy_internal_note:'PRIVATE',old_private_value:'PRIVATE',name:'PRIVATE',owner_name:'PRIVATE',seller_profile_id:'PRIVATE'});
  const rows=fixture().rows({category,details:all});
  assert.deepEqual(rows,fields.map(([key,label])=>[label,'foreign-'+key]));assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
 });
 test(category+': common columns win without legacy JSON duplication or fallback',()=>{
  const common={brand:'Real brand',model:'Real model',year:2026,condition:'Yeni',region:'Bakı',district:'Yasamal'};
  const legacy={brand:'WRONG',model:'WRONG',year:'WRONG',condition:'WRONG',region:'WRONG',district:'WRONG',price:'WRONG',description:'WRONG'};
  const rows=fixture().rows({category,...common,details:legacy});assert.equal(rows.length,6);
  assert.deepEqual(rows.map(([,value])=>value),Object.values(common).map(String));
  assert.deepEqual(fixture().rows({category,details:legacy}),[]);
 });
 test(category+': markup escapes HTML and script-like scalar content',async()=>{
  const f=fixture(),value='<img src=x onerror="window.attacked=true"><script>window.attacked=true</script>';
  const markup=await f.render({category,details:{[fields[0][0]]:value}});
  assert.ok(markup.includes('&lt;img'));assert.ok(markup.includes('&lt;script&gt;'));assert.ok(!markup.includes('<img src=x'));assert.ok(!markup.includes('<script>'));
  assert.equal(f.c.window.attacked,undefined);
 });
}
for(const value of [null,undefined,'','   ','null','undefined','N/A','n/a','[object Object]','{}','{ }','[]','[ ]',[],{},['value'],{nested:'value'},true,false,NaN,Infinity])test('unusable detail scalar hidden: '+String(value),()=>{
 for(const [category,fields] of Object.entries(definitions)){
  const details=Object.fromEntries(fields.map(([key])=>[key,value]));assert.deepEqual(fixture().rows({category,details}),[]);
 }
});
for(const details of [null,undefined,[],['value'],'{"oem":"wrong"}',123])test('malformed details container hidden: '+JSON.stringify(details),()=>{
 assert.deepEqual(fixture().rows({category:'parts',details}),[]);
});
test('zero and unambiguous text remain unchanged; no numeric conversion or units invented',()=>{
 for(const [category,key] of [['parts','stock'],['moto','mileage'],['special','work_hours'],['bus','capacity'],['caravan','beds'],['trailer','load_capacity']]){
  for(const value of [0,500,'00500','500 km','10 / 20'])assert.deepEqual(fixture().rows({category,details:{[key]:value}}).map(([,v])=>v),[String(value)]);
 }
});
test('inherited JSON values and prototype category names are not public metadata',()=>{
 assert.deepEqual(fixture().rows({category:'parts',details:Object.create({oem:'PRIVATE'})}),[]);
 const f=fixture();f.c.__item={category:'__proto__',details:{oem:'PRIVATE'}};assert.deepEqual(f.rows(f.c.__item),[]);
});
test('P1.1F presentation preserved outside three P1.1G listing boundaries',()=>{
 const baseline=require('./helpers/seller-integration-baseline.cjs');
 const normalizedBase=baseline.withoutSellerPresentation(base);
 let normalized=baseline.withoutSellerPresentation(baseline.withBaselineOwnerDelete(html,base));
 for(const id of ['austa-v153b-all-real-listing-router','austa-v153c-real-listing-form-js','austa-v153d-14-category-media-js']){
  const pattern=new RegExp('<script id="'+id+'">[\\s\\S]*?</script>');
  assert.ok(pattern.test(base));normalized=normalized.replace(pattern,()=>normalizedBase.match(pattern)[0]);
 }
 assert.equal(normalized,normalizedBase);
});
test('P1.6 keeps Cars specs and canonical contact; Rent adds actual deposit only',()=>{
 const f=fixture(),old=vm.createContext({window:{}});vm.runInContext(technical,old);vm.runInContext(between(base,'function escapeHtml(value){','function maskedPhone(phone){'),old);
 for(const category of ['cars','rent']){
  const item={category,listing_type:category==='rent'?'rent':'sale',brand:'Mercedes-Benz',model:'E-Class',rental_type:'Aylıq',deposit:200,contact_name:'Əli',phone:'123'};
  old.__item=item;assert.deepEqual(f.rows(item).filter(([k])=>k!=='Depozit'),JSON.parse(vm.runInContext('JSON.stringify(specsFor(__item))',old)));
  assert.equal(f.c.window.__detail.sellerOf(item),vm.runInContext('sellerOf(__item)',old));
 }
});
test('Chromium: actual full detail DOM for all nine categories keeps malicious JSON inert',async()=>{
 const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const executablePath=process.env.AUSTA_TEST_CHROMIUM || '/tmp/category-chromium';
 if(!fs.existsSync(executablePath))throw new Error('ENVIRONMENT BLOCKED — test not executed: Chromium executable does not exist at '+executablePath);
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();await page.setContent('<main></main>');
  const runtime=require('./helpers/listing-detail-fixture.cjs');
  await page.addScriptTag({content:`window.AUSTA_SUPABASE={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(table){const q={select(){return q},eq(){return q},order(){return q},maybeSingle:async()=>({data:window.__item,error:null}),then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return q;}};
    window.AUSTA_V153={mediaConfig:()=>({table:'marketplace_listing_media',bucket:'marketplace-media'})};`});
  for(const code of [technical,fs.readFileSync(path.join(root,'assets/vehicle/vin.js'),'utf8'),fs.readFileSync(path.join(root,'assets/marketplace/listing-lifecycle.js'),'utf8'),runtime.moduleSource,runtime.block])await page.addScriptTag({content:code});
  for(const [category,fields] of Object.entries(definitions)){
   const value='<img src=x onerror="window.attacked=true"><script>window.attacked=true</script>';
   await page.evaluate(async({category,key,value})=>{
    document.getElementById('austaFinalListingPage')?.remove();
    globalThis.__item={id:'listing',status:'active',title:'Public listing',category,details:{[key]:value,legacy_internal_note:'PRIVATE'}};
    await window.AUSTA_LISTING_DETAIL.open('listing','marketplace',category);
   },{category,key:fields[0][0],value});
   assert.equal(await page.locator('.austa-final-spec strong').first().textContent(),value);
   assert.equal(await page.locator('#austaFinalListingPage img, #austaFinalListingPage script').count(),0);
   assert.equal(await page.evaluate(()=>window.attacked),undefined);
   assert.ok(!(await page.locator('#austaFinalListingPage').textContent()).includes('PRIVATE'));
  }
 }finally{await browser.close()}
});
