const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const script=id=>html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'))[1];
const json=value=>JSON.parse(JSON.stringify(value));
const types=['parts','accessories','moto','special','bus','water','caravan','trailer'];
const pairs=[['Land Rover','Range Rover'],['Alfa Romeo','Giulia'],['Great Wall','Haval H6'],['Mercedes-Benz','E-Class']];
function fixture(type='moto',brand='Land Rover',model='Range Rover'){
 const state={row:{id:'listing',owner_id:'owner',status:'active',category:type,title:'Original title',brand,model,price:25,phone:'123',details:{legacy:'KEEP','Marka / model':'OLD COMBINED',nested:{array:[1,2]},...(type==='water'?{water_type:'Qayıq'}:{})}},nodes:[],ops:[],events:[]};
 class Q{
  constructor(table){this.table=table;this.op='read';this.filters=[];}
  select(columns){this.columns=columns;return this}eq(k,v){this.filters.push(['eq',k,v]);return this}ilike(k,v){this.filters.push(['ilike',k,v]);return this}single(){this.one=true;return this}order(){return this}range(){return this}limit(){return this}
  insert(row){this.op='insert';this.payload=row;return this}update(row){this.op='update';this.payload=row;return this}
  then(ok,bad){return Promise.resolve().then(()=>{
   state.ops.push({table:this.table,op:this.op,columns:this.columns,filters:json(this.filters),payload:this.payload&&json(this.payload)});
   if(this.table==='marketplace_listing_media')return {data:[],error:null};
   assert.equal(this.table,'marketplace_listings');
   if(this.op==='insert')state.row={id:'listing',...json(this.payload)};
   if(this.op==='update'||this.columns==='details'){
    assert.ok(this.filters.some(([,k,v])=>k==='id'&&v==='listing'));assert.ok(this.filters.some(([,k,v])=>k==='owner_id'&&v==='owner'));
    assert.ok(this.filters.every(([,k,v])=>state.row[k]===v));
   }
   if(this.op==='update')Object.assign(state.row,json(this.payload));
   if(this.columns==='details')return {data:{details:json(state.row.details)},error:null};
   const rows=this.op==='read'?[state.row].filter(r=>this.filters.every(([op,k,v])=>op==='eq'?r[k]===v:r[k]!=null&&String(r[k]).includes(v.replace(/^%|%$/g,'')))):[state.row];
   return {data:this.one?json(rows[0]??null):json(rows),error:null};
  }).then(ok,bad)}
 }
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}}),getUser:async()=>({data:{user:{id:'owner'}}})},from:t=>new Q(t)};
 const status={style:{},textContent:''},button={disabled:false,textContent:''},box={innerHTML:''};
 const document={readyState:'loading',addEventListener(){},querySelectorAll(){return state.nodes},getElementById(id){return id==='austaV153CCategory'?{value:type}:id==='austaV153CFields'?box:id==='austaV153CStatus'?status:id==='austaV153CSave'?button:null}};
 const window={AUSTA_SUPABASE:sb,dispatchEvent(e){state.events.push(e)},AUSTA_MARKETPLACE_CARD_DATA:{salePayload:()=>({})}};
 const context=vm.createContext({window,document,console:{log(){},error(){},warn(){}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},setTimeout(){},clearTimeout(){},normalize:v=>String(v).toLowerCase()});
 for(const file of ['assets/vehicle/technical.js','assets/vehicle/catalog.js','assets/vehicle/vin.js','assets/marketplace/listing-publish.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 vm.runInContext(script('austa-v153b-all-real-listing-router'),context);
 let form=script('austa-v153c-real-listing-form-js'),end=form.lastIndexOf('})();');vm.runInContext(form.slice(0,end)+'window.__form={readFields,renderFields,validate,buildRouterInput,fillEditFields,saveCurrentListing,setEdit(){currentEdit={id:"listing",type:"'+type+'"};}};'+form.slice(end),context);
 let media=script('austa-v153d-14-category-media-js');end=media.lastIndexOf('})();');vm.runInContext(media.slice(0,end)+'window.__patch=patchSave;'+media.slice(end),context);window.__patch();
 for(const file of ['assets/marketplace/category-filters.js','assets/marketplace/listing-cards.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 let fetch=script('austa-v154e-global-promotion-pagination');end=fetch.lastIndexOf('})();');vm.runInContext(fetch.slice(0,end)+'window.__fetch=fetchCategoryV154E;'+fetch.slice(end),context);
 vm.runInContext(html.slice(html.indexOf('function genericSpecs(item){'),html.indexOf('function specsFor(item){')),context);
 const fields=window.AUSTA_V153C.categories[type].fields;
 const defaults={phone:'123',price:'25',part_name:'Part',accessory_name:'Accessory',special_type:'Crane',water_type:'Qayıq',trailer_type:'Trailer',plate_number:'10-AA-100',name:'Seller'};
 const setNodes=()=>{state.nodes=fields.map(([key,label])=>({dataset:{v153cKey:key,v153cLabel:label},value:defaults[key]??''}));};
 const data=extra=>({...defaults,details:{},...extra});
 return {state,window,form:window.__form,api:window.AUSTA_V153,status,box,fields,setNodes,
  create:extra=>window.AUSTA_V153.saveListing(type,window.__form.buildRouterInput(type,data(extra))),
  update:input=>window.AUSTA_V153.updateListing(type,'listing',input),
  query:filters=>window.__fetch(type,1,filters),
  specs:()=>json(context.genericSpecs(state.row))};
}
for(const type of types){
 for(const [brand,model] of pairs)test(type+': explicit create '+brand+' / '+model,async()=>{
  const f=fixture(type);await f.create({brand,model});assert.equal(f.state.row.brand,brand);assert.equal(f.state.row.model,model);assert.equal(f.state.row.status,'active');
  assert.ok(!Object.hasOwn(f.state.row,'brand_model'));const insert=f.state.ops.find(o=>o.op==='insert');assert.equal(insert.payload.status,'inactive');
 });
 test(type+': real hydrate → price edit → save retains boundaries and legacy JSON',async()=>{
  const f=fixture(type);f.setNodes();f.form.fillEditFields(f.state.row,type);
  const node=k=>f.state.nodes.find(n=>n.dataset.v153cKey===k);
  assert.equal(node('brand').value,'Land Rover');assert.equal(node('model').value,'Range Rover');node('price').value='30';
  f.form.setEdit();await f.form.saveCurrentListing();assert.ok(f.status.textContent.includes('yadda saxlanıldı'),f.status.textContent);
  assert.equal(f.state.row.brand,'Land Rover');assert.equal(f.state.row.model,'Range Rover');assert.equal(f.state.row.price,30);
  assert.equal(f.state.row.details.legacy,'KEEP');assert.equal(f.state.row.details['Marka / model'],'OLD COMBINED');assert.deepEqual(f.state.row.details.nested,{array:[1,2]});
  const labels=f.fields.filter(([k])=>['brand','model'].includes(k)).map(([,label])=>label);
  for(const label of labels)assert.ok(!Object.hasOwn(f.state.row.details,label),'no new duplicate JSON authority');
 });
 test(type+': manual independent controls, no combined selector or synthetic JSON',()=>{
  const f=fixture(type);f.setNodes();f.form.renderFields();for(const key of ['brand','model'])assert.equal(f.fields.find(field=>field[0]===key)[2],'text');
  assert.ok(!f.fields.some(field=>field[0]==='brand_model'));const node=k=>f.state.nodes.find(n=>n.dataset.v153cKey===k);node('brand').value='  Great Wall  ';node('model').value=' Haval H6 ';
  const data=f.form.readFields();assert.equal(data.brand,'Great Wall');assert.equal(data.model,'Haval H6');assert.ok(!Object.hasOwn(data.details,'Marka'));assert.ok(!Object.hasOwn(data.details,'Model'));
 });
}
for(const [brand,model] of [[null,'Range Rover'],['Land Rover',null],['Land','Rover Range Rover'],['UNKNOWN MULTI WORD','Custom model 123']])test('legacy exact round-trip '+JSON.stringify([brand,model]),async()=>{
 const f=fixture('moto',brand,model);f.setNodes();f.form.fillEditFields(f.state.row,'moto');f.form.setEdit();await f.form.saveCurrentListing();assert.ok(f.status.textContent.includes('yadda saxlanıldı'));assert.equal(f.state.row.brand,brand);assert.equal(f.state.row.model,model);
});
for(const patch of [{price:30},{price:0,brand:undefined,model:undefined},{model:'Discovery'},{brand:'Alfa Romeo'}])test('independent sparse update '+JSON.stringify(patch),async()=>{
 const f=fixture();await f.update(patch);assert.equal(f.state.row.brand,patch.brand??'Land Rover');assert.equal(f.state.row.model,patch.model??'Range Rover');
 if(!Object.hasOwn(patch,'brand')||patch.brand===undefined)assert.ok(!Object.hasOwn(f.state.ops.find(o=>o.op==='update').payload,'brand'));
 if(!Object.hasOwn(patch,'model')||patch.model===undefined)assert.ok(!Object.hasOwn(f.state.ops.find(o=>o.op==='update').payload,'model'));
});
for(const type of ['parts','accessories','special','water','trailer'])test(type+': optional clear and whitespace normalize independently to NULL',async()=>{
 const f=fixture(type);await f.create({brand:'   ',model:''});assert.equal(f.state.row.brand,null);assert.equal(f.state.row.model,null);
 await f.update({brand:'Land Rover',model:'Range Rover'});await f.update({model:''});assert.equal(f.state.row.brand,'Land Rover');assert.equal(f.state.row.model,null);
});
for(const type of ['moto','bus','caravan'])test(type+': original nonempty identity requirement retained without requiring both fields',()=>{
 const f=fixture(type),common={phone:'123',price:'25'};assert.throws(()=>f.form.validate(type,{...common,brand:' ',model:''}));
 assert.doesNotThrow(()=>f.form.validate(type,{...common,brand:'Land Rover',model:''}));assert.doesNotThrow(()=>f.form.validate(type,{...common,brand:null,model:'Range Rover'}));
 assert.throws(()=>f.form.validate(type,{...common,brand_model:'DO NOT PARSE'}));
});
for(const type of ['bus','caravan'])test(type+': arbitrary title/JSON does not become structured brand/model',()=>{
 const f=fixture(type,null,null);f.setNodes();f.form.fillEditFields({...f.state.row,title:'Land Rover Range Rover',details:{brand:'FAKE',model:'FAKE','Marka / model':'FAKE'}},type);
 assert.equal(f.state.nodes.find(n=>n.dataset.v153cKey==='brand').value,'');assert.equal(f.state.nodes.find(n=>n.dataset.v153cKey==='model').value,'');
});
test('Plate has no controls and router never fabricates brand/model',async()=>{
 const f=fixture('plate');assert.ok(!f.fields.some(([k])=>['brand','model','brand_model'].includes(k)));
 const input=f.form.buildRouterInput('plate',{...{phone:'123',price:'25',plate_number:'10-AA-100',details:{}},brand:'INJECT',model:'INJECT'});assert.ok(!Object.hasOwn(input,'brand'));assert.ok(!Object.hasOwn(input,'model'));
 await f.create({});assert.equal(f.state.row.brand,null);assert.equal(f.state.row.model,null);
});
test('multi-word values match real V170 top-level filters, card and detail outputs',async()=>{
 const f=fixture('accessories');await f.create({brand:'Land Rover',model:'Range Rover'});
 assert.equal((await f.query({brand:'Land Rover',model:'Range Rover'})).total,1);assert.equal((await f.query({brand:'Alfa Romeo'})).total,0);
 assert.ok(f.state.ops.some(o=>o.filters.some(([op,k])=>op==='ilike'&&k==='brand')));
 const content=f.window.AUSTA_LISTING_CARDS.content('accessories',f.state.row);assert.ok(content.summary.includes('Land Rover Range Rover'));
 assert.deepEqual(f.specs().find(([k])=>k==='brand'),['brand','Land Rover']);assert.deepEqual(f.specs().find(([k])=>k==='model'),['model','Range Rover']);
});
test('old combined incoming text cannot overwrite explicit boundaries or infer missing ones',()=>{
 const f=fixture();const data={phone:'123',price:25,brand_model:'Land Rover Range Rover',details:{}};
 const input=f.form.buildRouterInput('moto',data);assert.ok(!Object.hasOwn(input,'brand'));assert.ok(!Object.hasOwn(input,'model'));
 const explicit=f.form.buildRouterInput('moto',{...data,brand:'Great Wall',model:'Haval H6'});assert.equal(explicit.brand,'Great Wall');assert.equal(explicit.model,'Haval H6');
 assert.ok(!html.includes('splitBrandModel('));
});
test('P1.1B blocks incoming brand/model JSON authority while preserving existing legacy JSON',async()=>{
 const f=fixture();await f.update({details:{brand:'ATTACK',model:'ATTACK',brand_model:'ATTACK',owner_id:'ATTACK',moto_type:'Skuter'}});
 assert.equal(f.state.row.brand,'Land Rover');assert.equal(f.state.row.model,'Range Rover');assert.equal(f.state.row.details.moto_type,'Skuter');assert.equal(f.state.row.details['Marka / model'],'OLD COMBINED');assert.ok(!Object.hasOwn(f.state.row.details,'brand'));
});
