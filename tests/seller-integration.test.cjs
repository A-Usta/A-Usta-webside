const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const moduleSource=fs.readFileSync(path.join(root,'assets/marketplace/seller-intent.js'),'utf8');
const filename=path.join(__dirname,'listing-publish.test.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
let fixtureCode=fs.readFileSync(filename,'utf8').split('const noSuccess=f=>')[0].replace('return {state,files,window,api,core','return {context,document,state,files,window,api,core');
if(process.env.P12B_MUTATION==='mass')fixtureCode=fixtureCode.replace('vm.runInContext(block(ids.router),context);',`vm.runInContext(block(ids.router).replace("'last_boosted_at','seller_profile_id'","'last_boosted_at'"),context);`);
m._compile(fixtureCode+'\nmodule.exports=fixture;',filename);
const publish=m.exports;
const compatibility={cars:'dealer',rent:'dealer',parts:'store',accessories:'store',special:'store',moto:'store',plate:'store',bus:'store',trailer:'store',water:'store',caravan:'store',service:'service',usta:'usta',dealer:'dealer'};
const valid={brand:'BMW',model:'X5',year:2022,price:10,daily_price:5,name:'Name',specialty:'Repair',title:'Listing',phone:'123'};
const table=t=>['cars','rent'].includes(t)?'vehicle_listings':['service','usta'].includes(t)?'service_provider_listings':t==='dealer'?'auto_dealer_listings':'marketplace_listings';
function fixture(transform=s=>s){
 const f=publish();let listener;
 Object.assign(f.state,{profiles:[],rpcCalls:0,rpcError:false});
 const sb=f.window.AUSTA_SUPABASE;
 sb.auth.getSession=async()=>({data:{session:{user:{id:f.state.owner},access_token:f.state.owner}},error:null});
 sb.auth.onAuthStateChange=fn=>{listener=fn;return {data:{subscription:{unsubscribe(){}}}};};
 sb.rpc=async name=>{
  assert.equal(name,'get_my_seller_profiles');f.state.rpcCalls++;f.state.ops.push({op:'rpc'});
  if(f.state.rpcWait)await f.state.rpcWait;
  return {data:f.state.profiles,error:f.state.rpcError?new Error('private server details'):null};
 };
 f.document.createElement=()=>{
  const select={value:'',addEventListener(name,fn){assert.equal(name,'change');this.change=fn;}};
  return {dataset:{},renderCount:0,get innerHTML(){return this.html||'';},set innerHTML(value){this.html=value;this.renderCount++;},querySelector(){return select;},remove(){},select};
 };
 let source=transform(moduleSource);
 if(process.env.P12B_MUTATION==='refresh')source=source.replace('await discover(true)','await discover()');
 else if(process.env.P12B_MUTATION==='compatibility')source=source.replace('p.id===intent.selected&&p.business_type===business[type]','p.id===intent.selected');
 else if(process.env.P12B_MUTATION==='auth')source=source.replace("if((authKey!==null&&key!==authKey)||[...live].some(s=>s.owner&&s.owner!==(session?.user?.id||null)))invalidate();authKey=key;",'authKey=key;');
 if(process.env.P12B_MUTATION==='race'){
  const guard='if(!same(who,now)||!currentState(state,version,revision))return;';
  assert.ok(source.includes(guard),'race mutation must remove the actual outer completion guard');
  source=source.replace('await load(state);\n        if(!currentState(state,version,revision))return;','await load(state);');
  source=source.replace(guard,'/* race mutation: outer completion guard bypassed */');
 }
 vm.runInContext(source,f.context);
 f.intent=f.window.AUSTA_SELLER_INTENT;
 f.root=()=>({children:[],isConnected:true,appendChild(box){this.children.push(box);this.box=box;}});
 f.profile=(type='dealer',patch={})=>({id:'profile-'+type,business_type:type,display_name:'Business '+type,status:'active',verification_status:'verified',official_status:'none',official_scope:null,...patch});
 f.switchUser=id=>{f.state.owner=id;listener('SIGNED_IN',{user:{id},access_token:id});};
 f.mount=async(type,existing=null)=>{const root=f.root();await f.intent.mount(root,type,existing);return root;};
 f.choose=(root,id)=>{root.box.select.value=id||'';root.box.select.change();return f.intent.capture(root);};
 f.save=(type,token,patch={})=>f.api.saveListing(type,{...valid,...patch},token);
 f.edit=async(type,token,patch={phone:'456'})=>{
  if(type==='dealer'){f.window.__media.setDealerEdit({id:'existing'});return f.api.saveListing(type,{},token);}
  return f.api.updateListing(type,'existing',patch,token);
 };
 return f;
}
const plain=v=>JSON.parse(JSON.stringify(v));
const noWrite=f=>assert.ok(!f.state.ops.some(x=>['insert','update','upload','delete','remove'].includes(x.op)));
for(const [type,business] of Object.entries(compatibility)){
 test(`${type}: personal CREATE persists NULL with original private staging → active`,async()=>{
  const f=fixture(),r=await f.mount(type);await f.save(type,f.intent.capture(r));
  const insert=f.state.ops.find(o=>o.op==='insert');assert.equal(insert.row.seller_profile_id,null);assert.equal(insert.row.status,['cars','rent'].includes(type)?'draft':'inactive');assert.equal(f.state.tables[table(type)][0].status,'active');
 });
 test(`${type}: eligible ${business} selected via owned RPC and refreshed immediately before INSERT`,async()=>{
  const f=fixture();f.state.profiles=[f.profile(business)];const r=await f.mount(type),token=f.choose(r,'profile-'+business);
  assert.equal(f.state.rpcCalls,1);await f.save(type,token);assert.equal(f.state.rpcCalls,2);
  const insertIndex=f.state.ops.findIndex(o=>o.op==='insert');assert.equal(f.state.ops[insertIndex-1].op,'rpc');assert.equal(f.state.ops[insertIndex].row.seller_profile_id,'profile-'+business);
 });
 test(`${type}: wrong business type cannot become trusted intent`,async()=>{
  const f=fixture();f.state.profiles=[f.profile(business==='dealer'?'store':'dealer')];const r=await f.mount(type);assert.throws(()=>f.choose(r,f.state.profiles[0].id));noWrite(f);
 });
 test(`${type}: stale professional choice fails before staging/media, no downgrade`,async()=>{
  const f=fixture();f.state.profiles=[f.profile(business)];const r=await f.mount(type),token=f.choose(r,f.state.profiles[0].id);
  f.files.images=[{name:'photo.jpg',type:'image/jpeg',size:128}];f.state.profiles=[];await assert.rejects(f.save(type,token));noWrite(f);
 });
 for(const [status,verification] of [['pending','verified'],['active','unverified'],['active','rejected'],['suspended','verified'],['active','revoked']])test(`${type}: revalidation rejects ${status}/${verification}`,async()=>{
  const f=fixture();f.state.profiles=[f.profile(business)];const r=await f.mount(type),token=f.choose(r,f.state.profiles[0].id);
  f.state.profiles=[f.profile(business,{status,verification_status:verification})];await assert.rejects(f.save(type,token));noWrite(f);
 });
 for(const mode of ['unchanged','detach','attach','switch','invalid'])test(`${type}: sparse EDIT ${mode}`,async()=>{
  const f=fixture(),old=mode==='attach'?null:'legacy-revoked';
  f.state.tables[table(type)].push({id:'existing',owner_id:f.state.owner,status:'active',seller_profile_id:old,...(['service','usta'].includes(type)?{provider_type:type}:{}),details:{keep:1}});
  f.state.profiles=[f.profile(business)];const r=await f.mount(type,{id:'existing',seller_profile_id:old});
  const token=mode==='unchanged'?f.intent.capture(r):f.choose(r,mode==='detach'?null:'profile-'+business);
  if(mode==='invalid')f.state.profiles=[];
  if(mode==='invalid'){await assert.rejects(f.edit(type,token));noWrite(f);assert.equal(f.state.tables[table(type)][0].seller_profile_id,old);}
  else{await f.edit(type,token);const update=f.state.ops.find(o=>o.op==='update');assert.ok(update);
   if(mode==='unchanged'){assert.ok(!Object.hasOwn(update.row,'seller_profile_id'));if(['service','usta'].includes(type))assert.ok(!Object.hasOwn(update.row,'provider_type'));assert.equal(f.state.rpcCalls,1);}
   else assert.equal(update.row.seller_profile_id,mode==='detach'?null:'profile-'+business);
  }
 });
}
test('discovery batches/caches across compatible forms; only safe DTO rendered',async()=>{
 const f=fixture();f.state.profiles=[f.profile('dealer',{owner_id:'PRIVATE',verified_by:'PRIVATE',display_name:'<script>evil</script>'})];
 const roots=[f.root(),f.root()];await Promise.all(roots.map(r=>f.intent.mount(r,'cars')));assert.equal(f.state.rpcCalls,1);
 await f.mount('rent');assert.equal(f.state.rpcCalls,1);assert.ok(roots[0].box.innerHTML.includes('&lt;script&gt;'));assert.ok(!roots[0].box.innerHTML.includes('PRIVATE'));assert.ok(!roots[0].box.innerHTML.includes('Rəsmi'));
});
test('discovery failure allows personal CREATE but explicit professional save stops',async()=>{
 const f=fixture();f.state.rpcError=true;const r=await f.mount('cars');await f.save('cars',f.intent.capture(r));assert.equal(f.state.tables.vehicle_listings[0].seller_profile_id,null);
 const g=fixture();g.state.profiles=[g.profile()];const root=await g.mount('cars'),token=g.choose(root,'profile-dealer');g.state.rpcError=true;await assert.rejects(g.save('cars',token));noWrite(g);
});
test('auth switch invalidates selection/cache and rejects already captured A token for B',async()=>{
 const f=fixture();f.state.profiles=[f.profile()];const r=await f.mount('cars'),token=f.choose(r,'profile-dealer');
 f.switchUser('owner-2');assert.throws(()=>f.intent.capture(r));await assert.rejects(f.save('cars',token));noWrite(f);
 f.state.profiles=[f.profile('dealer',{id:'B'})];const next=await f.mount('cars');assert.equal(f.state.rpcCalls,2);assert.ok(!next.box.innerHTML.includes('profile-dealer'));
});
test('auth change during fresh RPC rejects save without any INSERT',async()=>{
 const f=fixture();f.state.profiles=[f.profile()];const r=await f.mount('cars'),token=f.choose(r,'profile-dealer');
 let release;f.state.rpcWait=new Promise(resolve=>release=resolve);const saving=f.save('cars',token);
 await new Promise(resolve=>setImmediate(resolve));f.switchUser('owner-2');release();await assert.rejects(saving);noWrite(f);
});
test('forged token and ordinary seller_profile_id form data have no authority',async()=>{
 const f=fixture();await assert.rejects(f.save('cars',{seller_profile_id:'foreign'}));noWrite(f);
 const g=fixture();await g.save('cars',undefined,{seller_profile_id:'foreign'});assert.equal(g.state.tables.vehicle_listings[0].seller_profile_id,null);
 assert.ok(html.includes("'last_boosted_at','seller_profile_id'"));
});
test('token cannot switch source, listing ID or CREATE/UPDATE mode',async()=>{
 for(const mode of ['source','id','operation']){const f=fixture();f.state.profiles=[f.profile()];const r=await f.mount('cars',{id:'existing',seller_profile_id:null}),token=f.choose(r,'profile-dealer');
  await assert.rejects(mode==='source'?f.intent.resolve('rent',{id:f.state.owner},token,true,'existing'):mode==='id'?f.intent.resolve('cars',{id:f.state.owner},token,true,'foreign'):f.save('cars',token));noWrite(f);
 }
});
test('DB seller guard rejection preserves existing publish compensation, no media uploaded',async()=>{
 const f=fixture();f.state.profiles=[f.profile()];const r=await f.mount('cars'),token=f.choose(r,'profile-dealer');f.failure(o=>o.op==='insert',{code:'P0001'});await assert.rejects(f.save('cars',token));assert.equal(f.state.uploads,0);assert.equal(f.listings().length,0);
});
for(const [business,label] of Object.entries({dealer:'Avtosalon',store:'Mağaza',service:'Servis',usta:'Usta'}))for(const official of ['none','approved'])test(`detail ${business}/${official}: safe professional identity`,()=>{
 const f=fixture();f.window.AUSTA_SELLER_IDENTITY={getForListing:()=>f.profile(business,{official_status:official,owner_id:'PRIVATE',phone:'PRIVATE',verified_by:'PRIVATE',display_name:'<Business>'})};
 const text=f.intent.detail({seller_profile_id:'id',contact_name:'Listing contact',phone:'123'});
 assert.ok(text.includes('&lt;Business&gt;'));assert.ok(text.includes(label));assert.ok(text.includes('Təsdiqlənmiş'));assert.equal(text.includes('Rəsmi'),official==='approved');assert.ok(!text.includes('PRIVATE'));
});
test('personal/stale public identity leaves existing detail contact untouched',()=>{
 const f=fixture();f.window.AUSTA_SELLER_IDENTITY={getForListing:()=>null};const item={contact_name:'Contact',phone:'123',region:'Bakı',district:'Nəsimi',address:'Listing address'};const before=plain(item);assert.equal(f.intent.detail(item),'');assert.deepEqual(item,before);
 assert.ok(html.includes("if(target)target.innerHTML=window.AUSTA_SELLER_INTENT?.detail(item)||''"));
 assert.ok(html.includes('sellerOf(item)'));assert.ok(html.includes('const sellerIdentityReady=Promise.resolve(window.AUSTA_SELLER_IDENTITY?.hydrate([item]))'));
});
test('browser ownership discovery uses only no-argument RPC, never owner-column/application/cache lookup',()=>{
 assert.match(moduleSource,/\.rpc\('get_my_seller_profiles'\)/);assert.ok(!/\.from\(|localStorage|seller_verification_applications/.test(moduleSource));
});

for(const type of ['cars','rent','parts','service','usta','dealer'])test(`${type}: selected profile changing business type is rejected at fresh persistence boundary`,async()=>{
 const f=fixture(),business=compatibility[type];f.state.profiles=[f.profile(business)];const r=await f.mount(type),token=f.choose(r,f.state.profiles[0].id);
 f.state.profiles=[{...f.state.profiles[0],business_type:business==='dealer'?'store':'dealer'}];await assert.rejects(f.save(type,token));noWrite(f);
});
test('managed validation itself strips ordinary seller_profile_id before routing',()=>{
 const f=fixture();const output=f.api.validateListingInput('cars',{...valid,seller_profile_id:'forged'},false);assert.ok(!Object.hasOwn(output,'seller_profile_id'));
});
test('real form save captures and forwards seller intent separately from generic router input',async()=>{
 const f=fixture();f.state.profiles=[f.profile()];const r=await f.mount('cars');f.choose(r,'profile-dealer');
 const get=f.document.getElementById;f.document.getElementById=id=>id==='austaV153CFields'?r:get(id);
 const form=f.installForm();f.state.formType='cars';f.window.__formInput={...valid};await form.save();
 assert.equal(f.state.tables.vehicle_listings[0].seller_profile_id,'profile-dealer');assert.equal(f.state.rpcCalls,2);
});
test('malformed discovery response fails safely; stale UPDATE is preserved when no intent',async()=>{
 const f=fixture();f.state.profiles=null;const r=await f.mount('cars',{id:'existing',seller_profile_id:'revoked'});
 f.state.tables.vehicle_listings.push({id:'existing',owner_id:f.state.owner,status:'active',seller_profile_id:'revoked'});
 assert.ok(r.box.innerHTML.includes('Mövcud peşəkar profil'));await f.edit('cars',f.intent.capture(r));
 assert.equal(f.state.tables.vehicle_listings[0].seller_profile_id,'revoked');assert.ok(!Object.hasOwn(f.state.ops.find(o=>o.op==='update').row,'seller_profile_id'));
});
test('same-user session change invalidates pending intent as well as discovery cache',async()=>{
 const f=fixture();f.state.profiles=[f.profile()];const r=await f.mount('cars');f.choose(r,'profile-dealer');
 const sb=f.window.AUSTA_SUPABASE;sb.auth.getSession=async()=>({data:{session:{user:{id:f.state.owner},access_token:'renewed'}},error:null});
 const token=f.intent.capture(r);await assert.rejects(f.save('cars',token));assert.throws(()=>f.intent.capture(r));noWrite(f);
});
const detailFile=path.join(__dirname,'category-detail-presentation.test.cjs'),detailModule=new Module(detailFile,module);detailModule.filename=detailFile;detailModule.paths=module.paths;
const detailCode=fs.readFileSync(detailFile,'utf8').split('for(const [category,fields] of Object.entries(definitions)){')[0]
 .replace('appendChild(page){this.page=page}',"appendChild(page){this.page=page;page.isConnected=true;this.sellerTarget={innerHTML:''};page.querySelector=selector=>selector==='[data-professional-seller]'?this.sellerTarget:null;}")
 .replace('return {c,rows(item)', 'return {c,document,rows(item)');
detailModule._compile(detailCode+'\nmodule.exports=fixture;',detailFile);
for(const [category,business] of Object.entries({cars:'dealer',rent:'dealer',parts:'store',service:'service',usta:'usta',dealer:'dealer'}))test(`${category}: actual full-detail entry renders public professional identity without replacing listing contact`,async()=>{
 const detail=detailModule.exports();detail.document.addEventListener=()=>{};vm.runInContext(fs.readFileSync(path.join(root,'assets/vehicle/vin.js'),'utf8'),detail.c);vm.runInContext(moduleSource,detail.c);
 const publicProfile={id:'seller',business_type:business,display_name:'Professional name',status:'active',verification_status:'verified',official_status:'none',owner_id:'PRIVATE',phone:'PRIVATE'};
 detail.c.window.AUSTA_SELLER_IDENTITY.getForListing=()=>publicProfile;
 await detail.render({category,seller_profile_id:'seller',contact_name:'Listing Contact',phone:'123',region:'Bakı',status:'active'});
 assert.ok(detail.document.body.sellerTarget.innerHTML.includes('Professional name'));assert.ok(detail.document.body.sellerTarget.innerHTML.includes('Təsdiqlənmiş'));assert.ok(!detail.document.body.sellerTarget.innerHTML.includes('PRIVATE'));
 assert.ok(detail.document.body.page.innerHTML.includes('123'));
});

for(const type of ['service','usta'])test(`${type}: same-type sparse update avoids seller trigger columns, explicit type switch remains guarded`,async()=>{
 const f=fixture();f.state.tables.service_provider_listings.push({id:'existing',owner_id:f.state.owner,status:'active',provider_type:type,seller_profile_id:'revoked'});
 await f.api.updateListing(type,'existing',{phone:'456'});
 const update=f.state.ops.find(o=>o.op==='update');assert.ok(!Object.hasOwn(update.row,'provider_type'));assert.ok(!Object.hasOwn(update.row,'seller_profile_id'));assert.ok(!Object.hasOwn(update.row,'owner_id'));
 const g=fixture();g.state.tables.service_provider_listings.push({id:'existing',owner_id:g.state.owner,status:'active',provider_type:type==='service'?'usta':'service',seller_profile_id:null});await g.api.updateListing(type,'existing',{phone:'456'});assert.equal(g.state.ops.find(o=>o.op==='update').row.provider_type,type);
});

const flushSeller=async()=>{for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));};
function deferredSellerRPC(f){
 const requests=[];
 f.window.AUSTA_SUPABASE.rpc=name=>{
  assert.equal(name,'get_my_seller_profiles');f.state.rpcCalls++;f.state.ops.push({op:'rpc'});
  let resolve;const promise=new Promise(r=>resolve=r);
  requests.push({owner:f.state.owner,resolve,promise});return promise;
 };
 return requests;
}
function selectSellerOnly(root,value){root.box.select.value=value||'';root.box.select.change();}
// A scheduling gate after the real load has run exposes the outer-completion gap.
// It does not replace discovery, selection, callback logic or their guards.
const gatedSellerLoad=source=>source.replace('window.AUSTA_SELLER_INTENT=Object.freeze',`
 const actualSellerLoad=load;let firstSellerState;
 load=async state=>{
  firstSellerState ||= state;
  const result=await actualSellerLoad(state);
  if(state===firstSellerState&&window.__sellerCompletionGate)await window.__sellerCompletionGate;
  return result;
 };
 window.AUSTA_SELLER_INTENT=Object.freeze`);
test('race A→B: old A Personal callback cannot downgrade B professional selection or trusted save',async()=>{
 const f=fixture(),requests=deferredSellerRPC(f),root=f.root();
 const initial=f.intent.mount(root,'cars');await flushSeller();assert.equal(requests.length,1);
 selectSellerOnly(root,null);await flushSeller(); // A callback now waits on A request.
 f.switchUser('owner-B');selectSellerOnly(root,null);await flushSeller();assert.equal(requests.length,2);
 const b=f.profile('dealer',{id:'B-profile',display_name:'B business'});
 requests[1].resolve({data:[b],error:null});await flushSeller();
 f.choose(root,b.id);const before={html:root.box.innerHTML,renders:root.box.renderCount,value:root.box.select.value};
 assert.equal(before.value,b.id);assert.doesNotThrow(()=>f.intent.capture(root));
 requests[0].resolve({data:[f.profile('dealer',{id:'A-profile'})],error:null});await initial;await flushSeller();
 assert.deepEqual({html:root.box.innerHTML,renders:root.box.renderCount,value:root.box.select.value},before);
 const saving=f.save('cars',f.intent.capture(root));await flushSeller();assert.equal(requests.length,3);assert.equal(requests[2].owner,'owner-B');
 requests[2].resolve({data:[b],error:null});await saving;
 assert.equal(f.state.tables.vehicle_listings[0].owner_id,'owner-B');assert.equal(f.state.tables.vehicle_listings[0].seller_profile_id,b.id);
});
test('race same user: newer professional decision survives old Personal completion',async()=>{
 const f=fixture(gatedSellerLoad),requests=deferredSellerRPC(f),root=f.root();let release;
 f.window.__sellerCompletionGate=new Promise(r=>release=r);
 const initial=f.intent.mount(root,'cars');await flushSeller();selectSellerOnly(root,null);await flushSeller();
 const profile=f.profile();requests[0].resolve({data:[profile],error:null});await flushSeller();
 f.choose(root,profile.id);const before={html:root.box.innerHTML,renders:root.box.renderCount,value:root.box.select.value};
 release();await initial;await flushSeller();
 assert.deepEqual({html:root.box.innerHTML,renders:root.box.renderCount,value:root.box.select.value},before);
 const saving=f.save('cars',f.intent.capture(root));await flushSeller();requests[1].resolve({data:[profile],error:null});await saving;assert.equal(f.state.tables.vehicle_listings[0].seller_profile_id,profile.id);
});
test('race same user: newest professional switch survives old Personal completion',async()=>{
 const f=fixture(gatedSellerLoad),requests=deferredSellerRPC(f),root=f.root();let release;
 f.window.__sellerCompletionGate=new Promise(r=>release=r);
 const initial=f.intent.mount(root,'cars');await flushSeller();selectSellerOnly(root,null);await flushSeller();
 const first=f.profile(),second=f.profile('dealer',{id:'second-profile'});requests[0].resolve({data:[first,second],error:null});await flushSeller();
 f.choose(root,first.id);f.choose(root,second.id);const before=root.box.renderCount;
 release();await initial;await flushSeller();assert.equal(root.box.select.value,second.id);assert.equal(root.box.renderCount,before);
 const resolving=f.intent.resolve('cars',{id:f.state.owner},f.intent.capture(root));await flushSeller();requests[1].resolve({data:[first,second],error:null});assert.equal((await resolving).seller_profile_id,second.id);
});
test('race stale mount: obsolete completion does not mutate or render old/new form state',async()=>{
 const f=fixture(gatedSellerLoad),requests=deferredSellerRPC(f),root=f.root();let release;
 f.window.__sellerCompletionGate=new Promise(r=>release=r);
 const initial=f.intent.mount(root,'cars');await flushSeller();selectSellerOnly(root,null);await flushSeller();const oldBox=root.box;
 const replacement=f.intent.mount(root,'cars');await flushSeller();const profile=f.profile();requests[0].resolve({data:[profile],error:null});await replacement;await flushSeller();
 f.choose(root,profile.id);const before={oldRenders:oldBox.renderCount,newRenders:root.box.renderCount,html:root.box.innerHTML,value:root.box.select.value};
 release();await initial;await flushSeller();assert.deepEqual({oldRenders:oldBox.renderCount,newRenders:root.box.renderCount,html:root.box.innerHTML,value:root.box.select.value},before);
 assert.doesNotThrow(()=>f.intent.capture(root));
});
test('race logout: delayed Personal completion cannot unblock invalidated selection',async()=>{
 const f=fixture(),requests=deferredSellerRPC(f),root=f.root();const initial=f.intent.mount(root,'cars');await flushSeller();selectSellerOnly(root,null);await flushSeller();
 f.switchUser(null);const before={html:root.box.innerHTML,renders:root.box.renderCount};
 requests[0].resolve({data:[f.profile()],error:null});await initial;await flushSeller();assert.deepEqual({html:root.box.innerHTML,renders:root.box.renderCount},before);assert.throws(()=>f.intent.capture(root));noWrite(f);
});
for(const failed of [false,true])test(`race current Personal callback remains valid with RPC ${failed?'failure':'success'}`,async()=>{
 const f=fixture(),requests=deferredSellerRPC(f),root=f.root();const initial=f.intent.mount(root,'cars');await flushSeller();selectSellerOnly(root,null);await flushSeller();
 requests[0].resolve({data:failed?null:[f.profile()],error:failed?new Error('network'):null});await initial;await flushSeller();
 assert.equal(root.box.select.value,'');const token=f.intent.capture(root);await f.save('cars',token);assert.equal(requests.length,1);assert.equal(f.state.tables.vehicle_listings[0].seller_profile_id,null);
});
