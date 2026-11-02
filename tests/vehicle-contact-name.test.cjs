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
  specs:item=>plain(c.carSpecs(item||state.row)),context:c};
}

for(const type of ['cars','rent']){
 test(type+': create canonical contact, trim only, phone and rental isolation',async()=>{
  const f=fixture({type});await f.create({name:'  Əli  Məmmədov  ',rental_type:type==='rent'?'Günlük':null,seller_profile_id:'evil',owner_id:'evil',arbitrary:'evil'});
  const row=f.state.ops.find(o=>o.op==='insert').payload;
  assert.equal(row.contact_name,'Əli  Məmmədov');assert.equal(row.phone,'123');assert.equal(row.owner_id,'owner');
  for(const key of ['name','details','arbitrary'])assert.ok(!Object.hasOwn(row,key));
  assert.equal(row.seller_profile_id,null);
  if(type==='rent')assert.equal(row.rental_type,'Günlük');
 });
 for(const name of ['', '   ',undefined])test(type+': blank create '+JSON.stringify(name),async()=>{
  const f=fixture({type});await f.create({name});assert.equal(f.state.row.contact_name,null);
 });
 for(const stored of [null,'Əli'])for(const patch of [{price:80},{contact_name:undefined},{contact_name:'  Vüqar Əliyev  '},{contact_name:''},{contact_name:'   '},{contact_name:null}])test(type+': update '+JSON.stringify({stored,patch}),async()=>{
  const f=fixture({type});f.state.row.contact_name=stored;f.state.row.seller_profile_id='business';await f.update(patch);
  assert.equal(f.state.row.contact_name,patch.contact_name===undefined?stored:(patch.contact_name||'').trim()||null);
  assert.equal(f.state.row.seller_profile_id,'business');
  if(patch.contact_name===undefined)assert.ok(!Object.hasOwn(f.state.ops.find(o=>o.op==='update').payload,'contact_name'));
 });
 for(const contact_name of [null,'Əli'])test(type+': hydration ignores generic and details names '+contact_name,()=>{
  const f=fixture({type}),node={dataset:{v153cKey:'name'},value:'old'};f.state.nodes=[node];
  f.form.fillEditFields({...f.state.row,contact_name,name:'WRONG',details:{name:'WRONG'}},type);assert.equal(node.value,contact_name??'');
 });
 test(type+': real form edit maps name to canonical column',async()=>{
  const f=fixture({type});f.state.nodes=Object.entries({phone:'123',name:'Vüqar',brand:'Mercedes-Benz',model:'E-Class',year:'2022',price:'100',daily_price:'50'}).map(([key,value])=>({dataset:{v153cKey:key,v153cLabel:key},value}));
  f.form.setEdit();await f.form.saveCurrentListing();assert.equal(f.state.row.contact_name,'Vüqar');assert.equal(f.state.row.phone,'123');
 });
 test(type+': detail canonical source, generic fallback and escaped output',()=>{
  const f=fixture({type});vm.runInContext("function categoryOf(item){return item.category;}"+html.slice(html.indexOf('function sellerOf(item){'),html.indexOf('function locationOf(item){')),f.context);
  f.context.item={category:type,contact_name:'Əli',name:'WRONG','Ad / soyad':'WRONG'};
  assert.equal(vm.runInContext('sellerOf(item)',f.context),'Əli');f.context.item.contact_name=null;assert.equal(vm.runInContext('sellerOf(item)',f.context),'Elan sahibi');
  f.context.item.contact_name='<img src=x onerror="window.attacked=true">';
  const start=html.indexOf('function escapeHtml(value){');vm.runInContext(html.slice(start,html.indexOf('function normalize(value){',start)),f.context);
  assert.ok(!vm.runInContext('escapeHtml(sellerOf(item))',f.context).includes('<img'));assert.equal(f.window.attacked,undefined);
  assert.match(html,/escapeHtml\(\s*sellerOf\(item\)/);
 });
}

test('non-Vehicle seller identity and router remain isolated',()=>{
 const f=fixture();vm.runInContext("function categoryOf(item){return item.category;}"+html.slice(html.indexOf('function sellerOf(item){'),html.indexOf('function locationOf(item){')),f.context);
 for(const category of ['dealer','service','usta','parts']){
  f.context.item={category,name:'Existing identity',contact_name:'Vehicle only'};
  assert.equal(vm.runInContext('sellerOf(item)',f.context),category==='dealer'?'Vehicle only':category==='service'?'Əlaqələndirici':'Existing identity');
  const input=f.form.buildRouterInput(category,{name:'Existing identity',service_name:'Existing service',specialty:'Repair',phone:'123',brand:'Brand',model:'Model',dealer_name:'Dealer',region:'Bakı',address:'Street'});
  assert.ok(!Object.hasOwn(input,'contact_name'));
 }
});
test('Vehicle detail/edit DB loads and mappers retain canonical contact column',()=>{
 for(const start of [html.indexOf('function mapSupabaseListing(item){'),html.indexOf('function mapSupabaseListing(item){',html.indexOf('function mapSupabaseListing(item){')+1)]){
  const end=html.indexOf('\nfunction ',start+1);assert.match(html.slice(start,end),/\.\.\.item/);
 }
 assert.match(fs.readFileSync(path.join(root,'assets/marketplace/listing-detail.js'),'utf8'),/from\(c.config.table\)\.select\('\*'\)\.eq\('id',c.id\)/);
});
