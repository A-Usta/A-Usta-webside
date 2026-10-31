const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const block=id=>html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'))[1];
const plain=value=>JSON.parse(JSON.stringify(value));
const values=['Günlük','Həftəlik','Aylıq','Uzunmüddətli'];
function fixture({type='rent',stored=null}={}){
 const state={row:{id:'listing',owner_id:'owner',status:'active',listing_type:type==='rent'?'rent':'sale',rental_type:stored,brand:'Mercedes-Benz',model:'E-Class',year:2022,daily_price:50,price:100,phone:'123'},ops:[],nodes:[],events:[],timers:[]};
 class Q{
  constructor(table){this.table=table;this.op='read';this.filters=[];}
  select(){return this}eq(k,v){this.filters.push(['eq',k,v]);return this}ilike(k,v){this.filters.push(['ilike',k,v]);return this}order(){return this}range(){return this}limit(){return this}single(){this.one=true;return this}
  insert(row){this.op='insert';this.payload=row;return this}update(row){this.op='update';this.payload=row;return this}
  then(ok,bad){return Promise.resolve().then(()=>{
   state.ops.push({op:this.op,table:this.table,filters:plain(this.filters),payload:this.payload&&plain(this.payload)});
   assert.equal(this.table,'vehicle_listings','no JSON/media table work');
   if(this.op==='insert')state.row={id:'listing',rental_type:null,...plain(this.payload)};
   else if(this.op==='update'){
    assert.ok(this.filters.some(([op,k,v])=>op==='eq'&&k==='owner_id'&&v==='owner'));
    assert.ok(this.filters.some(([op,k,v])=>op==='eq'&&k==='id'&&v==='listing'));
    assert.ok(this.filters.every(([,k,v])=>state.row[k]===v));Object.assign(state.row,plain(this.payload));
   }
   let rows=this.op==='read'?[state.row].filter(row=>this.filters.every(([op,k,v])=>op==='eq'?row[k]===v:row[k]!=null&&String(row[k]).includes(v.replace(/^%|%$/g,'')))):[state.row];
   return {data:this.one?plain(rows[0]??null):plain(rows),error:null};
  }).then(ok,bad)}
 }
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}}),getUser:async()=>({data:{user:{id:'owner'}}})},from:table=>new Q(table)};
 const status={style:{},textContent:''},button={disabled:false,textContent:''},container={innerHTML:'',querySelectorAll(){return state.nodes},querySelector(){return null}};
 const document={readyState:'loading',addEventListener(){},querySelectorAll(){return state.nodes},getElementById(id){return id==='austaV153CCategory'?{value:type}:id==='austaV153CFields'?container:id==='austaV153CStatus'?status:id==='austaV153CSave'?button:null}};
 const window={AUSTA_SUPABASE:sb,dispatchEvent(e){state.events.push(e)},AUSTA_MARKETPLACE_CARD_DATA:{salePayload:()=>({}),mount(){},read:()=>({}),remember(){}},AUSTA_VEHICLE_SELECTOR:{mount(){}}};
 const c=vm.createContext({window,document,console:{log(){},warn(){},error(){}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},setTimeout(fn){state.timers.push(fn)},clearTimeout(){}});
 for(const f of ['assets/vehicle/catalog.js','assets/vehicle/technical.js','assets/vehicle/vin.js','assets/marketplace/listing-publish.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
 vm.runInContext(block('austa-v153b-all-real-listing-router'),c);
 let form=block('austa-v153c-real-listing-form-js'),end=form.lastIndexOf('})();');
 vm.runInContext(form.slice(0,end)+'window.__form={buildRouterInput,fillEditFields,renderFields,saveCurrentListing,setEdit(){currentEdit={id:"listing",type:"'+type+'"};}};'+form.slice(end),c);
 let media=block('austa-v153d-14-category-media-js');end=media.lastIndexOf('})();');vm.runInContext(media.slice(0,end)+'window.__patch=patchSave;'+media.slice(end),c);
 window.__patch();
 vm.runInContext(fs.readFileSync(path.join(root,'assets/marketplace/category-filters.js'),'utf8'),c);
 let category=block('austa-v154e-global-promotion-pagination');end=category.lastIndexOf('})();');vm.runInContext(category.slice(0,end)+'window.__fetch=fetchCategoryV154E;'+category.slice(end),c);
 vm.runInContext(html.slice(html.indexOf('function vehicleText(value)'),html.indexOf('function vehicleSection(title,rows)')),c);
 const formData=(extra={})=>({phone:'123',brand:'Mercedes-Benz',model:'E-Class',year:'2022',daily_price:'50',price:'100',region_address:'Bakı',details:{},...extra});
 return {state,window,api:window.AUSTA_V153,form:window.__form,status,container,
  input:extra=>window.__form.buildRouterInput(type,formData(extra)),
  create:extra=>window.AUSTA_V153.saveListing(type,window.__form.buildRouterInput(type,formData(extra))),
  update:input=>window.AUSTA_V153.updateListing(type,'listing',input),
  query:filters=>window.__fetch(type,1,filters),
  specs:item=>plain(c.carSpecs(item||state.row))};
}
for(const value of values){
 test('Rent '+value+': real form router → P0.3 staging → activation persists column',async()=>{
  const f=fixture();await f.create({rental_type:value});assert.equal(f.state.row.rental_type,value);assert.equal(f.state.row.status,'active');
  const insert=f.state.ops.find(o=>o.op==='insert');assert.equal(insert.payload.rental_type,value);assert.equal(insert.payload.status,'draft');assert.ok(!Object.hasOwn(insert.payload,'details'));
  assert.equal(f.state.ops.filter(o=>o.op==='insert').length,1);
 });
 test('Rent '+value+': edit hydrates real column, ignores conflicting legacy JSON',()=>{
  const f=fixture({stored:value}),node={dataset:{v153cKey:'rental_type'},value:''};f.state.nodes=[node];f.form.fillEditFields({...f.state.row,details:{rental_type:'FAKE'}},'rent');assert.equal(node.value,value);
 });
 test('Rent '+value+': persisted value appears in existing detail specs',()=>{
  const f=fixture({stored:value});assert.deepEqual(f.specs().find(([label])=>label==='İcarə növü'),['İcarə növü',value]);
 });
 test('Rent '+value+': canonical column filter includes created listing',async()=>{
  const f=fixture();await f.create({rental_type:value});const result=await f.query({rental_type:value});assert.equal(result.total,1);
  const query=f.state.ops.at(-1);assert.ok(query.filters.some(([,k])=>k==='rental_type'));assert.ok(!query.filters.some(([,k])=>k.includes('details')));
 });
}
for(const value of ['Yearly','günlük',' Günlük ',false,0,[],{},'undefined'])for(const op of ['create','update'])test(op+': unsupported '+JSON.stringify(value)+' rejected before write',async()=>{
 const f=fixture({stored:'Aylıq'});await assert.rejects(op==='create'?f.create({rental_type:value}):f.update({rental_type:value}));assert.ok(!f.state.ops.some(o=>['insert','update'].includes(o.op)));assert.equal(f.state.row.rental_type,'Aylıq');
});
test('Rent Günlük → Həftəlik update changes canonical DB column and filters',async()=>{
 const f=fixture();await f.create({rental_type:'Günlük'});await f.update({rental_type:'Həftəlik'});assert.equal(f.state.row.rental_type,'Həftəlik');
 assert.equal((await f.query({rental_type:'Günlük'})).total,0);assert.equal((await f.query({rental_type:'Həftəlik'})).total,1);
 assert.deepEqual(f.specs().find(([l])=>l==='İcarə növü'),['İcarə növü','Həftəlik']);
});
for(const patch of [{daily_price:75},{daily_price:0,rental_type:undefined}])test('Rent sparse update preserves existing Uzunmüddətli: '+JSON.stringify(patch),async()=>{
 const f=fixture({stored:'Uzunmüddətli'});await f.update(patch);assert.equal(f.state.row.rental_type,'Uzunmüddətli');assert.ok(!Object.hasOwn(f.state.ops.find(o=>o.op==='update').payload,'rental_type'));
});
for(const value of [null,''])test('Rent explicit blank/null clears to SQL NULL: '+JSON.stringify(value),async()=>{
 const f=fixture({stored:'Aylıq'});await f.update({rental_type:value});assert.equal(f.state.row.rental_type,null);
});
test('legacy NULL keeps blank select and produces no fabricated detail value',()=>{
 const f=fixture(),node={dataset:{v153cKey:'rental_type'},value:'Günlük'};f.state.nodes=[node];f.form.fillEditFields({...f.state.row,details:{rental_type:'Günlük'}},'rent');assert.equal(node.value,'');assert.ok(!f.specs().some(([l])=>l==='İcarə növü'));
 f.form.renderFields();assert.match(f.container.innerHTML,/<option value="">\s*Seçin/);assert.equal(plain(f.api.rentalTypes).join('|'),values.join('|'));
});
test('Rent NULL create with no selection remains NULL; JSON is never a fallback',async()=>{
 const f=fixture();await f.create({details:{rental_type:'Günlük'}});assert.equal(f.state.row.rental_type,null);
});
test('Rent real edit form save persists a changed selection',async()=>{
 const f=fixture({stored:'Günlük'}),fields={phone:'123',brand:'Mercedes-Benz',model:'E-Class',year:'2022',daily_price:'50',rental_type:'Həftəlik'};
 f.state.nodes=Object.entries(fields).map(([key,value])=>({dataset:{v153cKey:key,v153cLabel:key},value}));f.form.setEdit();await f.form.saveCurrentListing();assert.equal(f.state.row.rental_type,'Həftəlik');assert.ok(f.status.textContent.includes('yadda saxlanıldı'));
});
for(const op of ['create','edit','filter','detail'])test('Cars '+op+' isolation',async()=>{
 const f=fixture({type:'cars'});
 if(op==='create'){await f.create({rental_type:'Günlük'});assert.equal(f.state.row.rental_type,null);assert.ok(!Object.hasOwn(f.state.ops.find(o=>o.op==='insert').payload,'rental_type'));}
 if(op==='edit'){await f.update({price:75,rental_type:'Günlük'});assert.ok(!Object.hasOwn(f.state.ops.find(o=>o.op==='update').payload,'rental_type'));}
 if(op==='filter'){const result=await f.query({rental_type:'Günlük'});assert.equal(result.total,1);assert.ok(!f.state.ops.at(-1).filters.some(([,k])=>k==='rental_type'));}
 if(op==='detail')assert.ok(!f.specs({...f.state.row,rental_type:'Günlük'}).some(([l])=>l==='İcarə növü'));
});
test('no production rental_type JSON source remains in runtime',()=>{
 assert.ok(!/details\.rental_type/.test(html));const filters=fs.readFileSync(path.join(root,'assets/marketplace/category-filters.js'),'utf8');assert.ok(!filters.includes("detail('rental_type'"));
});
for(const type of ['cars','rent'])test(type+': public category excludes draft staging',async()=>{
 const f=fixture({type});f.state.row.status='draft';assert.equal((await f.query({})).total,0);
 f.state.row.status='active';assert.equal((await f.query({})).total,1);
 assert.ok(f.state.ops.at(-1).filters.some(([,k,v])=>k==='status'&&v==='active'));
});
