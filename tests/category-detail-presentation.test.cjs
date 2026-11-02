const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
// Immutable reviewed pre-P1.6 contract, not the moving merged main ref.
const historicalBase='b79d65485cad6ad27b5bbfb62536e0d728907936';
const base=cp.execFileSync('git',['show',historicalBase+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:1e7});
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
 // Compare reviewed P1.1G/form/media changes directly to their immutable merged
 // P1.6 bytes. Never replace a whole script to hide changes from this assertion.
 const approved=cp.execFileSync('git',['show','745d6ee87813a83003731ee2026e9814bd510e57:index.html'],{cwd:root,encoding:'utf8',maxBuffer:1e7});
 const pattern=/(<script id="(?:austa-v153b-all-real-listing-router|austa-v153c-real-listing-form-js|austa-v153d-14-category-media-js)">[\s\S]*?<\/script>)/;
 const current=normalized.split(pattern),historical=normalizedBase.split(pattern),reviewed=baseline.withoutSellerPresentation(baseline.withBaselineOwnerDelete(approved,base)).split(pattern);
 assert.equal(current.length,7);assert.equal(historical.length,7);assert.equal(reviewed.length,7);
 const digest=value=>require('node:crypto').createHash('sha256').update(value).digest('hex');
 for(let i=0;i<current.length;i++)assert.equal(digest(current[i]),digest(i%2?reviewed[i]:historical[i]),'protected page/script segment '+i);
});
test('P1.6 keeps Cars specs and canonical contact; Rent adds actual deposit only',()=>{
 const f=fixture(),old=vm.createContext({window:{}});vm.runInContext(technical,old);vm.runInContext(between(base,'function escapeHtml(value){','function maskedPhone(phone){'),old);
 for(const category of ['cars','rent']){
  const item={category,listing_type:category==='rent'?'rent':'sale',brand:'Mercedes-Benz',model:'E-Class',rental_type:'Aylıq',deposit:200,contact_name:'Əli',phone:'123'};
  old.__item=item;assert.deepEqual(f.rows(item).filter(([k])=>k!=='Depozit'),JSON.parse(vm.runInContext('JSON.stringify(specsFor(__item))',old)));
  assert.deepEqual(f.rows(item).filter(([k])=>k==='Depozit'),category==='rent'?[['Depozit','200 AZN']]:[]);
  assert.equal(f.c.window.__detail.sellerOf(item),vm.runInContext('sellerOf(__item)',old));
 }
});
// P2.A negative proofs change only isolated child-process reads, never files.
function mutationFails({file='index.html',from,to,gate,pattern}){
 const target=path.join(root,file);
 assert.ok(fs.readFileSync(target,'utf8').includes(from),'mutation target exists');
 const bootstrap=[
  "const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');",
  'const read=fs.readFileSync,target='+JSON.stringify(target)+',from='+JSON.stringify(from)+',to='+JSON.stringify(to)+';let hits=0;',
  "fs.readFileSync=function(file,options){const value=read.apply(this,arguments);const name=file instanceof URL?require('node:url').fileURLToPath(file):String(file);if(path.resolve(name)!==target)return value;const text=String(value);assert.ok(text.includes(from),'mutation target disappeared');hits++;const changed=text.replace(from,to);return typeof value==='string'?changed:Buffer.from(changed);};",
  "process.on('beforeExit',()=>assert.ok(hits>0,'mutation was not exercised'));",
  'require('+JSON.stringify(path.join(root,gate))+');'
 ].join('\n');
 const env={...process.env,P2A_CHILD:'1'};delete env.NODE_TEST_CONTEXT;
 const run=cp.spawnSync(process.execPath,['--test-reporter=tap','--test-name-pattern='+pattern,'-e',bootstrap],{cwd:root,env,encoding:'utf8',maxBuffer:2e6});
 assert.equal(run.signal,null,'mutation child terminated');
 assert.notEqual(run.status,0,'mutant escaped: '+pattern);
 assert.match(run.stdout,/not ok /,'must fail a real regression test');
 assert.match(run.stdout,/AssertionError/,'must fail its assertion, not tooling');
 assert.doesNotMatch(run.stdout+run.stderr,/Cannot find (?:module|package)|ENVIRONMENT BLOCKED|mutation target disappeared|mutation was not exercised/);
}
function currentFixture(){
 const runtime=require('./helpers/listing-detail-fixture.cjs');
 const block=runtime.block.replace(/\}\)\(\);\s*$/,"window.__p2aCurrent={businessOf,detailInformation,closePage,teardownDetail,openFullListing};})();");
 return runtime.fixture({block});
}
test('P2.A current businessOf contract',()=>{
 assert.equal(html.split('function businessOf(item){').length-1,1,'business parameter/existence');
 const f=currentFixture(),business=f.window.__p2aCurrent.businessOf;
 for(const [category,expected] of [['dealer','Salon'],['service','Servis'],['usta',''],['cars',''],['rent',''],['parts','']]){
  assert.equal(business({category,dealer_name:'Salon',name:'Servis',contact_name:'PRIVATE',details:{owner_name:'PRIVATE'}}),expected,category);
 }
 assert.equal(business({category:'dealer',dealer_name:' N/A ',name:'WRONG'}),'');
 require('./helpers/seller-integration-baseline.cjs').currentContracts(html);
});
test('P2.A current lifecycle state accessor contract',()=>{
 const helper=require('./helpers/seller-integration-baseline.cjs'),part=helper.currentLifecycleContracts(html);
 assert.equal(part.current.length,1);const source=part.current[0].source;
 let calls=0;const expected={revision:7};
 assert.equal(vm.runInNewContext('({'+source+'}).state()',{window:{AUSTA_MY_LIFECYCLE:{state(){calls++;return expected;}}}}),expected);
 assert.equal(calls,1);assert.equal(vm.runInNewContext('({'+source+'}).state()',{window:{}}),undefined);
 assert.throws(()=>helper.currentLifecycleContracts(html.replace(source,'')),/P2.A current/);
 assert.throws(()=>helper.currentLifecycleContracts(html+'\n'+source),/P2.A current/);
 assert.throws(()=>helper.currentLifecycleContracts(html.replace(source,source.replace('?.state()','?.wrong()'))),/P2.A current/);
});
test('P2.A current closePage and extracted cleanup contract',async()=>{
 assert.equal(html.split('function closePage(event){').length-1,1,'close parameter/existence');
 // Check hook identity before invoking code, so a recursive/wrong hook cannot
 // count as a meaningful mutation failure via a stack overflow.
 assert.equal(html.split('render:renderResolvedListing,close:teardownDetail});').length-1,1,'cleanup hook');
 const f=currentFixture(),event={};let seen;
 const original=f.window.AUSTA_LISTING_DETAIL;
 f.window.AUSTA_LISTING_DETAIL={...original,close(value){seen=value;return 'forwarded';}};
 assert.equal(f.window.__p2aCurrent.closePage(event),'forwarded');assert.equal(seen,event);
 f.window.AUSTA_LISTING_DETAIL=original;
 await f.open();const page=f.page(),calls=[];
 f.location.hash='#listing=listing';
 f.window.__p2aCurrent.teardownDetail({preventDefault(){calls.push('prevent');},stopPropagation(){calls.push('stop');},stopImmediatePropagation(){calls.push('immediate');}});
 assert.deepEqual(calls,['prevent','stop','immediate']);assert.equal(page.isConnected,false);
 assert.equal(f.document.body.style.overflow,'');assert.equal(f.location.hash,'');
 require('./helpers/seller-integration-baseline.cjs').currentContracts(html);
});
test('P2.A current information and detail forwarding contract',()=>{
 assert.equal(html.split('function detailInformation(item){').length-1,1);
 assert.equal(html.split('async function openFullListing(id,source,expectedCategory){').length-1,1);
 const f=currentFixture(),info=f.window.__p2aCurrent.detailInformation({id:'<private-id>',status:'archived'});
 assert.match(info,/ELAN MƏLUMATI/);assert.match(info,/&lt;private-id&gt;/);assert.match(info,/Arxivdə/);
 let seen;f.window.AUSTA_LISTING_DETAIL={open(...args){seen=args;return 'opened';}};
 return Promise.resolve(f.window.__p2aCurrent.openFullListing('id','marketplace','parts')).then(value=>{
  assert.equal(value,'opened');assert.deepEqual(seen,['id','marketplace','parts']);
  require('./helpers/seller-integration-baseline.cjs').currentContracts(html);
 });
});
test('P2.A current seller-link and lifecycle components contract',async()=>{
 const f=currentFixture();let opened;
 f.state.profile={id:'seller',display_name:'Dealer',business_type:'dealer',status:'active',verification_status:'verified',official_status:'none'};
 f.window.AUSTA_SELLER_PAGE={open(id){opened=id;}};
 await f.open('vehicle',{seller_profile_id:'seller'});
 const link=f.page().querySelector('[data-professional-seller]').children[0];
 assert.equal(link.textContent,'Satıcının səhifəsi');await link.emit('click');
 assert.equal(opened,'seller');assert.equal(f.page(),null);
 f.state.user='owner';await f.open('vehicle');
 assert.match(f.markup(),/data-owner-lifecycle="archive"/);assert.match(f.markup(),/data-owner-lifecycle="mark_sold"/);
 await f.open('vehicle',{status:'archived'});
 assert.match(f.markup(),/data-owner-lifecycle="reactivate"/);assert.doesNotMatch(f.markup(),/data-owner-lifecycle="mark_sold"/);
 require('./helpers/seller-integration-baseline.cjs').currentContracts(html);
 const moduleFile='assets/marketplace/listing-detail.js';
 assert.equal(fs.readFileSync(path.join(root,moduleFile),'utf8'),cp.execFileSync('git',['show','745d6ee87813a83003731ee2026e9814bd510e57:'+moduleFile],{cwd:root,encoding:'utf8'}));
});
if(!process.env.P2A_CHILD){
 const categoryGate='tests/category-detail-presentation.test.cjs',legacyGate='tests/listing-metadata-partial.test.cjs';
 const matrix=[
  ['category field removed',{from:"['oem','OEM / kod'],",to:'',gate:categoryGate,pattern:'parts: all canonical JSON'}],
  ['unrelated detail runtime changed',{from:"function maskedPhone(phone){",to:"function maskedPhone(phone){ return 'WRONG';",gate:categoryGate,pattern:'P1.1F presentation preserved'}],
  ['protected publish coordinator changed',{from:'// P0.2: Marketplace video authority is the persisted relation, never form state.',to:'// Unexpected coordinator boundary change.',gate:categoryGate,pattern:'P1.1F presentation preserved'}],
  ['Rent deposit removed',{from:"['Depozit',item.listing_type",to:"['WRONG',item.listing_type",gate:categoryGate,pattern:'P1.6 keeps Cars'}],
  ['Rent deposit wrong field',{from:"vehicleText(item.deposit)+' AZN'",to:"vehicleText(item.price)+' AZN'",gate:categoryGate,pattern:'P1.6 keeps Cars'}],
  ['Marketplace sync weakened',{from:'return data.length > 0;',to:'return false;',gate:'tests/marketplace-has-video.test.cjs',pattern:'explicit false/stale form input'}],
  ['Marketplace metadata authority',{from:'has_video: await marketplaceHasVideo(listingId)',to:'has_video: Boolean(input.has_video)',gate:'tests/marketplace-has-video.test.cjs',pattern:'explicit false/stale form input'}],
  ['undefined becomes false',{from:'Object.assign(row,window.AUSTA_MARKETPLACE_CARD_DATA.salePayload(type,input),window.AUSTA_VEHICLE_VIN.payload(type,input));',to:'Object.assign(row,window.AUSTA_MARKETPLACE_CARD_DATA.salePayload(type,input),window.AUSTA_VEHICLE_VIN.payload(type,input)); row.has_video=Boolean(input.has_video);',gate:legacyGate,pattern:'existing Vehicle technical partial update retained'}],
  ['lifecycle load wrapper',{from:"return window.AUSTA_MY_LIFECYCLE?.load(host || $('#austaMyListings'));",to:"window.__unexpected=true; return window.AUSTA_MY_LIFECYCLE?.load(host || $('#austaMyListings'));",gate:legacyGate,pattern:'protected scripts and modules unchanged'}],
  ['lifecycle transition wrapper',{from:'return await window.AUSTA_MY_LIFECYCLE.transition(item, action);',to:"return await window.AUSTA_MY_LIFECYCLE.transition(item, 'reactivate');",gate:legacyGate,pattern:'protected scripts and modules unchanged'}],
  ['lifecycle auth wiring',{from:'window.AUSTA_MY_LIFECYCLE?.bindAuth();',to:'/* auth invalidation removed */',gate:legacyGate,pattern:'protected scripts and modules unchanged'}],
  ['lifecycle page routing',{from:"if (page === 'listings') {",to:"if (page === 'wrong') {",gate:legacyGate,pattern:'protected scripts and modules unchanged'}],
  ['lifecycle DOM host binding',{from:"const host=document.getElementById('austaV39RealListingsHost');",to:"const host=document.getElementById('wrong');",gate:legacyGate,pattern:'protected scripts and modules unchanged'}],
  ['lifecycle parameter binding',{from:"load(host || $('#austaMyListings'))",to:"load(null)",gate:legacyGate,pattern:'protected scripts and modules unchanged'}],
  ['business removed',{from:require('./helpers/seller-integration-baseline.cjs').currentContracts(html).current.find(x=>x.name==='businessOf').source,to:'',gate:categoryGate,pattern:'P2.A current businessOf contract'}],
  ['business parameter',{from:'function businessOf(item){',to:'function businessOf(other){',gate:categoryGate,pattern:'P2.A current businessOf contract'}],
  ['business property',{from:"category==='dealer'?vehicleText(item.dealer_name):category==='service'?vehicleText(item.name):''",to:"category==='dealer'?vehicleText(item.contact_name):category==='service'?vehicleText(item.name):''",gate:categoryGate,pattern:'P2.A current businessOf contract'}],
  ['business condition',{from:"return category==='dealer'?vehicleText(item.dealer_name)",to:"return category==='parts'?vehicleText(item.dealer_name)",gate:categoryGate,pattern:'P2.A current businessOf contract'}],
  ['business return',{from:"return category==='dealer'?vehicleText(item.dealer_name):category==='service'?vehicleText(item.name):'';",to:"return 'WRONG';",gate:categoryGate,pattern:'P2.A current businessOf contract'}],
  ['business unrelated statement',{from:'function businessOf(item){',to:'function businessOf(item){ window.__unexpected=true;',gate:categoryGate,pattern:'P2.A current businessOf contract'}],
  ['close wrapper removed',{from:'function closePage(event){return window.AUSTA_LISTING_DETAIL.close(event);}',to:'',gate:categoryGate,pattern:'P2.A current closePage and extracted cleanup contract'}],
  ['close parameter',{from:'function closePage(event){',to:'function closePage(other){',gate:categoryGate,pattern:'P2.A current closePage and extracted cleanup contract'}],
  ['close event forwarding',{from:'return window.AUSTA_LISTING_DETAIL.close(event);',to:'return window.AUSTA_LISTING_DETAIL.close(null);',gate:categoryGate,pattern:'P2.A current closePage and extracted cleanup contract'}],
  ['close target',{from:'return window.AUSTA_LISTING_DETAIL.close(event);',to:"return 'wrong target';",gate:categoryGate,pattern:'P2.A current closePage and extracted cleanup contract'}],
  ['close cleanup relationship',{from:'render:renderResolvedListing,close:teardownDetail});',to:'render:renderResolvedListing,close:closePage});',gate:categoryGate,pattern:'P2.A current closePage and extracted cleanup contract'}],
  ['extracted cleanup changed',{from:'function teardownDetail(event){',to:'function teardownDetail(event){ return;',gate:categoryGate,pattern:'P2.A current closePage and extracted cleanup contract'}],
  ['information current value',{from:"const status=window.AUSTA_MY_LIFECYCLE?.statusLabel(item.status)",to:"const status=window.AUSTA_MY_LIFECYCLE?.statusLabel('active')",gate:categoryGate,pattern:'P2.A current information and detail forwarding contract'}],
  ['UNKNOWN NEW RUNTIME',{from:'function maskedPhone(phone){',to:'function unexpectedP2Mutation(){ return true; }\nfunction maskedPhone(phone){',gate:categoryGate,pattern:'P1.1F presentation preserved'}],
  ['current seller link routing',{from:'void window.AUSTA_SELLER_PAGE.open(profile.id);',to:"void window.AUSTA_SELLER_PAGE.open('wrong');",gate:categoryGate,pattern:'P2.A current seller-link and lifecycle components contract'}],
  ['current lifecycle state accessor',{from:'  state: () => window.AUSTA_MY_LIFECYCLE?.state(),',to:'  state: () => null,',gate:categoryGate,pattern:'P2.A current lifecycle state accessor contract'}],
  ['current lifecycle component action',{from:'data-owner-lifecycle="${escapeHtml(action)}"',to:'data-owner-lifecycle="wrong"',gate:categoryGate,pattern:'P2.A current seller-link and lifecycle components contract'}]
 ];
 for(const [name,proof] of matrix)test('P2.A mutation: '+name,()=>mutationFails(proof));
 test('P2.A every normalization has exact, fail-closed authority',()=>{
  const helper=require('./helpers/seller-integration-baseline.cjs');
  const old=cp.execFileSync('git',['show','19c91a76502dad439811fa86d95af0fac922c88a:index.html'],{cwd:root,encoding:'utf8',maxBuffer:1e7});
  const d=helper.withBaselineDetail(html,old),l=helper.withBaselineLifecycle(d,old);
  const inputs={detail:helper.currentContracts(html).historical,lifecycle:helper.currentLifecycleContracts(d).historical,ownerOld:l,ownerRecent:d,media:d,presentation:base,
   presentationOld:helper.withBaselineOwnerDelete(html,old),presentationRecent:helper.withBaselineOwnerDelete(html,base)};
  const entries=helper.inventory();assert.equal(entries.length,467);
  for(const r of entries){
   assert.equal(r.classification,'NARROW');assert.equal(r.failClosed,true);
   const text=inputs[r.helper],key=r.left+r.from+r.right,at=text.indexOf(key);
   assert.ok(at>=0,r.helper+' #'+r.index);assert.equal(text.indexOf(key,at+1),-1);
   assert.throws(()=>helper.verifyRecipe(text+'\n'+key,r.helper),/missing\/ambiguous/);
   assert.throws(()=>helper.verifyRecipe(text.slice(0,at)+text.slice(at+key.length),r.helper),/missing\/ambiguous/);
   const changed=text.slice(0,at)+'P2A_UNEXPECTED'+text.slice(at+key.length);
   assert.throws(()=>helper.verifyRecipe(changed,r.helper),/missing\/ambiguous/);
  }
  for(const [name,text] of Object.entries(inputs))assert.equal(typeof helper.verifyRecipe(text,name),'string');
  assert.throws(()=>helper.withBaselineLifecycle(d,old+'unexpected'),/unreviewed historical baseline/);
  assert.throws(()=>helper.withoutSellerPresentation(base.replace('seller-intent.js','wrong.js')),/unreviewed historical baseline/);
 });
 const rule=(left,from,to,right)=>({left,from,to,right});
 const insert=rule('a','','X','b');
 for(const [name,rules] of [
  ['duplicate insertion',[insert,insert]],
  ['same-position different insertions',[insert,{...insert,to:'Y'}]],
  ['resolved position collision',[insert,rule('a','','Z','bcd')]],
  ['ordinary overlapping spans',[rule('','ab','X','cd'),rule('a','bc','Y','d')]],
  ['ambiguous insertion/span boundary',[insert,rule('a','b','Y','')]]
 ])test('P2.A collision mutation: '+name,()=>assert.throws(()=>require('./helpers/seller-integration-baseline.cjs').verifyEdits('abcd',rules),/P2.A edit collision/));
 test('P2.A collision positive: adjacent non-empty edits',()=>{
  assert.equal(require('./helpers/seller-integration-baseline.cjs').verifyEdits('ab',[rule('','a','A','b'),rule('a','b','B','')]),'AB');
 });
 test('P2.A collision positive: unique insertion',()=>{
  assert.equal(require('./helpers/seller-integration-baseline.cjs').verifyEdits('ab',[insert]),'aXb');
 });
 test('P2.A structural current/historical boundary inventory',()=>{
  const helper=require('./helpers/seller-integration-baseline.cjs'),parts=helper.currentContracts(html);
  assert.deepEqual(parts.current.map(x=>x.name),['businessOf','detailInformation','closePage','openFullListing','detailModuleImport','detailStyle','sellerPageLink','lifecycleControls']);
  for(const unit of parts.current){
   const at=html.indexOf(unit.source);assert.ok(at>=0);
   assert.throws(()=>helper.currentContracts(html.slice(0,at)+html.slice(at+unit.source.length)),/P2.A current/,'missing '+unit.name);
   assert.throws(()=>helper.currentContracts(html+'\n'+unit.source),/P2.A current/,'duplicated '+unit.name);
   assert.throws(()=>helper.currentContracts(html.slice(0,at)+unit.source+' /* unexpected */'+html.slice(at+unit.source.length)),/P2.A current/,'changed '+unit.name);
  }
  for(const mode of new Set(helper.inventory().map(r=>r.helper))){
   const keys=helper.inventory().filter(r=>r.helper===mode).map(r=>r.left+r.from+r.right);
   assert.equal(new Set(keys).size,keys.length,'one authority key per recipe within '+mode);
  }
  for(const name of ['businessOf','detailInformation','closePage','openFullListing']){
   assert.ok(parts.current.find(x=>x.name===name).source.includes('function '+name+'('));
   assert.ok(!parts.historical.includes('function '+name+'('),'current-only unit has separate authority');
  }
  assert.ok(parts.historical.includes('function teardownDetail(event){'),'extracted historical cleanup stays compared');
  assert.ok(parts.historical.includes('async function renderResolvedListing(item,detailContext){'),'extracted historical render stays compared');
  for(const r of helper.inventory()){
   assert.doesNotMatch(r.from,/\b(?:async\s+)?function\s+\w+\([^)]*\)\s*\{[\s\S]*\}/,'no complete function deletion: '+r.helper+'#'+r.index);
   assert.ok(!r.from.includes('<script id=')||!r.from.includes('</script>'),'no inline script deletion');
  }
 });
}
test('Chromium: actual full detail DOM for all nine categories keeps malicious JSON inert',async()=>{
 const {chromium}=require('playwright');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
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
