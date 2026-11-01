const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const cp=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const baseline=cp.execFileSync('git',['show','a755d25b7ea953bec268bdcc105382330bc91c7b:index.html'],{cwd:root,encoding:'utf8',maxBuffer:6000000});
function script(html,id){const m=html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'));assert.ok(m,id);return m[1];}
function fixture(source=html){
 const state={writes:[],row:{id:'listing',owner_id:'owner',title:'Old',rating:4.8,reviews_count:57,latitude:40.4,longitude:49.8,year:2022,condition:'used',currency:'USD',experience:'10 years',message_contact:'contact'}};
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},from(table){
  const q={op:'read',filters:[],select(){return this},eq(k,v){this.filters.push([k,v]);return this},limit(){return this},single(){return this},insert(row){this.op='insert';this.row=row;return this},update(row){this.op='update';this.row=row;return this},then(resolve,reject){return Promise.resolve().then(()=>{
   if(table==='marketplace_listing_media')return {data:[],error:null};
   if(this.op==='read'){
    assert.ok(this.filters.some(([k,v])=>k==='id'&&v==='listing'));
    assert.ok(this.filters.some(([k,v])=>k==='owner_id'&&v==='owner'));
    return {data:{details:state.row.details??{}},error:null};
   }
   const row=JSON.parse(JSON.stringify(this.row));state.writes.push({table,row,filters:this.filters,op:this.op});Object.assign(state.row,row);return {data:{...state.row},error:null};
  }).then(resolve,reject)}};return q;}};
 const window={AUSTA_SUPABASE:sb,dispatchEvent(){}};
 const document={readyState:'loading',addEventListener(){},getElementById(){return null}};
 const context=vm.createContext({window,document,console,CustomEvent:class{},setTimeout(){},clearTimeout(){}});
 for(const file of ['assets/vehicle/technical.js','assets/vehicle/vin.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 window.AUSTA_MARKETPLACE_CARD_DATA={salePayload:()=>({})};
 vm.runInContext(script(source,'austa-v153b-all-real-listing-router'),context);
 let form=script(source,'austa-v153c-real-listing-form-js');const end=form.lastIndexOf('})();');form=form.slice(0,end)+'window.__input=buildRouterInput;'+form.slice(end);vm.runInContext(form,context);
 return {state,api:window.AUSTA_V153,input:window.__input};
}
const marketplace=['parts','accessories','moto','special','bus','water','caravan','trailer','plate'];
for(const type of [...marketplace,'service','usta']){
 test(type+': sparse metadata update preserves absent columns and owner scope',async()=>{
  const f=fixture();await f.api.updateListing(type,'listing',{phone:'new',about:'text',price:15});
  const {row,filters}=f.state.writes.at(-1);
  for(const key of ['year','condition','currency','latitude','longitude','rating','reviews_count','experience','message_contact','details','title'])assert.ok(!Object.hasOwn(row,key),key);
  assert.equal(f.state.row.rating,4.8);assert.equal(f.state.row.reviews_count,57);assert.equal(f.state.row.latitude,40.4);assert.equal(f.state.row.currency,'USD');
  assert.ok(filters.some(([k,v])=>k==='owner_id'&&v==='owner'));assert.ok(filters.some(([k,v])=>k==='id'&&v==='listing'));
 });
}
for(const type of ['parts','service','usta'])for(const value of [undefined,null,false,0,'']){
 test(type+': explicit '+String(value)+' follows existing normalizers; undefined omitted',async()=>{
  const f=fixture();const input={description:value,about:value,latitude:value,longitude:value,rating:value,reviews_count:value};
  if(value===false){await assert.rejects(f.api.updateListing(type,'listing',input));assert.equal(f.state.writes.length,0);return;}
  await f.api.updateListing(type,'listing',input);const row=f.state.writes.at(-1).row;
  if(value===undefined){for(const k of ['latitude','longitude','rating','reviews_count','about','description'])assert.ok(!Object.hasOwn(row,k));return;}
  assert.equal(row.latitude,value===null||value===''?null:Number(value));
  const textKey=type==='parts'?'description':'about';assert.equal(row[textKey],value===null||value===''?null:String(value));
  if(type!=='parts'){assert.ok(!Object.hasOwn(row,'rating'));assert.ok(!Object.hasOwn(row,'reviews_count'));assert.equal(f.state.row.rating,4.8);assert.equal(f.state.row.reviews_count,57);}
 });
}
for(const [type,data,absent] of [
 ['parts',{part_name:'Filter'},['year','condition']],['accessories',{accessory_name:'Mat'},['year','condition']],
 ['bus',{brand:'Bus',model:'1'},['condition']],['plate',{plate_number:'10-AA-100'},['brand','model','year','condition']]
])test(type+': real form router does not synthesize missing controls',async()=>{
 const f=fixture(),input=f.input(type,{phone:'123',price:'25',region_address:'Bakı',details:{},...data});for(const key of absent)assert.ok(!Object.hasOwn(input,key),key);
 await f.api.updateListing(type,'listing',input);for(const key of absent)assert.ok(!Object.hasOwn(f.state.writes.at(-1).row,key),key);
});
test('present marketplace controls retain explicit clear and zero',async()=>{
 const f=fixture(),input=f.input('moto',{brand:'',model:'',year:'',condition:'',price:'0',details:{}});
 await f.api.updateListing('moto','listing',input);const row=f.state.writes.at(-1).row;
 for(const k of ['brand','model','year','condition'])assert.equal(row[k],null);assert.equal(row.price,0);
});
test('provider aliases retain zero and explicit clear',async()=>{
 const f=fixture();await f.api.updateListing('usta','listing',{reviews:0,hours:'',message:null,rating:0});const r=f.state.writes.at(-1).row;assert.ok(!Object.hasOwn(r,'reviews_count'));assert.ok(!Object.hasOwn(r,'rating'));assert.equal(f.state.row.reviews_count,57);assert.equal(f.state.row.rating,4.8);assert.equal(r.working_hours,null);assert.equal(r.message_contact,null);
});
test('service specialty-only update does not synthesize a title',async()=>{
 const f=fixture();await f.api.updateListing('service','listing',{specialty:'Repair'});assert.ok(!Object.hasOwn(f.state.writes.at(-1).row,'title'));
});
for(const type of [...marketplace,'service','usta'])test(type+': create payload defaults unchanged against approved base',async()=>{
 const current=fixture(),old=fixture(baseline),input={title:'Listing',name:'Name',phone:'123',price:25,specialty:'Repair'};
 await current.api.saveListing(type,input,{});await old.api.saveListing(type,input,{});
 const normalize=f=>{const row=f.state.writes.at(-1).row;delete row.published_at;delete row.rating;delete row.reviews_count;row.seller_profile_id??=null;return row;};assert.deepEqual(normalize(current),normalize(old));
});
test('protected scripts and modules unchanged outside P1.1G boundaries',()=>{
 const main=cp.execFileSync('git',['show','19c91a76502dad439811fa86d95af0fac922c88a:index.html'],{cwd:root,encoding:'utf8',maxBuffer:1e7});
 const blocks=text=>[...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
 const old=blocks(main),now=blocks(require('./helpers/seller-integration-baseline.cjs').withoutSellerPresentation(require('./helpers/seller-integration-baseline.cjs').withBaselineOwnerDelete(html,main)));assert.equal(now.length,old.length);
 for(let i=0;i<old.length;i++){
  if(['austa-v153b-all-real-listing-router','austa-v153c-real-listing-form-js','austa-v153d-14-category-media-js'].some(id=>now[i][1].includes(id)))continue;
  assert.equal(now[i][0],old[i][0]);
 }
 const changed=cp.execFileSync('git',['diff','--name-only','19c91a76502dad439811fa86d95af0fac922c88a','--','assets','backend'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
 assert.deepEqual(changed.filter(p=>!['assets/marketplace/seller-intent.js','assets/marketplace/media-manager.js','backend/a-usta56/tests/listing-media.test.ts'].includes(p)),[]);
});
for(const type of ['cars','rent'])test(type+': existing Vehicle technical partial update retained',async()=>{
 const f=fixture();await f.api.updateListing(type,'listing',{phone:'123',mileage:0});const r=f.state.writes.at(-1).row;
 assert.equal(r.mileage,0);for(const k of ['year','latitude','longitude','engine_volume','horsepower','has_video'])assert.ok(!Object.hasOwn(r,k),k);
});
test('213-brand / 822-model shared catalog retained',()=>{
 const c=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,'assets/vehicle/catalog.js'),'utf8'),c);
 const catalog=c.window.AUSTA_VEHICLE_CATALOG;assert.equal(catalog.brands.length,213);assert.equal(Object.values(catalog.models).reduce((n,m)=>n+m.length,0),822);
});
