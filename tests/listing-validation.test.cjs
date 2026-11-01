const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function loadFixture(file,marker,suffix,transform=s=>s){
 const filename=path.join(__dirname,file),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
 const code=transform(fs.readFileSync(filename,'utf8').split(marker)[0]);
 m._compile(code+'\nmodule.exports='+suffix+';',filename);return m.exports;
}
const publishFixture=loadFixture('listing-publish.test.cjs','const noSuccess=f=>','fixture',s=>s.replace('return {state,files,window,api,core,create,failure','return {context,state,files,window,api,core,create,failure'));
const formFixture=loadFixture('rent-rental-type.test.cjs','for(const value of values){','fixture');
const detailFixture=loadFixture('listing-details.test.cjs','for(const [type,keys] of Object.entries(fields)){','fixture');
const tableFor=type=>['cars','rent'].includes(type)?'vehicle_listings':['service','usta'].includes(type)?'service_provider_listings':'marketplace_listings';
const valid={brand:'Land Rover',model:'Range Rover Sport',year:2026,price:100,daily_price:50,phone:'123',name:'Name',title:'Title',specialty:'Engine'};
const managed=['owner_id','status','promotion_type','promotion_started_at','promotion_until','last_boosted_at','seller_profile_id','rating','reviews_count','has_video','created_at','updated_at','published_at'];
function setup(type='cars'){
 const f=publishFixture();
 for(const file of ['assets/vehicle/technical.js','assets/vehicle/vin.js','assets/marketplace/card-data.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),f.context);
 f.files.images=[{name:'photo.jpg',type:'image/jpeg',size:128}];f.files.videos=type==='plate'?[]:[{name:'clip.mp4',type:'video/mp4',size:256}];
 const stored={id:'existing',owner_id:'owner-1',status:'active',listing_type:type==='rent'?'rent':'sale',...valid,mileage:123,deposit:150,rental_type:type==='rent'?'Aylıq':null,vin:'1HGCM82633A004352',rating:4.8,reviews_count:57,has_video:false,details:{legacy:{keep:[1,2]}}};
 return Object.assign(f,{stored,async createValid(patch={}){return f.create(type,{...valid,...patch});},async edit(patch={}){if(!f.state.tables[tableFor(type)].length)f.state.tables[tableFor(type)].push({...stored});return f.api.updateListing(type,'existing',patch);}});
}
const assertNoWrite=f=>{
 assert.ok(!f.state.ops.some(o=>['insert','update','upload','delete','remove'].includes(o.op)),JSON.stringify(f.state.ops));
 assert.equal(f.state.events.length,0);assert.equal(f.state.objects.size,0);
};
const invalid=['abc',NaN,Infinity,-Infinity,false,true,[],{},'0x10','NaN','Infinity'];
for(const type of ['cars','rent'])for(const key of ['year','mileage',type==='cars'?'price':'daily_price','deposit'])for(const value of invalid){
 for(const op of ['create','edit'])test(`${type} ${op} ${key} rejects ${String(value)} / ${typeof value} before persistence/media`,async()=>{
  const f=setup(type);await assert.rejects(op==='create'?f.createValid({[key]:value}):f.edit({[key]:value}));assertNoWrite(f);
 });
}
for(const [year,accepted] of [[1899,false],[1900,true],[2100,true],[2101,false],[2026.7,false],['2026.7',false]])for(const op of ['create','edit'])test(`Vehicle ${op} year ${year}: ${accepted?'accept':'reject'}`,async()=>{
 const f=setup();if(accepted){await(op==='create'?f.createValid({year}):f.edit({year}));assert.equal(f.state.tables.vehicle_listings[0].year,year);}else{await assert.rejects(op==='create'?f.createValid({year}):f.edit({year}));assertNoWrite(f);}
});
for(const type of ['cars','rent'])for(const [key,value] of [['mileage',-1],['mileage',1.5],['price',-1],['daily_price',-1],['deposit',-1]])test(`${type} rejects ${key}=${value}`,async()=>{
 const f=setup(type);await assert.rejects(f.createValid({[key]:value}));assertNoWrite(f);
});
for(const type of ['cars','rent'])for(const key of ['brand','model','year',type==='cars'?'price':'daily_price'])for(const value of [undefined,null,'','  '])test(`${type} required ${key}=${String(value)}`,async()=>{
 const f=setup(type);await assert.rejects(f.createValid({[key]:value,...(key==='daily_price'&&value===undefined?{price:undefined,dailyPrice:undefined}:{})}));assertNoWrite(f);
});
for(const type of ['cars','rent'])test(`${type}: zero price/mileage/deposit and boundary values persist without falsy loss`,async()=>{
 const f=setup(type);await f.createValid({price:0,daily_price:0,mileage:'0',deposit:0,year:'1900'});
 const row=f.state.tables.vehicle_listings[0];assert.equal(row.year,1900);assert.equal(row.mileage,0);assert.equal(row[type==='rent'?'daily_price':'price'],0);if(type==='rent')assert.equal(row.deposit,0);
 assert.equal(row.status,'active');assert.equal(f.state.ops.find(o=>o.op==='insert').row.status,'draft');
});
for(const type of ['cars','rent'])test(`${type}: absent/undefined update preserves required, nullable and VIN columns`,async()=>{
 const f=setup(type);f.files.images=[];f.files.videos=[];
 await f.edit({phone:'456',brand:undefined,model:undefined,year:undefined,price:undefined,daily_price:undefined,mileage:undefined,deposit:undefined,vin:undefined,rental_type:undefined});
 const update=f.state.ops.find(o=>o.op==='update').row;
 for(const k of ['brand','model','year','price','daily_price','mileage','deposit','vin','rental_type'])assert.ok(!Object.hasOwn(update,k),k);
 const stored=f.state.tables.vehicle_listings[0];assert.equal(stored.vin,f.stored.vin);assert.equal(stored.mileage,123);assert.equal(stored.year,2026);
});
for(const value of [null,'','   '])test(`Rent nullable mileage/deposit/coords explicit clear ${String(value)}`,async()=>{
 const f=setup('rent');f.files.images=[];f.files.videos=[];await f.edit({deposit:value,mileage:value,latitude:value,longitude:value});
 for(const key of ['deposit','mileage','latitude','longitude'])assert.equal(f.state.tables.vehicle_listings[0][key],null);
});
for(const value of ['Günlük','Həftəlik','Aylıq','Uzunmüddətli'])test(`Rent rental_type canonical ${value}`,async()=>{
 const f=setup('rent');await f.createValid({rental_type:value});assert.equal(f.state.tables.vehicle_listings[0].rental_type,value);
});
for(const type of ['cars','rent'])test(`${type}: rental_type rejects unsupported/forbidden value`,async()=>{
 const f=setup(type);await assert.rejects(f.createValid({rental_type:type==='cars'?'Günlük':'Yearly'}));assertNoWrite(f);
});
for(const value of ['INVALID','1HGCM82633A00435I','1HGCM82633A00435O','1HGCM82633A00435Q',123,false])for(const op of ['create','edit'])test(`VIN ${op} rejects ${value}`,async()=>{
 const f=setup();await assert.rejects(op==='create'?f.createValid({vin:value}):f.edit({vin:value}));assertNoWrite(f);
});
test('VIN production regex, existing normalization and nullable clear retained',async()=>{
 const f=setup();await f.createValid({vin:' 1hgcm82633a004352 '});assert.equal(f.state.tables.vehicle_listings[0].vin,'1HGCM82633A004352');
 const edit=setup();edit.files.images=[];edit.files.videos=[];await edit.edit({vin:null});assert.equal(edit.state.tables.vehicle_listings[0].vin,null);
});
for(const [key,value] of [['engine_volume',0],['engine_volume','abc'],['horsepower',1.5],['seats',1.5],['drivetrain','unknown'],['vehicle_condition','unknown'],['market','unknown'],['credit_available','yes']])test(`existing technical contract rejects ${key}`,async()=>{
 const f=setup();await assert.rejects(f.createValid({[key]:value}));assertNoWrite(f);
});
for(const type of ['parts','accessories','special','moto','plate','bus','trailer','water','caravan']){
 test(`${type}: canonical Marketplace, separate multi-word identity and opaque JSON numbers`,async()=>{
  const f=setup(type);const details={mileage:'100 km',work_hours:'five',capacity:'20 / 30',beds:'two',load_capacity:'500 kg'};
  await f.createValid({details,year:-1});const row=f.state.tables.marketplace_listings[0];
  assert.equal(row.brand,'Land Rover');assert.equal(row.model,'Range Rover Sport');assert.equal(row.year,-1);assert.equal(row.category,type);
  assert.deepEqual(JSON.parse(JSON.stringify(row.details)),details);assert.equal(f.state.ops.find(o=>o.op==='insert').row.status,'inactive');
 });
}
for(const key of ['price','year'])for(const value of [...invalid,-1.5])for(const op of ['create','edit'])test(`Marketplace ${op} ${key} rejects ${String(value)} / ${typeof value}`,async()=>{
 const f=setup('parts');await assert.rejects(op==='create'?f.createValid({[key]:value}):f.edit({[key]:value}));assertNoWrite(f);
});
test('Marketplace supplied negative price rejects; no invented year range',async()=>{
 const f=setup('parts');await assert.rejects(f.createValid({price:-1}));assertNoWrite(f);
 for(const year of [0,1800,2201,-100]){const f=setup('parts');await f.createValid({year});assert.equal(f.state.tables.marketplace_listings[0].year,year);}
});
test('unknown category/provider_type rejects before INSERT',async()=>{
 const f=setup('parts');await assert.rejects(f.create('not-a-category',valid));assertNoWrite(f);
 const p=setup('service');await assert.rejects(p.createValid({provider_type:'attacker'}));assertNoWrite(p);
});
for(const type of ['service','usta']){
 test(`${type}: independent specialty/services; attacker reputation ignored on create and update`,async()=>{
  const f=setup(type);await f.createValid({specialty:'Engine',services:'Brakes',rating:5,reviews_count:100000,reviews:42});
  const insert=f.state.ops.find(o=>o.op==='insert').row;assert.equal(insert.specialty,'Engine');assert.equal(insert.services,'Brakes');
  for(const key of ['rating','reviews_count','reviews'])assert.ok(!Object.hasOwn(insert,key));
  const edit=setup(type);edit.files.images=[];edit.files.videos=[];await edit.edit({services:'Oil',rating:0,reviews_count:0,reviews:0});
  const row=edit.state.tables.service_provider_listings[0];assert.equal(row.rating,4.8);assert.equal(row.reviews_count,57);assert.equal(row.specialty,'Engine');assert.equal(row.services,'Oil');
 });
 for(const key of ['phone','specialty','identity'])test(`${type}: create requires ${key} from form contract`,async()=>{
  const f=setup(type),patch=key==='identity'?{name:undefined,title:undefined,service_name:undefined}:{[key]:''};await assert.rejects(f.createValid(patch));assertNoWrite(f);
 });
}
for(const type of ['cars','rent','parts','service','usta'])for(const op of ['create','edit'])test(`${type} ${op}: system fields have no form authority`,async()=>{
 const f=setup(type),patch=Object.fromEntries(managed.map(k=>[k,'ATTACK']));patch.hasVideo=true;patch.reviews=10000;
 if(op==='create')await f.createValid(patch);else{f.files.images=[];f.files.videos=[];await f.edit(patch);}
 const write=f.state.ops.find(o=>o.op===(op==='create'?'insert':'update')).row;
 for(const key of managed){assert.notEqual(write[key],'ATTACK',key);if(op==='edit'&&!['has_video'].includes(key))assert.ok(!Object.hasOwn(write,key),key);}
 if(op==='create'){assert.equal(write.owner_id,'owner-1');assert.equal(write.status,['cars','rent'].includes(type)?'draft':'inactive');assert.equal(write.promotion_type,'standard');}
 if(op==='edit'&&['cars','rent'].includes(type))assert.ok(!Object.hasOwn(write,'has_video'));
});
for(const type of ['cars','parts','service'])for(const key of ['latitude','longitude'])for(const value of [NaN,Infinity,-Infinity,'abc',false])test(`${type} invalid ${key} rejected without range invention`,async()=>{
 const f=setup(type);await assert.rejects(f.createValid({[key]:value}));assertNoWrite(f);
});
test('finite coordinates are not subject to invented geographic ranges',async()=>{
 const f=setup();await f.createValid({latitude:999,longitude:-999});assert.equal(f.state.tables.vehicle_listings[0].latitude,999);assert.equal(f.state.tables.vehicle_listings[0].longitude,-999);
});
for(const type of ['cars','rent'])for(const key of ['year',type==='cars'?'price':'daily_price','deposit'])for(const value of (key==='year'?['abc',Infinity,false,2026.7]:['abc',Infinity,false]))test(`raw ${type} form ${key} ${String(value)} checked before numeric coercion`,async()=>{
 const f=formFixture({type});assert.throws(()=>f.input({[key]:value}));assert.ok(!f.state.ops.some(o=>['insert','update'].includes(o.op)));
});
test('form required numeric zero is accepted; sparse form edit preserves absent numeric keys',()=>{
 const f=formFixture({type:'cars'}),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const fn=html.match(/function validate\(type,data\)\{([\s\S]*?)\n\}/)[0];
 const validate=new Function(fn+';return validate;')();assert.doesNotThrow(()=>validate('cars',{phone:'123',brand:'BMW',model:'X5',year:2026,price:0}));
 f.form.setEdit();const input=f.form.buildRouterInput('cars',{phone:'123'});for(const key of ['year','price','deposit'])assert.equal(input[key],undefined);
});
const dealerRequired={dealer_name:'Salon',phone:'123',region:'Bakı',address:'Street'};
const bools=['credit_available','leasing_available','barter_available','delivery_available'];
function dealer(){const f=detailFixture('dealer',{legacy:{keep:[1,2]}});Object.assign(f.state.row,dealerRequired,...bools.map(k=>({[k]:true})),{vehicle_condition:'LEGACY CONDITION'});return f;}
for(const key of bools)for(const [value,expected] of [[true,true],[false,false],['true',true],['false',false],['Bəli',true],['Xeyr',false],['',false],[1,true],[0,false]])test(`Dealer ${key} ${JSON.stringify(value)} parsed explicitly`,async()=>{
 const f=dealer();f.setFields({...dealerRequired,[key]:value});await f.dealer.updateDealer({id:'listing'});assert.equal(f.state.row[key],expected);
});
for(const key of bools)for(const value of ['garbage',null,NaN,{},[]])for(const op of ['create','edit'])test(`Dealer ${op} invalid boolean ${key} ${String(value)} fails before write/media`,async()=>{
 const f=dealer();f.setFields({...dealerRequired,[key]:value});await assert.rejects(op==='create'?f.dealer.saveDealer({}):f.dealer.updateDealer({id:'listing'}));assert.ok(!f.state.ops.some(o=>['insert','update'].includes(o.op)));
});
for(const key of bools)test(`Dealer absent ${key} preserves existing true and legacy condition`,async()=>{
 const f=dealer();f.setFields(dealerRequired);await f.dealer.updateDealer({id:'listing'});assert.equal(f.state.row[key],true);assert.equal(f.state.row.vehicle_condition,'LEGACY CONDITION');
});
for(const op of ['create','edit'])test(`Dealer ${op} system metadata is not form authority`,async()=>{
 const f=dealer();f.setFields({...dealerRequired,...Object.fromEntries(managed.map(k=>[k,'ATTACK']))});
 await(op==='create'?f.dealer.saveDealer({}):f.dealer.updateDealer({id:'listing'}));const row=f.state.ops.find(o=>o.op===(op==='create'?'insert':'update')).row;
 for(const key of managed)assert.notEqual(row[key],'ATTACK',key);
});
test('Dealer create condition canonical only; untouched legacy update retained',async()=>{
 const f=dealer();f.setFields({...dealerRequired,vehicle_condition:'LEGACY CONDITION'});await assert.rejects(f.dealer.saveDealer({}));assert.ok(!f.state.ops.some(o=>o.op==='insert'));
 for(const value of ['Yeni','Sürülmüş','Yeni və sürülmüş']){const f=dealer();f.setFields({...dealerRequired,vehicle_condition:value});await f.dealer.saveDealer({});assert.equal(f.state.row.vehicle_condition,value);}
});
test('P0.3.1 helper, visibility, public queries and protected runtime assets remain byte-identical',()=>{
 const base='19c91a76502dad439811fa86d95af0fac922c88a',html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const main=cp.execFileSync('git',['show',base+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:1e7});
 for(const id of ['austa-v154e-global-promotion-pagination']){
  const re=new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>');assert.equal(html.match(re)[0],main.match(re)[0]);
 }
 const changed=cp.execFileSync('git',['diff','--name-only',base,'--','assets','backend'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
 assert.deepEqual(changed.filter(p=>!['assets/marketplace/seller-intent.js','assets/marketplace/media-manager.js','assets/marketplace/listing-preview.js','assets/marketplace/listing-lifecycle.js','backend/a-usta56/tests/listing-media.test.ts'].includes(p)),[]);
 // Permit only the reviewed supplemental seller block; all original detail logic remains exact.
 const detail=s=>s.match(/<script id="austa-final-full-listing-js">([\s\S]*?)<\/script>/)[1];
 const normalized=detail(require('./helpers/seller-integration-baseline.cjs').withBaselineMediaHydration(html,main))
  .replace('const sellerIdentityReady=Promise.resolve(window.AUSTA_SELLER_IDENTITY?.hydrate([item]));','void window.AUSTA_SELLER_IDENTITY?.hydrate([item]);')
  .replace('              <div data-professional-seller></div>\n','')
  .replace(`  void sellerIdentityReady.then(()=>{
    if(!page.isConnected)return;
    const target=page.querySelector('[data-professional-seller]');
    if(target)target.innerHTML=window.AUSTA_SELLER_INTENT?.detail(item)||'';
  }).catch(()=>{});\n`,'');
 assert.equal(normalized,detail(main));
});
test('legacy num()/integer() unchanged and no arbitrary text maximum added',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),main=cp.execFileSync('git',['show','19c91a76502dad439811fa86d95af0fac922c88a:index.html'],{cwd:root,encoding:'utf8',maxBuffer:1e7});
 const part=s=>s.slice(s.indexOf('function num(value) {'),s.indexOf('function bool(value) {',s.indexOf('function num(value) {')));assert.equal(part(html),part(main));
 assert.deepEqual(html.match(/maxlength\s*=[^ >]+/g),main.match(/maxlength\s*=[^ >]+/g));
});
test('invalid actual form save cannot INSERT/upload/activate or report success',async()=>{
 const f=setup(),form=f.installForm();f.state.formType='cars';f.window.__formInput={...valid,year:'abc'};
 await form.save();assertNoWrite(f);assert.ok(!f.status.textContent.includes('uğurla'));assert.equal(f.state.removed,0);
});
test('Dealer invalid boolean stops the real shared publish/media pipeline',async()=>{
 const f=setup('cars'),values={...dealerRequired,credit_available:'not-a-boolean'};
 f.context.document.querySelectorAll=selector=>selector==='#austaV153CFields [data-v153c-key]'?Object.entries(values).map(([key,value])=>({dataset:{v153cKey:key},value})):[];
 await assert.rejects(f.create('dealer'));assertNoWrite(f);
});
test('no invented fuel/transmission/body/color enum; monetary fractions and decimals remain legal',async()=>{
 const f=setup();await f.createValid({price:'12.75',engine_volume:'3.0',horsepower:367,seats:5,fuel_type:'Legacy fuel',transmission:'Legacy gearbox',body_type:'Legacy body',color:'Custom paint'});
 const row=f.state.tables.vehicle_listings[0];assert.equal(row.price,12.75);assert.equal(row.engine_volume,3);assert.equal(row.horsepower,367);assert.equal(row.fuel_type,'Legacy fuel');
});
for(const value of ['2026.00000000000000001','2026e-1000','1.00000000000000000001'])test(`fractional integer string cannot round to an integer: ${value}`,async()=>{
 const f=setup();await assert.rejects(f.createValid({year:value}));assertNoWrite(f);
 const m=setup('parts');await assert.rejects(m.createValid({year:value}));assertNoWrite(m);
});
test('numeric parser explicitly distinguishes absent, blank, valid and invalid',()=>{
 const f=setup(),parse=f.api.listingNumber;
 assert.equal(parse(undefined,'test'),undefined);assert.equal(parse(null,'test'),null);assert.equal(parse('  ','test'),null);assert.equal(parse(' 12.5 ','test'),12.5);assert.equal(parse('20260e-1','test',{integer:true}),2026);
 for(const value of [false,'abc',NaN,Infinity,-Infinity,'1e-1000'])assert.throws(()=>parse(value,'test'));
});
for(const patch of [{daily_price:null,dailyPrice:20,price:30},{daily_price:'',price:30},{daily_price:50,dailyPrice:'abc'}])test(`Rent aliases cannot hide invalid supplied canonical/alias values: ${JSON.stringify(patch)}`,async()=>{
 const f=setup('rent');await assert.rejects(f.createValid(patch));assertNoWrite(f);
});
test('no invented listing text maximum',async()=>{
 const f=setup('parts'),description='x'.repeat(100001);await f.createValid({description});assert.equal(f.state.tables.marketplace_listings[0].description,description);
});
test('P1.3A preserves source configuration, Vehicle video helper and P0.3 coordinator',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),main=cp.execFileSync('git',['show','origin/main:index.html'],{cwd:root,encoding:'utf8',maxBuffer:1e7});
 const block=s=>s.match(/<script id="austa-v153d-14-category-media-js">([\s\S]*?)<\/script>/)[1];
 const segments=s=>{const parts=[...block(s).matchAll(/\n(?:async )?function (\w+)\(/g)];return new Map(parts.map((m,i)=>[m[1],block(s).slice(m.index,parts[i+1]?.index||block(s).length)]));};
 const before=segments(main),after=segments(html);
 for(const name of ['mediaConfig','syncVehicleHasVideo'])assert.equal(after.get(name),before.get(name),name);
 const publish=s=>s.slice(s.indexOf('const user=await currentUser();',s.indexOf('window.AUSTA_V153.saveListing = async')),s.indexOf('// Only completed activation'));
 const normalizedPublish=s=>publish(s).replace('saveDealer(attempt,sellerIntent,approved?.values)','saveDealer(attempt,sellerIntent)');
 assert.equal(normalizedPublish(html),normalizedPublish(main));
 const file='assets/marketplace/listing-publish.js';
 assert.equal(fs.readFileSync(path.join(root,file),'utf8'),cp.execFileSync('git',['show','origin/main:'+file],{cwd:root,encoding:'utf8'}));
});
