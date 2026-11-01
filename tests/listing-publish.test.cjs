const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const block=id=>html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'))[1];
const ids={router:'austa-v153b-all-real-listing-router',media:'austa-v153d-14-category-media-js',form:'austa-v153c-real-listing-form-js'};
const maps={cars:['vehicle_listings','listing_media','listing-media'],rent:['vehicle_listings','listing_media','listing-media'],parts:['marketplace_listings','marketplace_listing_media','marketplace-media'],service:['service_provider_listings','service_provider_media','provider-media'],usta:['service_provider_listings','service_provider_media','provider-media'],dealer:['auto_dealer_listings','auto_dealer_media','auto-dealer-media']};
const input={title:'Listing',name:'Name',specialty:'Repair',brand:'BMW',model:'X5',year:2022,price:10,phone:'test',region:'Bakı',address:'Address',dealer_name:'Dealer'};
const photo=name=>({name,type:'image/jpeg',size:128}),video=name=>({name,type:'video/mp4',size:256});
function fixture(){
 const state={tables:{},objects:new Set(),events:[],ops:[],failures:[],owner:'owner-1',uploads:0,insertions:0,alerts:[],timers:[],removed:0};
 Object.values(maps).flatMap(x=>x.slice(0,2)).forEach(t=>state.tables[t]=[]);
 const files={images:[],videos:[]};
 const status={style:{},textContent:''},button={disabled:false,textContent:''};
 let serial=0,gate=null;
 const fail=op=>{const i=state.failures.findIndex(f=>f.match(op));if(i<0)return null;const rule=state.failures[i];if(rule.once!==false)state.failures.splice(i,1);return rule;};
 class Q{
  constructor(table){this.table=table;this.op='read';this.filters=[];this.one=false;}
  order(){return this;}range(start,end){this.rangeN=[start,end];return this;}
  select(){return this;}eq(c,v){this.filters.push([c,v]);return this;}limit(n){this.limitN=n;return this;}
  insert(row){this.op='insert';this.row={...row};return this;}update(row){this.op='update';this.row={...row};return this;}
  delete(){this.op='delete';return this;}single(){this.one=true;return this;}maybeSingle(){this.one=true;return this;}
  then(ok,bad){return Promise.resolve().then(()=>this.exec()).then(ok,bad);}
  exec(){
   const op={table:this.table,op:this.op,row:this.row,filters:this.filters};state.ops.push(op);
   const rule=fail(op);if(rule&&!rule.after)return {data:null,error:Object.assign(new Error('SDK private path/token must not escape'),{code:rule.code||'42501'})};
   let rows=state.tables[this.table];assert.ok(rows,this.table);
   let selected=rows.filter(r=>this.filters.every(([c,v])=>r[c]===v));
   if(this.op==='insert'){
    const r={id:'row-'+(++serial),...this.row};rows.push(r);selected=[r];
    if(!this.table.endsWith('_media')){state.insertions++;assert.equal(r.status,this.table==='vehicle_listings'?'draft':'inactive','source-specific private staging');}
   }else if(this.op==='update'||this.op==='delete'){
    assert.ok(this.filters.some(([c,v])=>c==='owner_id'&&v===state.owner),'owner scope');
    assert.ok(this.filters.some(([c])=>c==='id'||c==='listing_id'),'listing scope');
    if(this.op==='update')selected.forEach(r=>Object.assign(r,this.row));
    else state.tables[this.table]=rows.filter(r=>!selected.includes(r));
   }
   if(rule?.after)return {data:null,error:Object.assign(new Error('response lost'),{code:rule.code||'NETWORK'})};
   if(this.limitN)selected=selected.slice(0,this.limitN);
   if(this.rangeN)selected=selected.slice(this.rangeN[0],this.rangeN[1]+1);
   return {data:this.one?(selected[0]?{...selected[0]}:null):selected.map(r=>({...r})),error:null};
  }
 }
 const sb={auth:{getUser:async()=>({data:{user:{id:state.owner}},error:null}),getSession:async()=>({data:{session:{user:{id:state.owner}}},error:null})},
  from:t=>new Q(t),storage:{from(bucket){return {
   async upload(p){
    const op={table:bucket,op:'upload',path:p,n:++state.uploads};state.ops.push(op);
    if(gate)await gate;
    const rule=fail(op);if(rule)return {data:null,error:new Error('upload failed')};
    state.objects.add(bucket+':'+p);return {data:{path:p},error:null};
   },
   async remove(paths){
    const op={table:bucket,op:'remove',paths};state.ops.push(op);const rule=fail(op);
    if(rule)return {data:null,error:new Error('remove failed')};
    paths.forEach(p=>state.objects.delete(bucket+':'+p));return {data:paths.map(name=>({name})),error:null};
   }
  };}}};
 const document={readyState:'loading',addEventListener(){},getElementById(id){
  if(id==='austaV153DImages')return {files:files.images};if(id==='austaV153DVideo')return {files:files.videos};
  if(id==='austaV153CStatus')return status;if(id==='austaV153CSave')return button;
  if(id==='austaV153CCategory')return {value:state.formType||'parts'};
  if(id==='austaV153COverlay')return {remove(){state.removed++;}};
  return null;
 },querySelectorAll(selector){
  if(selector==='#austaV153CFields [data-v153c-key]')return Object.entries(input).map(([key,value])=>({dataset:{v153cKey:key},value}));
  return [];
 }};
 const window={AUSTA_SUPABASE:sb,crypto:{randomUUID:()=>`object-${++serial}`},
  dispatchEvent(event){state.events.push(event);},AUSTA_V153C:{open(){},edit:async()=>{}},
  AUSTA_VEHICLE_TECHNICAL:{fields:[],rentFields:[],payload:()=>({}),pruneUpdate(){}},
  AUSTA_MARKETPLACE_CARD_DATA:{saleFields:[],salePayload:()=>({})},AUSTA_VEHICLE_VIN:{fields:[],payload:()=>({})}};
 const context=vm.createContext({window,document,console:{log(){},warn(){},error(){}},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
  setTimeout(fn,ms){state.timers.push({fn,ms});},clearTimeout(){},alert(message){state.alerts.push(message);}});
 vm.runInContext(fs.readFileSync(path.join(root,'assets/marketplace/listing-publish.js'),'utf8'),context);
 vm.runInContext(block(ids.router),context);
 const core=window.AUSTA_V153.saveListing;
 const media=block(ids.media),end=media.lastIndexOf('})();');
 vm.runInContext(media.slice(0,end)+`window.__media={patchSave,uploadMedia,setDealerEdit:item=>{dealerEditItem=item;}};`+media.slice(end),context);
 window.__media.patchSave();
 const api=window.AUSTA_V153;
 const create=(type='parts',extra={})=>api.saveListing(type,{...input,...extra});
 const failure=(match,options={})=>state.failures.push({match,...options});
 function installForm(){
  const form=block(ids.form),end=form.lastIndexOf('})();');
  vm.runInContext(form.slice(0,end)+`
    readFields=()=>({...window.__formInput});validate=()=>{};buildRouterInput=()=>window.__formInput;
    window.__form={save:saveCurrentListing,invalidate:()=>++formGeneration};
  `+form.slice(end),context);
  // Older coordinator tests model explicit user confirmation at the new UI seam.
  // P1.4 focused tests replace this adapter with the actual preview runtime.
  let prepared;
  window.AUSTA_LISTING_PREVIEW={review:async options=>{prepared=options;return {};},
   consume:async()=>prepared,success(){},failure(){},cancel(){}};
  window.__formInput={...input};return window.__form;
 }
 return {state,files,window,api,core,create,failure,installForm,status,button,
  hold(){gate=new Promise(resolve=>{state.release=()=>{gate=null;resolve();};});},
  listings:()=>Object.entries(state.tables).filter(([t])=>!t.endsWith('_media')).flatMap(([,r])=>r),
  media:()=>Object.entries(state.tables).filter(([t])=>t.endsWith('_media')).flatMap(([,r])=>r)};
}
const noSuccess=f=>assert.equal(f.state.events.filter(e=>e.type==='austa:real-listing-created').length,0);
const clean=f=>{assert.equal(f.listings().length,0);assert.equal(f.media().length,0);assert.equal(f.state.objects.size,0);noSuccess(f);};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

for(const type of Object.keys(maps)){
 test(`${type}: zero optional files publishes only after activation`,async()=>{
  const f=fixture();await f.create(type);
  assert.equal(f.listings().length,1);assert.equal(f.listings()[0].status,'active');
  assert.equal(f.state.uploads,0);assert.equal(f.state.events.length,1);
  const ops=f.state.ops;assert.ok(ops.findIndex(o=>o.op==='insert'&&o.row?.status===(maps[type][0]==='vehicle_listings'?'draft':'inactive'))<ops.findIndex(o=>o.row?.status==='active'));
 });
 test(`${type}: images/video complete before public activation`,async()=>{
  const f=fixture();f.files.images=[photo('a.jpg'),photo('b.jpg')];f.files.videos=[video('a.mp4')];
  await f.create(type);assert.equal(f.media().length,3);assert.equal(f.state.objects.size,3);
  assert.equal(f.listings()[0].status,'active');
  if(['cars','rent','parts'].includes(type))assert.equal(f.listings()[0].has_video,true);
  const active=f.state.ops.findIndex(o=>o.row?.status==='active');
  assert.ok(active>f.state.ops.map(o=>o.op).lastIndexOf('upload'));
 });
 test(`${type}: later upload failure compensates only new work`,async()=>{
  const f=fixture();f.files.images=[photo('a.jpg'),photo('b.jpg')];f.failure(o=>o.op==='upload'&&o.n===2);
  await assert.rejects(f.create(type),e=>e.code==='PUBLISH_FAILED');clean(f);
 });
}
for(const type of ['accessories','moto','special','bus','water','caravan','trailer','plate']){
 test(`${type}: shared staged Marketplace publish`,async()=>{
  const f=fixture();f.files.images=[photo('image.jpg')];await f.create(type);
  assert.equal(f.listings()[0].category,type);assert.equal(f.listings()[0].status,'active');
 });
}
test('listing insert rejected: no upload, no public row, retry succeeds',async()=>{
 const f=fixture();f.failure(o=>o.table==='marketplace_listings'&&o.op==='insert',{code:'23514'});
 await assert.rejects(f.create(),e=>e.code==='PUBLISH_FAILED');clean(f);await f.create();assert.equal(f.listings().length,1);
});
test('first upload fails: new inactive listing rolled back',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='upload');await assert.rejects(f.create());clean(f);
});
test('Storage success + relation failure: row/object/listing cleanup',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];f.failure(o=>o.table==='marketplace_listing_media'&&o.op==='insert');
 await assert.rejects(f.create());clean(f);
 const steps=f.state.ops.filter(o=>o.op==='delete'||o.op==='remove').map(o=>o.table);
 assert.deepEqual(steps,['marketplace_listing_media','marketplace-media','marketplace_listings']);
});
test('relation insert response lost: exact path cleanup removes possibly committed relation',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];f.failure(o=>o.table==='marketplace_listing_media'&&o.op==='insert',{after:true});
 await assert.rejects(f.create());clean(f);
});
for(const type of ['parts','cars','rent']){
 test(`${type}: derived video flag sync failure rolls back publish`,async()=>{
  const f=fixture();f.files.videos=[video('a.mp4')];
  f.failure(o=>o.op==='update'&&o.row?.has_video===true);
  await assert.rejects(f.create(type));clean(f);
 });
}
test('activation failure: quarantine and cleanup, no false success',async()=>{
 const f=fixture();f.failure(o=>o.op==='update'&&o.row?.status==='active');await assert.rejects(f.create());clean(f);
});
test('lost activation response: quarantine removes public row before cleanup',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='update'&&o.row?.status==='active',{after:true});
 await assert.rejects(f.create());clean(f);
 assert.ok(f.state.ops.some(o=>o.op==='update'&&o.row?.status==='inactive'));
});
test('Storage cleanup failure retains inactive parent; retry finishes cleanup before new insert',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];
 f.failure(o=>o.table==='marketplace_listing_media'&&o.op==='insert');
 f.failure(o=>o.op==='remove',{once:false});
 await assert.rejects(f.create(),e=>e.code==='PUBLISH_CLEANUP_PENDING');
 assert.equal(f.listings()[0].status,'inactive');assert.equal(f.state.objects.size,1);noSuccess(f);
 await assert.rejects(f.create());assert.equal(f.state.insertions,1);
 f.state.failures=[];await f.create();assert.equal(f.listings().length,1);assert.equal(f.listings()[0].status,'active');
 assert.equal(f.state.objects.size,1);
});
test('listing cleanup failure blocks duplicate create until retry cleanup succeeds',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='upload');
 f.failure(o=>o.op==='delete'&&o.table==='marketplace_listings',{once:false});
 await assert.rejects(f.create());await assert.rejects(f.create());assert.equal(f.state.insertions,1);
 assert.equal(f.listings()[0].status,'inactive');f.state.failures=[];
 await f.create();assert.equal(f.listings().length,1);assert.equal(f.state.insertions,2);
});
test('media cleanup failure keeps object and parent for authorized retry',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg'),photo('b.jpg')];f.failure(o=>o.op==='upload'&&o.n===2);
 f.failure(o=>o.op==='delete'&&o.table==='marketplace_listing_media',{once:false});
 await assert.rejects(f.create());assert.equal(f.media().length,1);assert.equal(f.state.objects.size,1);
 assert.equal(f.listings()[0].status,'inactive');noSuccess(f);
 f.state.failures=[];await f.create();assert.equal(f.listings().length,1);assert.equal(f.media().length,2);
});
test('lost listing insert response: no blind duplicate retry',async()=>{
 const f=fixture();f.failure(o=>o.op==='insert'&&o.table==='marketplace_listings',{after:true,code:'NETWORK'});
 await assert.rejects(f.create(),e=>e.code==='PUBLISH_CLEANUP_PENDING');
 await assert.rejects(f.create());assert.equal(f.state.insertions,1);assert.equal(f.listings()[0].status,'inactive');noSuccess(f);
});
test('rapid double/repeated API submits share one attempt and one event',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];f.hold();
 const first=f.create();const second=f.create();await tick();
 assert.equal(f.state.insertions,1);assert.equal(f.listings()[0].status,'inactive');noSuccess(f);
 const third=f.create();f.state.release();const results=await Promise.all([first,second,third]);
 assert.equal(f.state.insertions,1);assert.equal(f.state.events.length,1);assert.strictEqual(results[0],results[1]);
 await f.create();assert.equal(f.state.insertions,1);assert.equal(f.state.events.length,1);
});
test('fresh explicit form session permits next intentional listing',async()=>{
 const f=fixture();await f.create();assert.equal(f.window.AUSTA_LISTING_PUBLISH.begin(),true);await f.create();
 assert.equal(f.listings().length,2);assert.equal(f.state.events.length,2);
});
test('legacy lexical original call routes through coordinator once',async()=>{
 const f=fixture();await f.core('parts',input);assert.equal(f.state.insertions,1);assert.equal(f.state.events.length,1);
});
test('cleanup does not touch existing media/listings or another owner',async()=>{
 const f=fixture();const old={id:'old-listing',owner_id:'someone-else',status:'active',has_video:true};
 f.state.tables.marketplace_listings.push(old);f.state.tables.marketplace_listing_media.push({id:'old-media',listing_id:'old-listing',owner_id:'someone-else',storage_path:'someone-else/old-listing/old.mp4',media_type:'video'});
 f.state.objects.add('marketplace-media:someone-else/old-listing/old.mp4');
 f.files.images=[photo('a.jpg')];f.failure(o=>o.table==='marketplace_listing_media'&&o.op==='insert');await assert.rejects(f.create());
 assert.deepEqual(f.listings(),[old]);assert.equal(f.media().length,1);assert.equal(f.state.objects.size,1);
});
test('existing edit append failure never deletes original listing',async()=>{
 const f=fixture();f.state.tables.marketplace_listings.push({id:'existing',owner_id:'owner-1',status:'active',title:'Original',has_video:false});
 f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='upload');
 await assert.rejects(f.api.updateListing('parts','existing',input));assert.equal(f.listings().length,1);assert.equal(f.listings()[0].status,'active');
 assert.ok(!f.state.ops.some(o=>o.op==='delete'&&o.table==='marketplace_listings'));
});
test('form double submit disabled/guarded through success and delayed close',async()=>{
 const f=fixture(),form=f.installForm();f.files.images=[photo('a.jpg')];f.hold();
 const first=form.save();await tick();await form.save();assert.equal(f.state.insertions,1);
 assert.equal(f.button.disabled,true);assert.ok(!f.status.textContent.includes('uğurla'));assert.equal(f.state.removed,0);
 f.state.release();await first;assert.ok(f.status.textContent.includes('uğurla'));assert.equal(f.button.disabled,true);
 await form.save();assert.equal(f.state.insertions,1);assert.equal(f.state.removed,0);
 f.state.timers.find(t=>t.ms===800).fn();assert.equal(f.state.removed,1);
});
test('failed form publish keeps input/form open and permits controlled retry',async()=>{
 const f=fixture(),form=f.installForm();f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='upload');
 await form.save();assert.equal(f.button.disabled,false);assert.ok(!f.status.textContent.includes('uğurla'));
 assert.equal(f.state.removed,0);assert.equal(f.state.timers.filter(t=>t.ms===800).length,0);noSuccess(f);
 assert.equal(f.files.images.length,1);assert.ok(!f.status.textContent.includes('SDK'));
 await form.save();assert.equal(f.listings().length,1);assert.equal(f.listings()[0].status,'active');
});
test('late form success timer cannot close a newer form generation',async()=>{
 const f=fixture(),form=f.installForm();await form.save();form.invalidate();
 f.state.timers.find(t=>t.ms===800).fn();assert.equal(f.state.removed,0);
});

test('empty Storage removal acknowledgement is not treated as cleanup success',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];
 const original=f.window.AUSTA_SUPABASE.storage.from;
 f.window.AUSTA_SUPABASE.storage.from=bucket=>({...original(bucket),remove:async()=>({data:[],error:null})});
 f.failure(o=>o.op==='insert'&&o.table==='marketplace_listing_media');
 await assert.rejects(f.create(),e=>e.code==='PUBLISH_CLEANUP_PENDING');
 assert.equal(f.listings()[0].status,'inactive');assert.equal(f.state.objects.size,1);noSuccess(f);
});
test('quarantine failure after ambiguous activation blocks destructive cleanup/recreate',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];
 f.failure(o=>o.op==='update'&&o.row?.status==='active',{after:true});
 f.failure(o=>o.op==='update'&&o.row?.status==='inactive',{once:false});
 await assert.rejects(f.create());await assert.rejects(f.create());
 assert.equal(f.state.insertions,1);assert.equal(f.media().length,1);noSuccess(f);
 assert.ok(!f.state.ops.some(o=>o.op==='remove'));
 f.state.failures=[];await f.create();assert.equal(f.listings().length,1);
});
test('account switch cannot clean old owner work or leak a cached completion',async()=>{
 const f=fixture();await f.create();f.state.owner='owner-2';await assert.rejects(f.create());
 assert.equal(f.listings().length,1);assert.equal(f.state.insertions,1);
});
test('normalized legacy category alias keeps the shared publish path',async()=>{
 const f=fixture();await f.create('Ehtiyat hissələri');assert.equal(f.listings()[0].category,'parts');
});
test('missing coordinator fails before listing insert',async()=>{
 const f=fixture();delete f.window.AUSTA_LISTING_PUBLISH;
 await assert.rejects(f.create());assert.equal(f.state.insertions,0);noSuccess(f);
});
test('opening a form cannot reset an in-flight attempt',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];f.hold();const first=f.create();await tick();
 assert.equal(f.window.AUSTA_LISTING_PUBLISH.begin(),false);f.state.release();await first;
 assert.equal(f.state.insertions,1);
});
test('real validation has no selected-media requirement',()=>{
 const source=block(ids.form);const start=source.indexOf('function validate('),end=source.indexOf('\nfunction ',start+10);
 const validate=source.slice(start,end);assert.ok(start>0);
 assert.ok(!validate.includes('selectedFiles')&&!validate.includes('austaV153DImages')&&!validate.includes('austaV153DVideo'));
});
for(const type of ['service','usta']){
 test(`${type}: denied provider Storage upload stays private and compensates listing`,async()=>{
  const f=fixture();f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='upload'&&o.table==='provider-media');
  await assert.rejects(f.create(type));clean(f);
 });
}
for(const type of ['parts','cars','rent']){
 test(`${type}: derived media query error never activates`,async()=>{
  const f=fixture();f.files.videos=[video('a.mp4')];f.failure(o=>o.op==='read'&&o.table===maps[type][1]);
  await assert.rejects(f.create(type));clean(f);
 });
 test(`${type}: images-only publish cannot fabricate has_video`,async()=>{
  const f=fixture();f.files.images=[photo('a.jpg')];await f.create(type,{has_video:true});
  assert.equal(f.listings()[0].has_video,false);assert.equal(f.listings()[0].status,'active');
 });
}
test('selected media snapshot does not change while an upload is in flight',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg'),photo('b.jpg')];f.hold();const first=f.create();await tick();
 f.files.images=[photo('changed.jpg')];f.state.release();await first;
 assert.equal(f.media().length,2);assert.ok([...f.state.objects].some(p=>p.endsWith('a.jpg')));
 assert.ok(![...f.state.objects].some(p=>p.endsWith('changed.jpg')));
});

for(const type of ['cars','rent']){
 test(`${type}: existing edit append failure never invokes create rollback`,async()=>{
  const f=fixture();f.state.tables.vehicle_listings.push({id:'existing',owner_id:'owner-1',status:'active',listing_type:type==='rent'?'rent':'sale',has_video:false});
  f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='upload');
  await assert.rejects(f.api.updateListing(type,'existing',input));assert.equal(f.listings().length,1);
  assert.equal(f.listings()[0].status,'active');assert.ok(!f.state.ops.some(o=>o.op==='delete'&&o.table==='vehicle_listings'));
 });
}
for(const type of ['service','usta']){
 test(`${type}: existing metadata edit remains outside new-create compensation`,async()=>{
  const f=fixture();f.state.tables.service_provider_listings.push({id:'existing',owner_id:'owner-1',status:'active',provider_type:type});
  await f.api.updateListing(type,'existing',input);assert.equal(f.listings()[0].status,'active');assert.equal(f.state.insertions,0);
  assert.ok(!f.state.ops.some(o=>o.op==='delete'));
 });
}
test('dealer edit media failure retains existing listing and edit mode',async()=>{
 const f=fixture();const existing={id:'existing',owner_id:'owner-1',status:'active',dealer_name:'Old'};
 f.state.tables.auto_dealer_listings.push(existing);f.window.__media.setDealerEdit(existing);
 f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='upload');await assert.rejects(f.create('dealer'));
 assert.equal(f.listings().length,1);assert.equal(f.listings()[0].status,'active');assert.equal(f.state.insertions,0);
 assert.ok(!f.state.ops.some(o=>o.op==='delete'&&o.table==='auto_dealer_listings'));
 await f.create('dealer');assert.equal(f.state.insertions,0);
});

// P0.3.1: exercise the coordinator boundary independently of form normalization.
function coordinator(f,source,status,extra={}){
 const config={parentTable:source,table:source==='vehicle_listings'?'listing_media':'marketplace_listing_media',bucket:'listing-media',...extra.config};
 return f.window.AUSTA_LISTING_PUBLISH.run({client:f.window.AUSTA_SUPABASE,
  user:{id:'owner-1'},config,files:{images:[],videos:[]},
  create:async()=>({id:'test',owner_id:'owner-1',status}),upload:async()=>{},...extra,config});
}
for(const status of ['inactive','sold','rented','archived','active',null,undefined]){
 test(`Vehicle guard rejects ${status} before upload or activation`,async()=>{
  const f=fixture();let uploads=0;
  await assert.rejects(coordinator(f,'vehicle_listings',status,{upload:async()=>{uploads++;}}));
  assert.equal(uploads,0);assert.equal(f.state.ops.length,0);noSuccess(f);
 });
}
for(const source of ['marketplace_listings','service_provider_listings','auto_dealer_listings']){
 test(`${source}: draft is not an accepted staging alternative`,async()=>{
  const f=fixture();await assert.rejects(coordinator(f,source,'draft'));assert.equal(f.state.ops.length,0);
 });
}
for(const status of ['inactive','active','sold','rented','archived','nonsense']){
 test(`Vehicle rejects caller expected staging ${status}`,async()=>{
  for(const field of ['option','config']){
   const f=fixture();let created=false;
   await assert.rejects(coordinator(f,'vehicle_listings','draft',{
    ...(field==='option'?{stagingStatus:status}:{config:{stagingStatus:status}}),
    create:async()=>{created=true;return null;}}));
   assert.equal(created,false);assert.equal(f.state.ops.length,0);
  }
 });
}
test('unknown/inherited source cannot select a staging contract',async()=>{
 for(const source of ['unknown','toString','__proto__']){
  const f=fixture();await assert.rejects(coordinator(f,source,'draft'));assert.equal(f.state.ops.length,0);
 }
});
for(const type of ['cars','rent']){
 test(`${type}: form status/config injection cannot choose staging or activation`,async()=>{
  const f=fixture();await f.create(type,{status:'sold',stagingStatus:'inactive',config:{parentTable:'marketplace_listings',stagingStatus:'inactive'},owner_id:'attacker'});
  const insert=f.state.ops.find(o=>o.op==='insert');assert.equal(insert.table,'vehicle_listings');
  assert.equal(insert.row.status,'draft');assert.equal(insert.row.owner_id,'owner-1');
  assert.ok(!f.state.ops.some(o=>o.row?.status==='inactive'));
  const active=f.state.ops.find(o=>o.row?.status==='active');
  assert.ok(active.filters.some(([k,v])=>k==='status'&&v==='draft'));
  assert.ok(active.filters.some(([k,v])=>k==='owner_id'&&v==='owner-1'));
 });
 test(`${type}: failed upload deletes only expected draft parent`,async()=>{
  const f=fixture();f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='upload');
  await assert.rejects(f.create(type));clean(f);
  const deletion=f.state.ops.find(o=>o.op==='delete'&&o.table==='vehicle_listings');
  assert.ok(deletion.filters.some(([k,v])=>k==='status'&&v==='draft'));
  assert.ok(deletion.filters.some(([k,v])=>k==='owner_id'&&v==='owner-1'));
 });
 test(`${type}: lost activation response quarantines active to draft with owner/status guards`,async()=>{
  const f=fixture();f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='update'&&o.row?.status==='active',{after:true});
  await assert.rejects(f.create(type));clean(f);
  const quarantine=f.state.ops.find(o=>o.op==='update'&&o.row?.status==='draft');
  assert.ok(quarantine.filters.some(([k,v])=>k==='status'&&v==='active'));
  assert.ok(quarantine.filters.some(([k,v])=>k==='owner_id'&&v==='owner-1'));
 });
}
for(const status of ['sold','rented','archived','inactive','active']){
 test(`cleanup refuses Vehicle moved to ${status} before activation, retaining media`,async()=>{
  const f=fixture();f.files.images=[photo('a.jpg'),photo('b.jpg')];f.hold();
  const task=f.create('cars');await tick();f.state.tables.vehicle_listings[0].status=status;
  f.failure(o=>o.op==='upload'&&o.n===2);f.state.release();
  await assert.rejects(task,e=>e.code==='PUBLISH_CLEANUP_PENDING');
  assert.equal(f.listings()[0].status,status);assert.equal(f.media().length,1);assert.equal(f.state.objects.size,1);
  assert.ok(!f.state.ops.some(o=>o.op==='delete'||o.op==='remove'));noSuccess(f);
 });
}
for(const change of ['row-owner','session-owner']){
 test(`Vehicle cleanup ${change} mismatch fails closed`,async()=>{
  const f=fixture();f.files.images=[photo('a.jpg')];f.hold();const task=f.create('rent');await tick();
  if(change==='row-owner')f.state.tables.vehicle_listings[0].owner_id='someone-else';else f.state.owner='someone-else';
  f.failure(o=>o.op==='upload');f.state.release();await assert.rejects(task,e=>e.code==='PUBLISH_CLEANUP_PENDING');
  assert.equal(f.listings().length,1);assert.ok(!f.state.ops.some(o=>o.op==='delete'||o.op==='remove'));noSuccess(f);
 });
}
test('created owner mismatch rejects before media or activation',async()=>{
 const f=fixture();let uploaded=false;
 await assert.rejects(coordinator(f,'vehicle_listings','draft',{create:async()=>({id:'test',owner_id:'other',status:'draft'}),upload:async()=>{uploaded=true;}}));
 assert.equal(uploaded,false);assert.equal(f.state.ops.length,0);
});
test('status changes after cleanup read still prevent parent deletion',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='upload');
 f.failure(o=>{if(o.op==='delete'&&o.table==='vehicle_listings')f.state.tables.vehicle_listings[0].status='sold';return false;});
 await assert.rejects(f.create('cars'),e=>e.code==='PUBLISH_CLEANUP_PENDING');assert.equal(f.listings()[0].status,'sold');
});
for(const status of ['sold','rented','archived'])test(`activation cannot reactivate Vehicle moved to ${status}`,async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];f.hold();const task=f.create('cars');await tick();
 f.state.tables.vehicle_listings[0].status=status;f.state.release();
 await assert.rejects(task,e=>e.code==='PUBLISH_CLEANUP_PENDING');
 assert.equal(f.listings()[0].status,status);noSuccess(f);
 assert.ok(!f.state.ops.some(o=>o.op==='delete'||o.op==='remove'));
});
test('owner changed after cleanup read cannot delete parent',async()=>{
 const f=fixture();f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='upload');
 f.failure(o=>{if(o.op==='delete'&&o.table==='vehicle_listings')f.state.tables.vehicle_listings[0].owner_id='other';return false;});
 await assert.rejects(f.create('cars'));assert.equal(f.listings().length,1);assert.equal(f.listings()[0].owner_id,'other');noSuccess(f);
});
for(const type of ['cars','rent']){
 test(`${type}: pending draft cleanup retry completes before another insert`,async()=>{
  const f=fixture();f.files.images=[photo('a.jpg')];f.failure(o=>o.op==='upload');
  f.failure(o=>o.op==='delete'&&o.table==='vehicle_listings',{once:false});
  await assert.rejects(f.create(type));await assert.rejects(f.create(type));
  assert.equal(f.state.insertions,1);assert.equal(f.listings()[0].status,'draft');noSuccess(f);
  f.state.failures=[];await f.create(type);assert.equal(f.state.insertions,2);
  assert.equal(f.listings().length,1);assert.equal(f.listings()[0].status,'active');
 });
 test(`${type}: duplicate submissions share one draft attempt and success event`,async()=>{
  const f=fixture();f.files.images=[photo('a.jpg')];f.hold();const first=f.create(type),second=f.create(type);await tick();
  assert.equal(f.state.insertions,1);assert.equal(f.listings()[0].status,'draft');noSuccess(f);
  f.state.release();await Promise.all([first,second]);await f.create(type);
  assert.equal(f.state.insertions,1);assert.equal(f.state.events.length,1);
 });
}
