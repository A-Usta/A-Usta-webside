const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const filename=path.join(__dirname,'listing-publish.test.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
let prefix=fs.readFileSync(filename,'utf8').split('const noSuccess=f=>')[0].replace('return {state,files,window,api,core','return {context,document,state,files,window,api,core').replace('window.__media={patchSave,','window.__media={patchOpen,editDealer,patchSave,');
const mutations={
 owner:["if(error || !data || data.id!==id || data.owner_id!==user.id)","if(false)"],
 cover:["for(const row of rows.filter(row=>row.is_cover))await managerWrite(handle,row,{is_cover:false});","// cover clear removed"],
 reconcile:['try{rows=await managerView(handle);}catch{}','try{rows=[];}catch{}'],
 noop:['const files = mediaSnapshot(type,publishAttempt?.files || fileSnapshot || selectedFiles());',"const files = mediaSnapshot(type,publishAttempt?.files || fileSnapshot || selectedFiles()); files.images.push({name:'duplicate.jpg',type:'image/jpeg',size:12});"]
};
if(process.env.P13B_MUTATION){
 const key=process.env.P13B_MUTATION;
 let before,after;
 if(key==='delete-order'){
  const a=html.indexOf('    await managerContext(handle);\n    const {data:removed'),b=html.indexOf('    // The persisted relation',a);before=html.slice(a,b);
  const start=before.indexOf('    await managerContext(handle);',before.indexOf('if(storageError'));
  after=before.slice(start)+before.slice(0,start);
 }else [before,after]=mutations[key];
 assert.ok(html.includes(before));
 prefix=prefix.replace("const media=block(ids.media),end=media.lastIndexOf('})();');",`const media=block(ids.media).replace(${JSON.stringify(before)},${JSON.stringify(after)}),end=media.lastIndexOf('})();');`);
}
m._compile(prefix+'\nmodule.exports=fixture;',filename);
const maps={cars:['vehicle_listings','listing_media','listing-media'],rent:['vehicle_listings','listing_media','listing-media'],parts:['marketplace_listings','marketplace_listing_media','marketplace-media'],service:['service_provider_listings','service_provider_media','provider-media'],usta:['service_provider_listings','service_provider_media','provider-media'],dealer:['auto_dealer_listings','auto_dealer_media','auto-dealer-media']};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const image=(name='new.jpg')=>({name,type:'image/jpeg',size:32}),video=()=>({name:'clip.mp4',type:'video/mp4',size:64});
function fixture(type='cars'){
 const f=m.exports();f.type=type;[f.parent,f.table,f.bucket]=maps[type];f.id='existing';f.manager=f.window.AUSTA_LISTING_MEDIA;
 f.state.tables[f.parent].push({id:f.id,owner_id:f.state.owner,status:'active',has_video:true});
 const from=f.window.AUSTA_SUPABASE.from;
 f.window.AUSTA_SUPABASE.from=table=>{
  const q=from(table),exec=q.exec.bind(q),orders=[];
  q.order=(key,options)=>{orders.push([key,options.ascending]);return q;};
  q.exec=()=>{
   if(table==='listing_media' && q.op==='update' && q.row.is_cover===true){const target=f.state.tables[table].find(r=>q.filters.every(([c,v])=>r[c]===v));if(target&&f.state.tables[table].some(r=>r.listing_id===target.listing_id&&r.is_cover&&r.id!==target.id))return {data:null,error:new Error('unique cover')};}
   const result=exec();if(Array.isArray(result.data)&&orders.length)result.data.sort((a,b)=>{for(const [key,asc] of orders){if(a[key]<b[key])return asc?-1:1;if(a[key]>b[key])return asc?1:-1;}return 0;});return result;
  };return q;
 };
 const storage=f.window.AUSTA_SUPABASE.storage.from;
 f.window.AUSTA_SUPABASE.storage.from=b=>({...storage(b),createSignedUrl:async p=>({data:f.state.objects.has(b+':'+p)?{signedUrl:'https://safe.invalid/'+p}:null,error:null})});
 f.add=(extra={})=>{const i=f.state.tables[f.table].length;const row={id:'old-'+i,listing_id:f.id,owner_id:f.state.owner,media_type:'image',sort_order:i,is_cover:i===0,storage_path:f.state.owner+'/'+f.id+'/file-'+i,created_at:'2026-01-01',...extra};f.state.tables[f.table].push(row);f.state.objects.add(f.bucket+':'+row.storage_path);return row;};
 f.edit=patch=>{if(type==='dealer'){f.window.__media.setDealerEdit({id:f.id});return f.api.saveListing('dealer',{},undefined);}return f.api.updateListing(type,f.id,patch);};
 f.open=()=>f.manager.open(type,f.id);f.mediaOps=()=>f.state.ops.filter(o=>o.table===f.table&&['insert','update','delete'].includes(o.op));
 return f;
}
for(const type of Object.keys(maps)){
 test(`${type}: hydrates image/video with signed previews, no upload`,async()=>{const f=fixture(type);f.add();f.add({media_type:'video',is_cover:false});const result=await f.open();assert.deepEqual(Array.from(result.rows,r=>r.media_type),['image','video']);assert.ok(result.rows.every(r=>r.previewUrl.startsWith('https://safe.invalid/')));assert.equal(f.state.uploads,0);assert.equal(f.mediaOps().length,0);});
 test(`${type}: individual delete Storage before metadata, only selected row`,async()=>{const f=fixture(type);const a=f.add(),b=f.add({is_cover:false});const {handle}=await f.open();const rows=await f.manager.remove(handle,b.id);const storage=f.state.ops.findIndex(o=>o.op==='remove'),db=f.state.ops.findIndex(o=>o.table===f.table&&o.op==='delete');assert.ok(storage>=0&&db>storage);assert.deepEqual(Array.from(rows,r=>r.id),[a.id]);assert.equal(f.state.tables[f.parent].length,1);});
 test(`${type}: image cover switch clears before setting, at most one`,async()=>{const f=fixture(type);f.add();const b=f.add({is_cover:false});const vehicle=['cars','rent'].includes(type);if(!vehicle)f.add({is_cover:true});const {handle}=await f.open();const rows=await f.manager.cover(handle,b.id);assert.deepEqual(Array.from(rows.filter(r=>r.is_cover),r=>r.id),[b.id]);assert.equal(rows.find(r=>r.is_cover).media_type,'image');const updates=f.mediaOps().filter(o=>o.op==='update');assert.equal(updates.filter(o=>o.row.is_cover===false).length,vehicle?1:2);assert.equal(updates[0].row.is_cover,false);assert.equal(updates.at(-1).row.is_cover,true);});
 test(`${type}: explicit reorder contiguous; cover identity unchanged`,async()=>{const f=fixture(type);const a=f.add({sort_order:5}),b=f.add({sort_order:9,is_cover:false}),c=f.add({sort_order:9,is_cover:false});const {handle}=await f.open();const rows=await f.manager.reorder(handle,[c.id,a.id,b.id]);assert.deepEqual(Array.from(rows,r=>r.id),[c.id,a.id,b.id]);assert.deepEqual(Array.from(rows,r=>r.sort_order),[0,1,2]);assert.equal(rows.find(r=>r.is_cover).id,a.id);assert.equal(f.state.uploads,0);});
 test(`${type}: no-op form edit preserves all persisted media`,async()=>{const f=fixture(type);f.add();f.add({media_type:'video',is_cover:false});await f.open();const before=JSON.stringify(f.state.tables[f.table]);await f.edit({phone:'123'});assert.equal(f.state.uploads,0);assert.ok(!f.state.ops.some(o=>o.op==='remove'));assert.equal(f.mediaOps().length,0);assert.equal(JSON.stringify(f.state.tables[f.table]),before);});
}
test('deterministic hydration uses sort, created_at, id ties',async()=>{const f=fixture();f.add({id:'z',sort_order:1,created_at:'2026-02-01'});f.add({id:'b',sort_order:1});f.add({id:'a',sort_order:1});const {rows}=await f.open();assert.deepEqual(Array.from(rows,r=>r.id),['a','b','z']);});
for(const type of ['service','usta','cars','parts','dealer'])test(`${type}: edit append uses persisted max and never reuploads old media`,async()=>{const f=fixture(type);f.add({sort_order:8});f.files.images=[image()];await f.edit({phone:'123'});assert.equal(f.state.uploads,1);assert.deepEqual(f.state.tables[f.table].map(r=>r.sort_order),[8,9]);assert.equal(f.state.tables[f.table].filter(r=>r.is_cover).length,1);});
test('Plate video and invalid files stay rejected',async()=>{const f=fixture('parts');const {handle}=await f.manager.open('plate',f.id);await assert.rejects(async()=>f.manager.append(handle,{images:[],videos:[video()]}));await assert.rejects(async()=>f.manager.append(handle,{images:[{...image(),size:0}],videos:[]}));assert.equal(f.state.uploads,0);});
for(const type of ['cars','parts'])for(const count of [1,2])test(`${type}: deleting video among ${count} reconciles has_video`,async()=>{const f=fixture(type);let a;for(let i=0;i<count;i++)a=f.add({media_type:'video',is_cover:false});const {handle}=await f.open();await f.manager.remove(handle,a.id);assert.equal(f.state.tables[f.parent][0].has_video,count>1);});
for(const type of ['cars','parts'])test(`${type}: video SELECT error after deletion preserves flag`,async()=>{const f=fixture(type);const a=f.add({media_type:'video',is_cover:false});const {handle}=await f.open();f.failure(o=>o.op==='read'&&o.table===f.table&&o.filters.some(([key])=>key==='media_type'));await assert.rejects(f.manager.remove(handle,a.id));assert.equal(f.state.tables[f.parent][0].has_video,true);});
for(const mode of ['failure','empty','null'])test(`Storage ${mode} retains metadata`,async()=>{const f=fixture();const a=f.add();const {handle}=await f.open();if(mode==='failure')f.failure(o=>o.op==='remove');else f.window.AUSTA_SUPABASE.storage.from=b=>({createSignedUrl:async()=>({data:null,error:null}),remove:async()=>({data:mode==='empty'?[]:null,error:null})});await assert.rejects(f.manager.remove(handle,a.id));assert.equal(f.state.tables[f.table].length,1);assert.ok(!f.mediaOps().some(o=>o.op==='delete'));});
test('Storage success + metadata failure returns reconciled broken-preview state',async()=>{const f=fixture();const a=f.add();const {handle}=await f.open();f.failure(o=>o.op==='delete'&&o.table===f.table);await assert.rejects(f.manager.remove(handle,a.id),e=>{assert.equal(e.code,'MEDIA_OPERATION_FAILED');assert.equal(e.mediaState[0].previewError,true);return true;});assert.equal(f.state.objects.size,0);assert.equal(f.state.tables[f.table].length,1);});
test('foreign parent fails before Storage operation',async()=>{const f=fixture();const a=f.add();const {handle}=await f.open();f.state.tables[f.parent][0].owner_id='foreign';await assert.rejects(f.manager.remove(handle,a.id));assert.ok(!f.state.ops.some(o=>o.op==='remove'));});
test('foreign media id, forged handle and DOM-supplied path cannot authorize delete',async()=>{const f=fixture();f.add();const {handle}=await f.open();await assert.rejects(f.manager.remove(handle,'foreign'));await assert.rejects(f.manager.remove({},'old-0'));await assert.rejects(f.manager.remove(handle,{id:'old-0',storage_path:'foreign/path'}));assert.ok(!f.state.ops.some(o=>o.op==='remove'));});
test('foreign media ownership mismatch fails closed',async()=>{const f=fixture();const a=f.add();const {handle}=await f.open();f.state.tables[f.table][0].owner_id='foreign';await assert.rejects(f.manager.remove(handle,a.id));assert.ok(!f.state.ops.some(o=>o.op==='remove'));});
test('auth loss, user change and closed mount handles cannot mutate',async()=>{for(const mode of ['logout','switch','closed']){const f=fixture();const a=f.add();const {handle}=await f.open();if(mode==='closed')f.manager.close(handle);else f.state.owner=mode==='logout'?null:'other';await assert.rejects(f.manager.remove(handle,a.id));assert.ok(!f.state.ops.some(o=>o.op==='remove'));}});
test('video cannot become cover',async()=>{const f=fixture();const a=f.add({media_type:'video',is_cover:false});const {handle}=await f.open();await assert.rejects(f.manager.cover(handle,a.id));assert.equal(f.mediaOps().length,0);});
test('newly persisted image can become cover; signed URLs never become paths',async()=>{const f=fixture();f.add();const {handle}=await f.open();const rows=await f.manager.append(handle,{images:[image()],videos:[]});const added=rows.find(r=>r.id.startsWith('row-'));assert.ok(added);const next=await f.manager.cover(handle,added.id);assert.equal(next.find(r=>r.is_cover).id,added.id);assert.ok(f.state.tables[f.table].every(r=>!r.storage_path.startsWith('http')));});
test('deleting cover picks first remaining ordered image, never video',async()=>{const f=fixture();const a=f.add(),v=f.add({media_type:'video',sort_order:1,is_cover:false}),b=f.add({sort_order:2,is_cover:false});const {handle}=await f.open();const rows=await f.manager.remove(handle,a.id);assert.equal(rows.find(r=>r.is_cover).id,b.id);assert.equal(rows.find(r=>r.id===v.id).is_cover,false);});
test('deleting last image leaves no cover',async()=>{const f=fixture();const a=f.add();f.add({media_type:'video',is_cover:false});const {handle}=await f.open();const rows=await f.manager.remove(handle,a.id);assert.ok(rows.every(r=>!r.is_cover));});
for(const type of Object.keys(maps)){
 test(`${type}: cover setting failure reconciles persisted no-cover state in UI`,async()=>{
  const f=uiFixture(type);const old=f.add(),target=f.add({is_cover:false});await f.ui.mount(f.root,type,f.id);const state=f.uiState(),start=f.state.ops.length;
  f.failure(o=>o.op==='update'&&o.table===f.table&&o.row.is_cover===true);let rejected=false;
  await f.window.__mediaUI.operate(state,async()=>{
   try{return await f.manager.cover(state.handle,target.id);}catch(error){
    rejected=true;assert.equal(error.code,'MEDIA_OPERATION_FAILED');assert.equal(error.mediaState.length,2);assert.ok(error.mediaState.every(row=>!row.is_cover));throw error;
   }
  });
  const operations=f.state.ops.slice(start),failed=operations.findIndex(o=>o.op==='update'&&o.table===f.table&&o.row.is_cover===true);
  assert.ok(failed>0);assert.ok(operations.slice(failed+1).some(o=>o.op==='read'&&o.table===f.table),'authoritative media re-read after failed set');
  assert.equal(f.state.tables[f.table].find(row=>row.id===old.id).is_cover,false,'old clear committed');assert.equal(f.state.tables[f.table].find(row=>row.id===target.id).is_cover,false,'new cover not fabricated');
  assert.equal(rejected,true);assert.ok(state.rows.every(row=>!row.is_cover));assert.ok(f.root.textContent.includes('Media əməliyyatı tamamlanmadı'));
  assert.ok(!f.root.textContent.includes('Media dəyişiklikləri saxlanıldı.'));assert.ok(!f.root.querySelectorAll('strong').some(node=>node.textContent==='Əsas şəkil'));
 });
 test(`${type}: replacement-cover failure after delete is reported and reconciled in UI`,async()=>{
  const f=uiFixture(type);const old=f.add(),target=f.add({is_cover:false}),clip=f.add({media_type:'video',is_cover:false});await f.ui.mount(f.root,type,f.id);const state=f.uiState(),start=f.state.ops.length;
  f.failure(o=>o.op==='update'&&o.table===f.table&&o.row.is_cover===true);let rejected=false;
  await f.window.__mediaUI.operate(state,async()=>{
   try{return await f.manager.remove(state.handle,old.id);}catch(error){
    rejected=true;assert.equal(error.code,'MEDIA_OPERATION_FAILED');assert.equal(error.mediaState.length,2);assert.ok(error.mediaState.every(row=>!row.is_cover));throw error;
   }
  });
  const operations=f.state.ops.slice(start),deleted=operations.findIndex(o=>o.op==='delete'&&o.table===f.table),failed=operations.findIndex(o=>o.op==='update'&&o.table===f.table&&o.row.is_cover===true);
  assert.ok(deleted>=0&&failed>deleted);assert.ok(operations.slice(failed+1).some(o=>o.op==='read'&&o.table===f.table),'authoritative re-read after failed replacement');
  assert.ok(!f.state.objects.has(f.bucket+':'+old.storage_path));assert.ok(!f.state.tables[f.table].some(row=>row.id===old.id));assert.equal(f.state.uploads,0,'deleted Storage media is not recreated');
  assert.equal(rejected,true);assert.deepEqual(Array.from(state.rows,row=>row.id),[target.id,clip.id]);assert.ok(state.rows.every(row=>!row.is_cover));
  assert.ok(f.root.textContent.includes('Media əməliyyatı tamamlanmadı'));assert.ok(!f.root.textContent.includes('Media dəyişiklikləri saxlanıldı.'));assert.ok(!f.root.querySelectorAll('strong').some(node=>node.textContent==='Əsas şəkil'));
 });
}
test('partial reorder failure re-reads actual persisted order',async()=>{const f=fixture();const a=f.add({sort_order:5}),b=f.add({sort_order:6,is_cover:false}),c=f.add({sort_order:7,is_cover:false});const {handle}=await f.open();f.failure(o=>o.op==='update'&&o.table===f.table&&o.row.sort_order===1);await assert.rejects(f.manager.reorder(handle,[c.id,b.id,a.id]),e=>{assert.deepEqual(Array.from(e.mediaState,r=>r.id),[c.id,a.id,b.id]);assert.deepEqual(Array.from(e.mediaState,r=>r.sort_order),[0,5,6]);return true;});});
test('reorder rejects missing/duplicate/foreign IDs',async()=>{const f=fixture();const a=f.add(),b=f.add({is_cover:false});const {handle}=await f.open();for(const ids of [[a.id],[a.id,a.id],[a.id,'foreign']])await assert.rejects(f.manager.reorder(handle,ids));assert.equal(f.mediaOps().length,0);});
test('double delete, delete/reorder, cover/delete and full-delete conflicts blocked',async()=>{
 const f=fixture();const a=f.add(),b=f.add({is_cover:false});const {handle}=await f.open();let release;const client=f.window.AUSTA_SUPABASE,storage=client.storage.from;client.storage.from=bucket=>{const api=storage(bucket);return {...api,remove:async paths=>{await new Promise(resolve=>release=resolve);return api.remove(paths);}};};
 const removing=f.manager.remove(handle,b.id);await tick();for(const action of [()=>f.manager.remove(handle,b.id),()=>f.manager.reorder(handle,[b.id,a.id]),()=>f.manager.cover(handle,a.id),()=>f.manager.deleteOwnedListing(f.parent,f.id),()=>f.api.updateListing('cars',f.id,{})])await assert.rejects(action());release();await removing;assert.equal(f.mediaOps().filter(o=>o.op==='delete').length,1);
});
test('auth/mount change after Storage response blocks metadata mutation',async()=>{for(const mode of ['auth','close']){const f=fixture();const a=f.add();const {handle}=await f.open();const client=f.window.AUSTA_SUPABASE,storage=client.storage.from;client.storage.from=b=>{const api=storage(b);return {...api,remove:async paths=>{const result=await api.remove(paths);if(mode==='auth')f.state.owner='other';else f.manager.close(handle);return result;}};};await assert.rejects(f.manager.remove(handle,a.id));assert.ok(!f.mediaOps().some(o=>o.op==='delete'));}});
// The primary detail consumer must honor selected cover while preserving first-video identity.
test('real detail hydration honors is_cover without changing video selection',async()=>{
 const f=fixture();const a=f.add({is_cover:false}),b=f.add({is_cover:true});f.add({media_type:'video',is_cover:false});
 const start=html.indexOf('async function hydrateSupabaseListingMedia(item)'),end=html.indexOf('\nfunction imagePaths(item)',start);
 vm.runInContext(html.slice(start,end),f.context);f.context.item={id:f.id,_austaSupabase:true,__austa_table:f.parent};
 await vm.runInContext('hydrateSupabaseListingMedia(item)',f.context);assert.ok(f.context.item.image_paths[0].endsWith(b.storage_path));assert.ok(f.context.item.image_paths[1].endsWith(a.storage_path));assert.ok(f.context.item.video_path.endsWith('file-2'));
});
function uiFixture(type='cars'){
 const f=fixture(type),observers=[],listeners=[];let serial=0;
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.listeners={};this.attrs={};this._text='';this.disabled=false;this.files=[];}
  appendChild(child){child.parentNode=this;this.children.push(child);return child;}
  replaceChildren(){for(const c of this.children)c.parentNode=null;this.children=[];this._text='';}
  set textContent(text){this.replaceChildren();this._text=String(text);}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  setAttribute(name,value){this.attrs[name]=value;}
  addEventListener(name,callback){(this.listeners[name]??=[]).push(callback);}
  fire(name){return Promise.all((this.listeners[name]||[]).map(fn=>fn({target:this})));}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  get isConnected(){return this===doc.body||this===doc.head||Boolean(this.parentNode?.isConnected);}
  querySelectorAll(selector){return this.children.flatMap(child=>[(child.tagName.toLowerCase()===selector?child:null),...child.querySelectorAll(selector)]).filter(Boolean);}
 }
 const doc={body:new Node('body'),head:new Node('head'),createElement:tag=>new Node(tag),getElementById(id){const find=node=>node.id===id?node:node.children.map(find).find(Boolean);return find(this.body)||find(this.head)||null;}};
 const rootNode=()=>{const node=new Node('div');node.id='austaV153CFields';doc.body.appendChild(node);return node;};
 f.context.document=doc;f.context.URL={createObjectURL:()=>`blob:local-${++serial}`,revokeObjectURL:url=>{(f.state.revoked??=[]).push(url);}};
 f.context.MutationObserver=class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.closed=true;}};
 f.window.confirm=()=>true;f.window.AUSTA_SUPABASE.auth.onAuthStateChange=fn=>{listeners.push(fn);return {data:{subscription:{unsubscribe(){}}}};};
 let source=fs.readFileSync(path.join(root,'assets/marketplace/media-manager.js'),'utf8');
 const end=source.lastIndexOf('})();');source=source.slice(0,end)+'window.__mediaUI={get active(){return active;},operate,render,current};'+source.slice(end);
 vm.runInContext(source,f.context);f.ui=f.window.AUSTA_MEDIA_MANAGER;f.uiState=()=>f.window.__mediaUI.active;f.doc=doc;f.root=rootNode();f.newRoot=()=>{f.doc.body.replaceChildren();f.root=rootNode();return f.root;};
 f.authEvent=event=>listeners.forEach(fn=>fn(event));f.domChanged=()=>observers.forEach(o=>{if(!o.closed)o.fn();});return f;
}
test('actual UI renders image/video, cover label and safe file names',async()=>{
 const f=uiFixture();f.add();f.add({media_type:'video',is_cover:false});await f.ui.mount(f.root,'cars',f.id);
 assert.ok(f.root.textContent.includes('Şəkillər və videolar'));assert.ok(f.root.textContent.includes('Əsas şəkil'));assert.equal(f.root.querySelectorAll('img').length,1);assert.equal(f.root.querySelectorAll('video').length,1);
 const input=f.doc.getElementById('austaV153DImages');input.files=[image('<img onerror=bad>')];await input.fire('change');assert.ok(f.root.textContent.includes('<img onerror=bad>'));assert.equal(f.root.querySelectorAll('img').length,2);assert.equal(f.state.uploads,0);
});
test('pending local removal revokes preview URL and does not touch persisted media',async()=>{
 const f=uiFixture();f.add();await f.ui.mount(f.root,'cars',f.id);const input=f.doc.getElementById('austaV153DImages');input.files=[image()];await input.fire('change');
 assert.equal(f.ui.files(f.root).images.length,1);const removes=f.root.querySelectorAll('button').filter(n=>n.textContent==='Sil');await removes.at(-1).fire('click');assert.equal(f.ui.files(f.root).images.length,0);assert.equal(f.state.revoked.length,1);assert.equal(f.mediaOps().length,0);
});
test('actual UI no-op form save performs no media mutation or upload',async()=>{
 const f=uiFixture();f.add();await f.ui.mount(f.root,'cars',f.id);await f.edit({phone:'123'});assert.equal(f.state.uploads,0);assert.equal(f.mediaOps().length,0);assert.ok(!f.state.ops.some(o=>o.op==='remove'));
});
test('UI upload persists only new files and enables cover selection after persistence',async()=>{
 const f=uiFixture();f.add();await f.ui.mount(f.root,'cars',f.id);const input=f.doc.getElementById('austaV153DImages');input.files=[image()];await input.fire('change');
 const upload=f.root.querySelectorAll('button').find(n=>n.textContent==='Yeni medianı yüklə');await upload.fire('click');await tick();assert.equal(f.state.uploads,1);assert.equal(f.ui.files(f.root).images.length,0);assert.equal(f.root.querySelectorAll('img').length,2);
 const covers=f.root.querySelectorAll('button').filter(n=>n.textContent==='Əsas şəkil et');assert.equal(covers.length,2);assert.equal(covers.at(-1).disabled,false);
});
test('old mount delayed hydration cannot overwrite replacement manager',async()=>{
 const f=uiFixture();f.add();let release;const gate=new Promise(resolve=>release=resolve),original=f.manager.open;
 f.window.AUSTA_LISTING_MEDIA={...f.manager,open:async(type,id)=>{const result=await original(type,id);if(id===f.id)await gate;return result;}};
 const oldRoot=f.root,oldMount=f.ui.mount(oldRoot,'cars',f.id);await tick();
 const newId='new-listing';f.state.tables[f.parent].push({id:newId,owner_id:f.state.owner,status:'active'});const root=f.newRoot();await f.ui.mount(root,'cars',newId);const current=f.uiState(),before=root.textContent;
 release();await oldMount;assert.equal(f.uiState(),current);assert.equal(root.textContent,before);assert.deepEqual(Array.from(current.rows),[]);
});
test('logout invalidates pending hydration and cannot restore old media UI',async()=>{
 const f=uiFixture();f.add();let release;const gate=new Promise(resolve=>release=resolve),original=f.manager.open;f.window.AUSTA_LISTING_MEDIA={...f.manager,open:async(...args)=>{const result=await original(...args);await gate;return result;}};
 const mounting=f.ui.mount(f.root,'cars',f.id);await tick();f.state.owner=null;f.authEvent('SIGNED_OUT');const before=f.root.textContent;release();await mounting;assert.equal(f.uiState(),null);assert.equal(f.root.textContent,before);assert.ok(before.includes('Hesab sessiyası dəyişdi'));
});
test('A delayed hydration cannot replace B manager after auth switch',async()=>{
 const f=uiFixture();f.add();let release;const gate=new Promise(resolve=>release=resolve),original=f.manager.open;f.window.AUSTA_LISTING_MEDIA={...f.manager,open:async(type,id)=>{const result=await original(type,id);if(id===f.id)await gate;return result;}};
 const old=f.ui.mount(f.root,'cars',f.id);await tick();f.state.owner='owner-B';f.authEvent('SIGNED_IN');const id='B-listing';f.state.tables[f.parent].push({id,owner_id:f.state.owner,status:'active'});const node=f.newRoot();await f.ui.mount(node,'cars',id);const state=f.uiState();release();await old;assert.equal(f.uiState(),state);assert.equal(state.id,id);assert.equal(state.rows.length,0);
});
test('stale operation completion cannot render into newly mounted state',async()=>{
 const f=uiFixture();const a=f.add(),b=f.add({is_cover:false});await f.ui.mount(f.root,'cars',f.id);const oldState=f.uiState();let release;const gate=new Promise(resolve=>release=resolve);
 const pending=f.window.__mediaUI.operate(oldState,async()=>{const rows=await f.manager.cover(oldState.handle,b.id);await gate;return rows;});await tick();
 const root=f.newRoot();await f.ui.mount(root,'cars',f.id);const current=f.uiState(),before=root.textContent;release();await pending;assert.equal(f.uiState(),current);assert.equal(root.textContent,before);assert.equal(current.rows.find(r=>r.is_cover).id,b.id);assert.notEqual(a.id,b.id);
});
test('UI reorder failure shows persisted state and error, not desired optimistic order',async()=>{
 const f=uiFixture();const a=f.add({sort_order:5}),b=f.add({sort_order:6,is_cover:false}),c=f.add({sort_order:7,is_cover:false});await f.ui.mount(f.root,'cars',f.id);const state=f.uiState();f.failure(o=>o.op==='update'&&o.table===f.table&&o.row.sort_order===1);
 await f.window.__mediaUI.operate(state,()=>f.manager.reorder(state.handle,[c.id,b.id,a.id]));assert.deepEqual(Array.from(state.rows,r=>r.id),[c.id,a.id,b.id]);assert.ok(f.root.textContent.includes('Media əməliyyatı tamamlanmadı'));
});
test('preview refresh is presentation-only and Plate UI offers no video input',async()=>{
 const f=uiFixture('parts');f.add();await f.ui.mount(f.root,'plate',f.id);assert.equal(f.doc.getElementById('austaV153DVideo'),null);const refresh=f.root.querySelectorAll('button').find(n=>n.textContent==='Önizləmələri yenilə');await refresh.fire('click');await tick();assert.equal(f.mediaOps().length,0);assert.equal(f.state.uploads,0);
});
test('DOM removal disposes handle and local URL resources',async()=>{
 const f=uiFixture();f.add();await f.ui.mount(f.root,'cars',f.id);const old=f.uiState().handle;const input=f.doc.getElementById('austaV153DImages');input.files=[image()];await input.fire('change');f.doc.body.replaceChildren();f.domChanged();assert.equal(f.uiState(),null);assert.equal(f.state.revoked.length,1);await assert.rejects(f.manager.refresh(old));
});
test('late upload bookkeeping cannot remove a replacement mount pending File',async()=>{
 const f=uiFixture();f.add();await f.ui.mount(f.root,'cars',f.id);const oldToken=f.uiState().token,file=image();
 const node=f.newRoot();await f.ui.mount(node,'cars',f.id);const input=f.doc.getElementById('austaV153DImages');input.files=[file];await input.fire('change');
 f.ui.persisted(file,f.id,oldToken);assert.equal(f.ui.files(node).images.length,1);
});
test('mount closes during append Storage request: no metadata insert into obsolete context',async()=>{
 const f=fixture();f.add();const {handle}=await f.open();f.hold();const appending=f.manager.append(handle,{images:[image()],videos:[]});await tick();f.manager.close(handle);f.state.release();await assert.rejects(appending);
 assert.ok(!f.mediaOps().some(o=>o.op==='insert'));assert.equal(f.state.tables[f.table].length,1);assert.equal(f.state.objects.size,1);
});
test('deleting last image clears any legacy video cover flag',async()=>{const f=fixture('parts');const a=f.add();f.add({media_type:'video',is_cover:true});const {handle}=await f.open();const rows=await f.manager.remove(handle,a.id);assert.ok(rows.every(r=>!r.is_cover));});
test('old Dealer timer cannot mount into newer same-DOM form epoch',async()=>{
 const f=uiFixture();f.add();f.window.__media.patchOpen();await f.window.__media.editDealer({id:f.id});const oldTimer=f.state.timers.find(t=>t.ms===50);assert.ok(oldTimer);
 f.window.AUSTA_V153C.open('cars');await f.ui.mount(f.root,'cars',f.id);const state=f.uiState(),before=f.root.textContent;
 oldTimer.fn();assert.equal(f.uiState(),state);assert.equal(f.root.textContent,before);assert.equal(state.type,'cars');
});
test('old async edit wrapper cannot mount after newer same-DOM edit',async()=>{
 const f=uiFixture();f.add();const id='second-listing';f.state.tables[f.parent].push({id,owner_id:f.state.owner,status:'active'});let resolveOld,calls=0;
 f.window.AUSTA_V153C.edit=()=>++calls===1?new Promise(resolve=>resolveOld=resolve):Promise.resolve();f.window.__media.patchOpen();
 const old=f.window.AUSTA_V153C.edit({id:f.id,__austa_table:f.parent,listing_type:'sale'});await f.window.AUSTA_V153C.edit({id,__austa_table:f.parent,listing_type:'sale'});await tick();const state=f.uiState();assert.equal(state.id,id);
 resolveOld();await old;assert.equal(f.uiState(),state);assert.equal(f.uiState().id,id);
});
test('active cover switch blocks delete and repeated cover decisions',async()=>{
 const f=fixture();const a=f.add(),b=f.add({is_cover:false});const {handle}=await f.open();let release;const gate=new Promise(resolve=>release=resolve),from=f.window.AUSTA_SUPABASE.from;
 f.window.AUSTA_SUPABASE.from=t=>{const q=from(t),exec=q.exec.bind(q);q.exec=async()=>{if(t===f.table&&q.op==='update'&&q.row.is_cover===false)await gate;return exec();};return q;};
 const changing=f.manager.cover(handle,b.id);await tick();await assert.rejects(f.manager.remove(handle,a.id));await assert.rejects(f.manager.cover(handle,a.id));release();await changing;
});
test('active full-listing cleanup blocks media mutation and form save',async()=>{
 const f=fixture();const a=f.add();const {handle}=await f.open();let release;const gate=new Promise(resolve=>release=resolve),storage=f.window.AUSTA_SUPABASE.storage.from;
 f.window.AUSTA_SUPABASE.storage.from=b=>{const api=storage(b);return {...api,remove:async paths=>{await gate;return api.remove(paths);}};};
 const deleting=f.manager.deleteOwnedListing(f.parent,f.id);await tick();await assert.rejects(f.manager.cover(handle,a.id));await assert.rejects(f.edit({phone:'123'}));release();await deleting;
});
test('opening a new create invalidates an obsolete Dealer edit target',async()=>{
 const f=fixture('dealer');f.window.__media.setDealerEdit({id:f.id});f.window.__media.patchOpen();f.window.AUSTA_V153C.open('dealer');await f.api.saveListing('dealer',{});
 assert.equal(f.state.tables[f.parent].length,2);assert.equal(f.state.insertions,1);assert.equal(f.state.tables[f.parent].find(row=>row.id===f.id).status,'active');
});
