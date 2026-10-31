const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const base=cp.execFileSync('git',['show','efffe4a7804f6ad1ca17001ba096970c8f5f692b:index.html'],{cwd:root,encoding:'utf8',maxBuffer:6000000});
const ids={router:'austa-v153b-all-real-listing-router',form:'austa-v153c-real-listing-form-js',media:'austa-v153d-14-category-media-js'};
const script=(text,id)=>text.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'))[1];
const json=value=>JSON.parse(JSON.stringify(value));
const fields={parts:['part_name','oem','compatibility','stock'],accessories:['accessory_name','stock'],moto:['moto_type','mileage'],special:['special_type','work_hours','sale_rent'],bus:['capacity','sale_rent'],water:['water_type','engine'],caravan:['caravan_type','beds','sale_rent'],trailer:['trailer_type','load_capacity'],plate:['plate_number','plate_series','document_status']};
const tableFor=type=>type==='dealer'?'auto_dealer_listings':['service','usta'].includes(type)?'service_provider_listings':['cars','rent'].includes(type)?'vehicle_listings':'marketplace_listings';
function fixture(type='parts',details={},options={}){
 const state={row:{id:'listing',owner_id:options.foreign?'other':'owner',status:'active',details:json(details),rating:4.8,reviews_count:57,latitude:40.4,longitude:49.8},ops:[],events:[],nodes:[],timers:[],formType:type};
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}}),getUser:async()=>({data:{user:{id:'owner'}}})},from(table){
  const q={op:'read',filters:[],select(columns){this.columns=columns;return this},eq(k,v){this.filters.push([k,v]);return this},limit(){return this},single(){return this},update(row){this.op='update';this.row=row;return this},insert(row){this.op='insert';this.row=row;return this},then(ok,bad){return Promise.resolve().then(()=>{
   state.ops.push({table,op:this.op,columns:this.columns,filters:this.filters,row:this.row&&json(this.row)});
   if(table==='marketplace_listing_media')return {data:[],error:null};
   assert.equal(table,tableFor(type));
   if(this.op==='insert'){state.row={id:'listing',...json(this.row)};return {data:json(state.row),error:null};}
   assert.ok(this.filters.some(([k,v])=>k==='id'&&v==='listing'));
   assert.ok(this.filters.some(([k,v])=>k==='owner_id'&&v==='owner'));
   if(!this.filters.every(([k,v])=>state.row[k]===v)||options.missing)return {data:null,error:{message:'private SDK details'}};
   if(this.op==='read'){
    assert.equal(this.columns,'details');
    if(options.failRead)return {data:null,error:{message:'SECRET SDK PATH'}};
    if(options.malformedRead)return {data:{},error:null};
    return {data:{details:json(state.row.details)},error:null};
   }
   if(options.failUpdate)return {data:null,error:{message:'update failed'}};
   Object.assign(state.row,json(this.row));return {data:json(state.row),error:null};
  }).then(ok,bad)}};return q;
 }};
 const status={style:{},textContent:''},button={disabled:false,textContent:''};
 const document={readyState:'loading',addEventListener(){},querySelectorAll(){return state.nodes},getElementById(id){
  if(id==='austaV153CCategory')return {value:state.formType};
  if(id==='austaV153CStatus')return status;
  if(id==='austaV153CSave')return button;
  return null;
 }};
 const window={AUSTA_SUPABASE:sb,dispatchEvent(e){state.events.push(e)},AUSTA_MARKETPLACE_CARD_DATA:{salePayload:()=>({})}};
 const context=vm.createContext({window,document,console:{log(){},warn(){},error(){}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},setTimeout(fn){state.timers.push(fn)},clearTimeout(){}});
 for(const f of ['assets/vehicle/technical.js','assets/vehicle/vin.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context);
 const text=options.source||html;
 vm.runInContext(script(text,ids.router),context);
 let form=script(text,ids.form),end=form.lastIndexOf('})();');
 form=form.slice(0,end)+`window.__form={fillEditFields,saveCurrentListing,buildRouterInput,readFields,setEdit(){currentEdit={id:'listing',type:document.getElementById('austaV153CCategory').value};}};`+form.slice(end);
 vm.runInContext(form,context);
 let media=script(text,ids.media);end=media.lastIndexOf('})();');
 media=media.slice(0,end)+'window.__dealer={updateDealer,saveDealer,installDealerCategory};'+media.slice(end);
 vm.runInContext(media,context);window.__dealer.installDealerCategory();
 const setFields=values=>{state.nodes=Object.entries(values).map(([key,value])=>({dataset:{v153cKey:key,v153cLabel:window.AUSTA_V153C.categories[type]?.fields.find(f=>f[0]===key)?.[1]},value}));};
 const update=patch=>window.AUSTA_V153.updateListing(type,'listing',{details:patch});
 return {state,window,api:window.AUSTA_V153,form:window.__form,dealer:window.__dealer,setFields,update,status};
}
for(const [type,keys] of Object.entries(fields)){
 test(type+': partial JSON update preserves absent known/unknown arrays and nested data',async()=>{
  const previous=Object.fromEntries(keys.map(k=>[k,'old-'+k]));previous.legacy_key='KEEP';previous.legacy_array=['A',{x:1}];previous.legacy_nested={a:{b:2}};
  const f=fixture(type,previous);await f.update({[keys[0]]:'changed'});
  assert.deepEqual(f.state.row.details,{...previous,[keys[0]]:'changed'});
  assert.equal(f.state.ops.filter(o=>o.op==='read'&&o.columns==='details').length,1);
 });
 for(const key of keys)test(type+': explicit '+key+' update only',async()=>{
  const f=fixture(type,{[key]:'old',unknown:'KEEP'});await f.update({[key]:'new'});assert.deepEqual(f.state.row.details,{[key]:'new',unknown:'KEEP'});
 });
 test(type+': form hydration → sparse edit → save preserves hidden JSON',async()=>{
  const previous={...Object.fromEntries(keys.map(k=>[k,'old-'+k])),name:'Seller',legacy_key:'KEEP',legacy_nested:{z:[1,2]}};
  const f=fixture(type,previous);f.setFields({name:'',phone:'123',price:'25',[keys[0]]:'',...(type==='plate'?{}:{brand:'BMW',model:'X5'})});
  f.form.fillEditFields({...f.state.row,title:'Listing',brand:'BMW',model:'X5',price:25,phone:'123'},type);
  f.state.nodes.find(n=>n.dataset.v153cKey===keys[0]).value='changed';
  f.form.setEdit();await f.form.saveCurrentListing();
  assert.ok(f.status.textContent.includes('yadda saxlanıldı'),f.status.textContent);
  assert.equal(f.state.row.details[keys[0]],'changed');
  for(const key of keys.slice(1))assert.equal(f.state.row.details[key],previous[key]);
  assert.equal(f.state.row.details.legacy_key,'KEEP');assert.deepEqual(f.state.row.details.legacy_nested,previous.legacy_nested);
 });
}
for(const value of [undefined,null,false,0,''])test('explicit '+String(value)+' does not conflate absent/falsy JSON values',async()=>{
 const f=fixture('parts',{stock:4,legacy:'KEEP'});await f.update({stock:value});
 assert.equal(f.state.row.details.stock,value===undefined?4:value);assert.equal(f.state.row.details.legacy,'KEEP');
});
for(const patch of [undefined,{}, {stock:undefined}, {uncontrolled:'ATTACK'}])test('empty/undefined/uncontrolled patch preserves JSON without a parent read: '+JSON.stringify(patch),async()=>{
 const f=fixture('parts',{stock:4,unknown:'KEEP'});await f.update(patch);
 assert.deepEqual(f.state.row.details,{stock:4,unknown:'KEEP'});assert.ok(!f.state.ops.some(o=>o.columns==='details'));
 assert.ok(!Object.hasOwn(f.state.ops.find(o=>o.op==='update').row,'details'));
});
for(const type of ['service','usta'])test(type+': existing provider JSON preserved while controlled field changes',async()=>{
 const f=fixture(type,{brands:'BMW',owner_name:'Contact',price_policy:'Ask',legacy:{value:[1,2]},'İxtisas':'Old'});
 const label=f.window.AUSTA_V153C.categories[type].fields.find(f=>f[0]==='specialty')[1];
 await f.update({[label]:'New'});assert.deepEqual(f.state.row.details.legacy,{value:[1,2]});
 assert.equal(f.state.row.details.brands,'BMW');assert.equal(f.state.row.details.owner_name,'Contact');assert.equal(f.state.row.details[label],'New');
 assert.equal(f.state.row.rating,4.8);assert.equal(f.state.row.reviews_count,57);assert.equal(f.state.row.latitude,40.4);
});
test('Service form canonical owner_name/brands/price_policy and label aliases',async()=>{
 const f=fixture('service',{owner_name:'A',brands:'BMW',price_policy:'Ask',unknown:'KEEP'});
 const patch=f.api.detailsFromForm('service',{name:'B',brands:'',price_policy:0});
 await f.update(patch);assert.equal(f.state.row.details.owner_name,'B');assert.equal(f.state.row.details.brands,'');assert.equal(f.state.row.details.price_policy,0);assert.equal(f.state.row.details.unknown,'KEEP');
});
test('dealer actual updater preserves unknown JSON and absent known keys',async()=>{
 const f=fixture('dealer',{brands:'BMW',credit_available:true,unknown:{nested:[1,2]}});
 f.setFields({dealer_name:'Salon',phone:'123',region:'Bakı',address:'Address',working_hours:'09–18'});
 await f.dealer.updateDealer(f.state.row);
 assert.equal(f.state.row.details.brands,'BMW');assert.equal(f.state.row.details.credit_available,true);assert.equal(f.state.row.details.working_hours,'09–18');assert.deepEqual(f.state.row.details.unknown,{nested:[1,2]});
 // P1.1E deliberately deferred: top-level Dealer boolean behavior is unchanged.
 assert.equal(f.state.row.credit_available,false);
});
test('dealer explicit Bəli/Xeyr preserves existing boolean conversion',async()=>{
 const f=fixture('dealer',{unknown:'KEEP',credit_available:true});f.setFields({dealer_name:'Salon',phone:'123',region:'Bakı',address:'Address',credit_available:'Xeyr',barter_available:'Bəli'});
 await f.dealer.updateDealer(f.state.row);assert.equal(f.state.row.details.credit_available,false);assert.equal(f.state.row.details.barter_available,true);assert.equal(f.state.row.details.unknown,'KEEP');
});
for(const type of ['parts','service','usta','dealer'])test(type+': rejects injected system keys and preserves existing protected metadata',async()=>{
 const f=fixture(type,{owner_id:'OLD',status:'OLD',seller_profile_id:'OLD',legacy:'KEEP'});
 const injection=JSON.parse('{"owner_id":"ATTACK","status":"active","promotion_type":"premium","verification_status":"verified","seller_profile_id":"ATTACK","official_status":"approved","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
 const result=await f.api.preserveDetails(type,'listing',{id:'owner'},injection);assert.equal(result,undefined);
 assert.equal(f.state.ops.length,0);assert.equal(f.state.row.details.owner_id,'OLD');assert.equal({}.polluted,undefined);
});
for(const value of [[],{},['B'],{owner_id:'ATTACK'}])test('unsupported structured stock patch rejected; existing array/nested JSON preserved: '+JSON.stringify(value),async()=>{
 const f=fixture('parts',{stock:[1,2],legacy:{a:3}});await assert.rejects(f.update({stock:value}));assert.deepEqual(f.state.row.details,{stock:[1,2],legacy:{a:3}});assert.ok(!f.state.ops.some(o=>o.op==='update'));
});
for(const value of [null,[],false,''])test('whole-details clear/invalid shape is not a universal clear: '+JSON.stringify(value),async()=>{
 const f=fixture('parts',{unknown:'KEEP'});await assert.rejects(f.update(value));assert.deepEqual(f.state.row.details,{unknown:'KEEP'});assert.ok(!f.state.ops.some(o=>o.op==='update'));
});
for(const details of [null,[],false,'legacy'])test('existing JSON shape '+JSON.stringify(details)+' is handled without silent loss',async()=>{
 const f=fixture('parts',details);
 if(details===null){await f.update({stock:0});assert.deepEqual(f.state.row.details,{stock:0});}
 else{await assert.rejects(f.update({stock:0}));assert.deepEqual(f.state.row.details,details);assert.ok(!f.state.ops.some(o=>o.op==='update'));}
});
for(const option of ['failRead','malformedRead','missing','foreign'])test(option+': failed owner-scoped read stops update safely',async()=>{
 const f=fixture('parts',{stock:4,legacy:'KEEP'},{[option]:true});await assert.rejects(f.update({stock:3}),e=>!e.message.includes('SECRET'));
 assert.equal(f.state.row.details.stock,4);assert.ok(!f.state.ops.some(o=>o.op==='update'));
});
test('update failure does not mutate original JSON or report success',async()=>{
 const f=fixture('parts',{stock:4,legacy:'KEEP'},{failUpdate:true});await assert.rejects(f.update({stock:3}));assert.equal(f.state.row.details.stock,4);assert.equal(f.state.events.length,0);
});
test('fresh DB JSON is used rather than stale edit snapshot',async()=>{
 const f=fixture('parts',{stock:4,legacy:'OLD'});const snapshot=json(f.state.row);f.state.row.details.legacy='NEW';
 await f.api.updateListing('parts',snapshot.id,{details:{stock:3}});assert.equal(f.state.row.details.legacy,'NEW');
});
test('form explicit clear updates canonical and legacy-label aliases consistently',async()=>{
 const f=fixture('parts',{oem:'ABC','OEM / kod':'ABC',legacy:'KEEP'});
 await f.update(f.api.detailsFromForm('parts',{oem:''}));assert.equal(f.state.row.details.oem,'');assert.equal(f.state.row.details['OEM / kod'],'');assert.equal(f.state.row.details.legacy,'KEEP');
});
for(const type of [...Object.keys(fields),'service','usta','dealer'])test(type+': create JSON/defaults unchanged against merged P1.1A',async()=>{
 const current=fixture(type),old=fixture(type,{}, {source:base});
 const input={title:'Listing',name:'Name',phone:'123',price:25,specialty:'Repair',details:{legacy:['A'],arbitrary:{key:'value'}}};
 if(type==='dealer'){
  for(const f of [current,old]){f.setFields({dealer_name:'Salon',phone:'123',region:'Bakı',address:'Address',credit_available:'Bəli'});await f.dealer.saveDealer({});}
 }else{for(const f of [current,old])await f.api.saveListing(type,input,{});}
 const normalize=f=>{const row=f.state.ops.find(o=>o.op==='insert').row;delete row.published_at;return row;};assert.deepEqual(normalize(current),normalize(old));
});
for(const type of ['cars','rent'])test(type+': Vehicle JSON/rental_type persistence behavior is unchanged',async()=>{
 const f=fixture(type,{rental_type:'Aylıq',unknown:'KEEP'});await f.api.updateListing(type,'listing',{phone:'123',details:{rental_type:'Günlük'}});
 assert.deepEqual(f.state.row.details,{rental_type:'Aylıq',unknown:'KEEP'});assert.ok(!f.state.ops.some(o=>o.columns==='details'));
});
