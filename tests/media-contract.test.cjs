const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const filename=path.join(__dirname,'listing-publish.test.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
let prefix=fs.readFileSync(filename,'utf8').split('const noSuccess=f=>')[0]
 .replace('return {state,files,window,api,core','return {context,document,state,files,window,api,core')
 .replace('window.__media={patchSave,uploadMedia,','window.__media={mediaSnapshot,persistedMedia,mediaConfig,syncVehicleHasVideo,patchSave,uploadMedia,');
// Optional source mutations are in-memory only. Dedicated tests must reject each regression.
const mutations={
 validation:["if(file.size>MAX_MEDIA_BYTES)","if(false)"],
 order:['let order=Math.max(0,maxOrder+1);','let order=0;'],
 cover:["const allowCover=!existing.some(row=>row.is_cover || row.media_type==='image');",'const allowCover=true;'],
 cleanup:["await client.storage.from(config.bucket).remove(batch)","Promise.resolve({data:batch.map(name=>({name})),error:null})"],
 owner:["if(error || !data || data.id!==id || data.owner_id!==user.id)","if(false)"]
};
if(process.env.P13A_MUTATION){const [before,after]=mutations[process.env.P13A_MUTATION];assert.ok(html.includes(before));prefix=prefix.replace('const core=window.AUSTA_V153.saveListing;',`const core=window.AUSTA_V153.saveListing;`).replace("const media=block(ids.media),end=media.lastIndexOf('})();');",`const media=block(ids.media).replace(${JSON.stringify(before)},${JSON.stringify(after)}),end=media.lastIndexOf('})();');`);}
m._compile(prefix+'\nmodule.exports=fixture;',filename);
const maps={cars:['vehicle_listings','listing_media','listing-media'],rent:['vehicle_listings','listing_media','listing-media'],parts:['marketplace_listings','marketplace_listing_media','marketplace-media'],service:['service_provider_listings','service_provider_media','provider-media'],usta:['service_provider_listings','service_provider_media','provider-media'],dealer:['auto_dealer_listings','auto_dealer_media','auto-dealer-media']};
const image=(name='photo.jpg',extra={})=>({name,type:'image/jpeg',size:128,...extra});
const video=(name='clip.mp4',extra={})=>({name,type:'video/mp4',size:256,...extra});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(type='cars'){
 const f=m.exports();f.type=type;[f.parent,f.table,f.bucket]=maps[type];f.id='existing';
 f.state.tables[f.parent].push({id:f.id,owner_id:f.state.owner,status:'active',has_video:true});
 f.add=(extra={})=>{
  const row={id:'old-'+f.state.tables[f.table].length,listing_id:f.id,owner_id:f.state.owner,storage_path:`${f.state.owner}/${f.id}/old-${f.state.tables[f.table].length}.jpg`,media_type:'image',sort_order:0,is_cover:false,created_at:'2026-01-01',...extra};
  f.state.tables[f.table].push(row);f.state.objects.add(f.bucket+':'+row.storage_path);return row;
 };
 f.upload=()=>f.window.__media.uploadMedia(type,f.id);
 f.remove=()=>f.window.AUSTA_LISTING_MEDIA.deleteOwnedListing(f.parent,f.id);
 f.parentDeletes=()=>f.state.ops.filter(o=>o.table===f.parent&&o.op==='delete');
 return f;
}
for(const [name,file,kind] of [
 ['zero-byte',image('empty',{size:0}),'image'],['unknown size',image('unknown',{size:undefined}),'image'],
 ['unsupported MIME',image('bad',{type:'application/pdf'}),'image'],['wrong input family',video(),'image'],
 ['oversize',image('huge',{size:50*1024*1024+1}),'image'],['negative size',image('bad',{size:-1}),'image'],
 ['non-finite size',image('bad',{size:Infinity}),'image']
])test(`validation rejects ${name} before staging/upload`,async()=>{
 const f=m.exports();f.files[kind==='image'?'images':'videos']=[file];await assert.rejects(f.create('cars'));
 assert.equal(f.state.insertions,0);assert.equal(f.state.uploads,0);
});
for(const [type,file,kind] of [['cars',image(),'images'],['rent',video(),'videos'],['parts',video(),'videos'],['service',video(),'videos'],['usta',image(),'images'],['dealer',video(),'videos'],['cars',image('boundary',{size:50*1024*1024}),'images']])test(`${type}: valid ${file.type}/${file.size} accepted`,async()=>{
 const f=fixture(type);f.files[kind]=[file];await f.upload();assert.equal(f.state.uploads,1);
});
test('Plate video rejected before INSERT or upload',async()=>{const f=m.exports();f.files.videos=[video()];await assert.rejects(f.create('plate'));assert.equal(f.state.insertions,0);assert.equal(f.state.uploads,0);});
for(const type of Object.keys(maps)){
 test(`${type}: append 0,1,2 -> 3,4; existing cover unchanged`,async()=>{
  const f=fixture(type);const old=[f.add({sort_order:0,is_cover:true}),f.add({sort_order:1}),f.add({sort_order:2})];const before=JSON.stringify(old);
  f.files.images=[image('a'),image('b')];await f.upload();
  const rows=f.state.tables[f.table];assert.deepEqual(rows.slice(3).map(r=>r.sort_order),[3,4]);assert.ok(rows.slice(3).every(r=>!r.is_cover));assert.equal(JSON.stringify(rows.slice(0,3)),before);
  assert.equal(rows.filter(r=>r.is_cover).length,1,'Vehicle partial unique index must not be challenged');
 });
 test(`${type}: Storage-first owner full delete uses correct mapping`,async()=>{
  const f=fixture(type);f.add();await f.remove();
  const read=f.state.ops.findIndex(o=>o.table===f.table&&o.op==='read'),storage=f.state.ops.findIndex(o=>o.op==='remove'),parent=f.state.ops.findIndex(o=>o.table===f.parent&&o.op==='delete');
  assert.ok(read>=0&&storage>read&&parent>storage);assert.equal(f.state.ops[storage].table,f.bucket);assert.equal(f.state.objects.size,0);assert.equal(f.parentDeletes().length,1);
 });
 test(`${type}: Storage failure keeps parent`,async()=>{const f=fixture(type);f.add();f.failure(o=>o.op==='remove');await assert.rejects(f.remove(),/Silmə tamamlanmadı/);assert.equal(f.parentDeletes().length,0);assert.equal(f.state.tables[f.parent].length,1);});
 test(`${type}: zero media deletes parent without Storage request`,async()=>{const f=fixture(type);await f.remove();assert.equal(f.parentDeletes().length,1);assert.ok(!f.state.ops.some(o=>o.op==='remove'));});
 test(`${type}: foreign parent fails before destructive cleanup`,async()=>{const f=fixture(type);f.add();f.state.tables[f.parent][0].owner_id='foreign';await assert.rejects(f.remove());assert.equal(f.parentDeletes().length,0);assert.ok(!f.state.ops.some(o=>o.op==='remove'));});
}
test('legacy duplicate/negative orders append after max without renumbering',async()=>{const f=fixture();f.add({sort_order:-2});f.add({sort_order:2});f.add({sort_order:2});f.files.images=[image()];await f.upload();assert.deepEqual(f.state.tables[f.table].map(r=>r.sort_order),[-2,2,2,3]);});
test('first image on empty media set becomes cover; video never cover',async()=>{const f=fixture();f.files.images=[image()];f.files.videos=[video()];await f.upload();assert.deepEqual(f.state.tables[f.table].map(r=>r.is_cover),[true,false]);});
test('legacy images without cover stay unchanged; append does not create cover',async()=>{const f=fixture();f.add();f.files.images=[image()];await f.upload();assert.ok(f.state.tables[f.table].every(r=>!r.is_cover));});
test('existing video-only cover blocks second cover',async()=>{const f=fixture();f.add({media_type:'video',is_cover:true});f.files.images=[image()];await f.upload();assert.equal(f.state.tables[f.table].filter(r=>r.is_cover).length,1);});
test('media read failure prevents new upload',async()=>{const f=fixture();f.files.images=[image()];f.failure(o=>o.op==='read'&&o.table===f.table);await assert.rejects(f.upload());assert.equal(f.state.uploads,0);});
test('foreign upload rejected before Storage',async()=>{const f=fixture();f.state.tables[f.parent][0].owner_id='foreign';f.files.images=[image()];await assert.rejects(f.upload());assert.equal(f.state.uploads,0);});
test('auth disappearance fails closed',async()=>{const f=fixture();f.add();f.state.owner=null;await assert.rejects(f.remove());assert.equal(f.parentDeletes().length,0);assert.ok(!f.state.ops.some(o=>o.op==='remove'));});
for(const result of [{data:null,error:null},{data:[],error:null},{data:[{name:'wrong/path'}],error:null},{data:null,error:new Error('storage')}])test(`ambiguous remove ${JSON.stringify(result)} prevents parent DELETE`,async()=>{
 const f=fixture();f.add();f.window.AUSTA_SUPABASE.storage.from=()=>({remove:async()=>result});await assert.rejects(f.remove());assert.equal(f.parentDeletes().length,0);
});
test('Storage succeeds then parent fails: partial error, no full success or invented rows',async()=>{const f=fixture();f.add();f.failure(o=>o.table===f.parent&&o.op==='delete');await assert.rejects(f.remove(),/Media qismən və ya tam silinmiş ola bilər/);assert.equal(f.state.objects.size,0);assert.equal(f.state.tables[f.parent].length,1);assert.equal(f.state.tables[f.table].length,1);});
test('unsafe media path rejected before Storage deletion',async()=>{const f=fixture();f.add({storage_path:'foreign/existing/file'});await assert.rejects(f.remove());assert.ok(!f.state.ops.some(o=>o.op==='remove'));assert.equal(f.parentDeletes().length,0);});
test('all pages read: more than 1000 media rows cleaned before parent',async()=>{const f=fixture();for(let i=0;i<1001;i++)f.add({sort_order:i});await f.remove();assert.equal(f.state.objects.size,0);assert.equal(f.state.ops.filter(o=>o.op==='remove').length,11);});
test('new relation during cleanup detected; parent preserved',async()=>{const f=fixture();f.add();const storage=f.window.AUSTA_SUPABASE.storage.from;f.window.AUSTA_SUPABASE.storage.from=b=>{const api=storage(b);return {remove:async paths=>{const result=await api.remove(paths);f.add({storage_path:f.state.owner+'/'+f.id+'/concurrent.jpg'});return result;}};};await assert.rejects(f.remove());assert.equal(f.parentDeletes().length,0);});
test('auth switches during Storage cleanup: no parent DELETE',async()=>{const f=fixture();f.add();const storage=f.window.AUSTA_SUPABASE.storage.from;f.window.AUSTA_SUPABASE.storage.from=b=>{const api=storage(b);return {remove:async paths=>{const result=await api.remove(paths);f.state.owner='other';return result;}};};await assert.rejects(f.remove());assert.equal(f.parentDeletes().length,0);});
test('arbitrary source rejected without any DB or Storage operation',async()=>{const f=fixture();await assert.rejects(f.window.AUSTA_LISTING_MEDIA.deleteOwnedListing('storage.objects',f.id));assert.equal(f.state.ops.length,0);});
test('active edit snapshot is stable and double submission uploads only once',async()=>{
 const f=fixture();f.files.images=[image('original.jpg')];f.hold();const first=f.api.updateListing('cars',f.id,{}),second=f.api.updateListing('cars',f.id,{});
 f.files.images=[image('later.jpg')];await tick();assert.equal(f.state.uploads,1);f.state.release();await Promise.all([first,second]);
 const rows=f.state.tables[f.table];assert.equal(rows.length,1);assert.ok(rows[0].storage_path.endsWith('original.jpg'));assert.equal(f.state.ops.filter(o=>o.table===f.parent&&o.op==='update'&&Object.keys(o.row).length>1).length,1);
});
test('bad edit media rejects before parent mutation',async()=>{const f=fixture();f.files.images=[image('empty',{size:0})];await assert.rejects(f.api.updateListing('cars',f.id,{price:5}));assert.equal(f.state.ops.length,0);});
test('later file failure does not delete pre-existing media',async()=>{const f=fixture();const old=f.add({is_cover:true});f.files.images=[image('one'),image('two')];f.failure(o=>o.op==='upload'&&o.n===2);await assert.rejects(f.upload());assert.ok(f.state.tables[f.table].some(r=>r.id===old.id));assert.ok(f.state.objects.has(f.bucket+':'+old.storage_path));assert.ok(!f.state.ops.some(o=>o.op==='delete'));});
test('relation INSERT failure attempts removal of only the new object',async()=>{const f=fixture();const old=f.add({is_cover:true});f.files.images=[image()];f.failure(o=>o.op==='insert'&&o.table===f.table);await assert.rejects(f.upload());assert.equal(f.state.objects.size,1);assert.ok(f.state.objects.has(f.bucket+':'+old.storage_path));assert.equal(f.parentDeletes().length,0);});
for(const type of ['cars','parts'])for(const mode of ['video','zero','error'])test(`${type}: has_video ${mode}`,async()=>{
 const f=fixture(type);if(mode==='video')f.add({media_type:'video'});if(mode==='error')f.failure(o=>o.op==='read'&&o.table===f.table);
 const sync=()=>type==='cars'?f.window.__media.syncVehicleHasVideo(f.id,{id:f.state.owner}):f.api.syncMarketplaceHasVideo(f.id);
 if(mode==='error'){await assert.rejects(sync());assert.equal(f.state.tables[f.parent][0].has_video,true);assert.ok(!f.state.ops.some(o=>o.op==='update'));}
 else {await sync();assert.equal(f.state.tables[f.parent][0].has_video,mode==='video');}
});
test('My Listings actual delete function invokes guarded primitive then refreshes',async()=>{
 const f=fixture();f.add();let refreshed=0;f.context.confirm=()=>true;f.context.austaMyGetUser=async()=>({id:f.state.owner});f.context.austaMyLoadListings=async()=>refreshed++;
 const a=html.indexOf('async function austaMyDelete(item) {'),b=html.indexOf('/* ============================================================',a);
 vm.runInContext(html.slice(a,b),f.context);f.context.__item={id:f.id,__austa_table:f.parent};await vm.runInContext('austaMyDelete(__item)',f.context);
 assert.equal(refreshed,1);assert.equal(f.state.objects.size,0);assert.equal(f.parentDeletes().length,1);
});
test('full-delete double action shares one cleanup operation',async()=>{const f=fixture();f.add();await Promise.all([f.remove(),f.remove()]);assert.equal(f.parentDeletes().length,1);assert.equal(f.state.ops.filter(o=>o.op==='remove').length,1);});
test('malformed MIME family without subtype rejected',async()=>{const f=m.exports();f.files.images=[image('bad',{type:'image/'})];await assert.rejects(f.create('cars'));assert.equal(f.state.uploads,0);assert.equal(f.state.insertions,0);});
test('persisted-media pagination respects a server row cap smaller than requested',async()=>{
 const f=fixture();for(let i=0;i<7;i++)f.add({sort_order:i});const from=f.window.AUSTA_SUPABASE.from;
 f.window.AUSTA_SUPABASE.from=t=>{const q=from(t);const range=q.range.bind(q);q.range=(a,b)=>range(a,Math.min(b,a+1));return q;};
 await f.remove();assert.equal(f.state.objects.size,0);assert.equal(f.parentDeletes().length,1);
});
test('persisted-media reads request deterministic order tie breakers',async()=>{
 const f=fixture();f.add();const calls=[];const from=f.window.AUSTA_SUPABASE.from;
 f.window.AUSTA_SUPABASE.from=t=>{const q=from(t);q.order=(column,options)=>{calls.push([column,options.ascending]);return q;};return q;};
 await f.window.__media.persistedMedia(f.window.AUSTA_SUPABASE,f.window.__media.mediaConfig('cars'),f.id,{id:f.state.owner});
 assert.deepEqual(calls.slice(0,3),[['sort_order',true],['created_at',true],['id',true]]);
});
test('media query failure blocks full delete before any Storage request',async()=>{const f=fixture();f.add();f.failure(o=>o.op==='read'&&o.table===f.table);await assert.rejects(f.remove());assert.equal(f.parentDeletes().length,0);assert.ok(!f.state.ops.some(o=>o.op==='remove'));});
test('client identity change during cleanup blocks parent deletion',async()=>{
 const f=fixture();f.add();const client=f.window.AUSTA_SUPABASE,storage=client.storage.from;
 client.storage.from=b=>{const api=storage(b);return {remove:async paths=>{const result=await api.remove(paths);f.window.AUSTA_SUPABASE={...client};return result;}};};
 await assert.rejects(f.remove());assert.equal(f.parentDeletes().length,0);
});
test('UI full-delete failure reports partial outcome and does not refresh as success',async()=>{
 const f=fixture();f.add();let refreshed=0;f.context.confirm=()=>true;f.context.austaMyGetUser=async()=>({id:f.state.owner});f.context.austaMyLoadListings=async()=>refreshed++;
 f.failure(o=>o.op==='remove');const a=html.indexOf('async function austaMyDelete(item) {'),b=html.indexOf('/* ============================================================',a);
 vm.runInContext(html.slice(a,b),f.context);f.context.__item={id:f.id,__austa_table:f.parent};await vm.runInContext('austaMyDelete(__item)',f.context);
 assert.equal(refreshed,0);assert.equal(f.parentDeletes().length,0);assert.match(f.state.alerts.at(-1),/Silmə tamamlanmadı/);
});
test('append and full-delete in the same page cannot run concurrently',async()=>{
 const f=fixture();f.files.images=[image()];f.hold();const saving=f.api.updateListing('cars',f.id,{});await tick();await assert.rejects(f.remove());assert.equal(f.parentDeletes().length,0);f.state.release();await saving;
});
test('post-cleanup parent response ambiguity is not success',async()=>{
 const f=fixture();f.add();f.failure(o=>o.table===f.parent&&o.op==='delete',{after:true});await assert.rejects(f.remove(),/Silmə tamamlanmadı/);assert.equal(f.state.objects.size,0);
});
test('canonical path and metadata owner derive from authenticated user, never form input',async()=>{
 const f=fixture();f.files.images=[image('../user supplied name.jpg')];await f.api.updateListing('cars',f.id,{owner_id:'foreign'});
 const row=f.state.tables[f.table][0];assert.equal(row.owner_id,f.state.owner);assert.ok(row.storage_path.startsWith(f.state.owner+'/'+f.id+'/'));assert.equal(row.storage_path.split('/').length,3);
 assert.equal(f.state.tables[f.parent][0].owner_id,f.state.owner);
});
