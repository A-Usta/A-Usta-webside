const assert = require('node:assert/strict');
const {test} = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = (id, text=html) => {
  const match = text.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'));
  assert.ok(match, id); return match[1];
};
const routerId = 'austa-v153b-all-real-listing-router';
const mediaId = 'austa-v153d-14-category-media-js';
const categories = ['parts','accessories','moto','special','bus','water','caravan','trailer','plate'];

function fixture({flag=false, videos=0, images=0, fail, failUploadAt=0, failRelationAt=0, failFlagUpdate=false, foreignOwner=false}={}) {
  const state = {listing:{id:'listing-1',owner_id:foreignOwner?'other':'owner-1',has_video:flag}, media:[],calls:[],writes:[],uploads:0,relationInserts:0,mediaBuilds:0,failFlagUpdate};
  for(let i=0;i<videos;i++) state.media.push({id:'video-'+i,listing_id:'listing-1',owner_id:'owner-1',media_type:'video'});
  for(let i=0;i<images;i++) state.media.push({id:'image-'+i,listing_id:'listing-1',owner_id:'owner-1',media_type:'image'});
  const files = {images:[], videos:[]};
  class Query {
    constructor(table){this.table=table;this.filters=[];this.op='read';}
    select(){return this;}
    eq(column,value){this.filters.push([column,value]);return this;}
    limit(){return this;}
    insert(row){this.op='insert';this.row=row;return this;}
    update(row){this.op='update';this.row=row;return this;}
    single(){return this;}
    then(resolve,reject){return Promise.resolve().then(()=>this.exec()).then(resolve,reject);}
    exec(){
      state.calls.push({table:this.table,op:this.op,filters:this.filters,row:this.row});
      const error = label => ({data:null,error:new Error(label)});
      if(this.table==='marketplace_listing_media'){
        if(this.op==='insert'){
          state.relationInserts++;
          if(failRelationAt===state.relationInserts)return error('relation insert failed');
          state.media.push({id:'new-'+state.relationInserts,...this.row});return {data:null,error:null};
        }
        assert.equal(this.op,'read');
        assert.ok(this.filters.some(([c,v])=>c==='listing_id'&&v==='listing-1'));
        assert.ok(this.filters.some(([c,v])=>c==='media_type'&&v==='video'));
        if(fail==='read')return error('media query failed');
        if(fail==='format')return {data:null,error:null};
        return {data:state.media.filter(r=>this.filters.every(([c,v])=>r[c]===v)).slice(0,1),error:null};
      }
      assert.equal(this.table,'marketplace_listings');
      if(this.op==='insert'){
        state.writes.push(this.row);state.listing={id:'listing-1',...this.row};
        return {data:{...state.listing},error:null};
      }
      assert.equal(this.op,'update');
      assert.ok(this.filters.some(([c,v])=>c==='owner_id'&&v==='owner-1'));
      assert.ok(this.filters.some(([c,v])=>c==='id'&&v==='listing-1'));
      if(fail==='update'||(state.failFlagUpdate&&Object.keys(this.row).length===1))return error('listing update failed');
      if(!this.filters.every(([c,v])=>state.listing[c]===v))return error('owner denied');
      state.writes.push(this.row);Object.assign(state.listing,this.row);
      return {data:{...state.listing},error:null};
    }
  }
  const sb = {
    auth:{getSession:async()=>({data:{session:{user:{id:'owner-1'}}},error:null}),getUser:async()=>({data:{user:{id:'owner-1'}},error:null})},
    from:table=>new Query(table),
    storage:{from(bucket){assert.equal(bucket,'marketplace-media');return {
      async upload(){state.uploads++;return {error:state.uploads===failUploadAt?new Error('upload failed'):null};},
      async remove(){return {error:null};}
    };}}
  };
  const document = {readyState:'loading',addEventListener(){},getElementById(id){
    if(id==='austaV153DImages')return {files:files.images};
    if(id==='austaV153DVideo')return {files:files.videos};
    return null;
  }};
  const window = {AUSTA_SUPABASE:sb,dispatchEvent(){},crypto:{randomUUID:()=> 'random'},
    AUSTA_V153C:{open(){},async edit(){return 'edited';}}};
  const context = vm.createContext({window,document,console:{log(){},warn(){},error(){}},
    CustomEvent:class{},setTimeout(){},clearTimeout(){},alert(){}});
  vm.runInContext(fs.readFileSync(path.join(root,'assets/marketplace/listing-publish.js'),'utf8'),context);
  vm.runInContext(script(routerId),context);
  const mediaSource=script(mediaId);
  const tail=mediaSource.lastIndexOf('})();');assert.ok(tail>0);
  vm.runInContext(mediaSource.slice(0,tail)+`
    window.__mediaTest={uploadMedia,patchSave,patchOpen};
    buildMediaBox=()=>{window.__mediaBuilds=(window.__mediaBuilds||0)+1;};
  `+mediaSource.slice(tail),context);
  window.__mediaTest.patchSave();
  const api=window.AUSTA_V153;
  const metadata=(type='parts',extra={})=>api.updateListing(type,'listing-1',{title:'Updated',price:25,description:'Text',...extra});
  return {state,files,window,api,metadata,media:window.__mediaTest};
}
const video = name => ({name,type:'video/mp4'});
const image = name => ({name,type:'image/jpeg'});

for(const type of categories){
  test(`${type}: create ignores optimistic form flag, starts false`,async()=>{
    const f=fixture();await f.api.saveListing(type,{title:'Listing',price:10,has_video:true,hasVideo:true});
    assert.equal(f.state.listing.has_video,false);
  });
  for(const hasVideo of [true,false]){
    test(`${type}: metadata edit preserves ${hasVideo} from actual media`,async()=>{
      const f=fixture({flag:hasVideo,videos:hasVideo?1:0});await f.metadata(type);
      assert.equal(f.state.listing.has_video,hasVideo);
    });
  }
}

test('explicit false/stale form input cannot clear real video',async()=>{
  const f=fixture({flag:true,videos:1});await f.metadata('parts',{has_video:false,hasVideo:false});
  assert.equal(f.state.listing.has_video,true);
});
test('explicit true input cannot fabricate video',async()=>{
  const f=fixture();await f.metadata('parts',{has_video:true});assert.equal(f.state.listing.has_video,false);
});
test('image-only media derives false',async()=>{
  const f=fixture({images:2,flag:true});await f.metadata();assert.equal(f.state.listing.has_video,false);
});
test('first video upload confirms relation then synchronizes true',async()=>{
  const f=fixture();f.files.videos=[video('clip.mp4')];await f.media.uploadMedia('parts','listing-1');
  assert.equal(f.state.listing.has_video,true);
  assert.equal(f.state.media.filter(r=>r.media_type==='video').length,1);
  const ops=f.state.calls.map(r=>r.table+':'+r.op);
  assert.deepEqual(ops,['marketplace_listing_media:insert','marketplace_listing_media:read','marketplace_listings:update']);
});
test('create wrapper with successful video produces real true',async()=>{
  const f=fixture();f.media.patchSave();f.files.videos=[video('clip.mp4')];
  await f.api.saveListing('parts',{title:'Listing',price:10});
  assert.equal(f.state.writes[0].has_video,false);assert.equal(f.state.listing.has_video,true);
});
test('edit wrapper adds first video after metadata update',async()=>{
  const f=fixture();f.media.patchSave();f.files.videos=[video('clip.mp4')];await f.metadata();
  assert.equal(f.state.listing.has_video,true);
});
test('image edit with existing video stays true',async()=>{
  const f=fixture({flag:true,videos:1});f.media.patchSave();f.files.images=[image('image.jpg')];await f.metadata();
  assert.equal(f.state.listing.has_video,true);
});
test('confirmed removal of only video reconciles false',async()=>{
  const f=fixture({flag:true,videos:1});f.state.media=[];
  await f.api.syncMarketplaceHasVideo('listing-1');assert.equal(f.state.listing.has_video,false);
});
test('removal of one of multiple videos retains true',async()=>{
  const f=fixture({flag:true,videos:2});f.state.media.pop();
  await f.api.syncMarketplaceHasVideo('listing-1');assert.equal(f.state.listing.has_video,true);
});
test('failed removal leaves relation present: reconciliation preserves true',async()=>{
  const f=fixture({flag:true,videos:1});await f.api.syncMarketplaceHasVideo('listing-1');
  assert.equal(f.state.listing.has_video,true);assert.equal(f.state.media.length,1);
});
for(const fail of ['read','format']){
  test(`${fail} media state: metadata update fails without false write`,async()=>{
    const f=fixture({flag:true,videos:1,fail});await assert.rejects(f.metadata());
    assert.equal(f.state.listing.has_video,true);assert.equal(f.state.writes.length,0);
  });
}
for(const opts of [{failUploadAt:1},{failRelationAt:1}]){
  test(`${JSON.stringify(opts)}: no false-positive flag`,async()=>{
    const f=fixture(opts);f.files.videos=[video('clip.mp4')];
    await assert.rejects(f.media.uploadMedia('parts','listing-1'));
    assert.equal(f.state.listing.has_video,false);assert.equal(f.state.media.length,0);
  });
}
test('later upload failure retains true for first confirmed video',async()=>{
  const f=fixture({failUploadAt:2});f.files.videos=[video('a.mp4'),video('b.mp4')];
  await assert.rejects(f.media.uploadMedia('parts','listing-1'));
  assert.equal(f.state.media.length,1);assert.equal(f.state.listing.has_video,true);
});
test('later relation failure retains true for first confirmed video',async()=>{
  const f=fixture({failRelationAt:2});f.files.videos=[video('a.mp4'),video('b.mp4')];
  await assert.rejects(f.media.uploadMedia('parts','listing-1'));
  assert.equal(f.state.media.length,1);assert.equal(f.state.listing.has_video,true);
});
test('listing sync failure surfaces; retry repairs persisted relation',async()=>{
  const f=fixture({failFlagUpdate:true});f.files.videos=[video('a.mp4')];
  await assert.rejects(f.media.uploadMedia('parts','listing-1'));
  assert.equal(f.state.media.length,1);assert.equal(f.state.listing.has_video,false);
  f.state.failFlagUpdate=false;
  await f.api.syncMarketplaceHasVideo('listing-1');
  assert.equal(f.state.listing.has_video,true);assert.equal(f.state.uploads,1);
});
test('metadata update failure preserves old flag and prevents upload',async()=>{
  const f=fixture({flag:true,videos:1,fail:'update'});f.media.patchSave();f.files.videos=[video('a.mp4')];
  await assert.rejects(f.metadata());assert.equal(f.state.listing.has_video,true);assert.equal(f.state.uploads,0);
});
test('owner-scoped synchronization rejects another owner',async()=>{
  const f=fixture({foreignOwner:true,videos:1});await assert.rejects(f.api.syncMarketplaceHasVideo('listing-1'));
  assert.equal(f.state.writes.length,0);
});
test('edit builds existing media inputs for Marketplace; provider/dealer unchanged',async()=>{
  const f=fixture();f.media.patchOpen();
  await f.window.AUSTA_V153C.edit({__austa_table:'marketplace_listings'});assert.equal(f.window.__mediaBuilds,1);
  await f.window.AUSTA_V153C.edit({__austa_table:'service_provider_listings'});assert.equal(f.window.__mediaBuilds,1);
  await f.window.AUSTA_V153C.edit({__austa_table:'auto_dealer_listings'});assert.equal(f.window.__mediaBuilds,1);
});
test('missing listing ID cannot query/write',async()=>{
  const f=fixture();await assert.rejects(f.api.syncMarketplaceHasVideo(''));assert.equal(f.state.calls.length,0);
});
test('no files means no upload or sync work',async()=>{
  const f=fixture({flag:true,videos:1});await f.media.uploadMedia('parts','listing-1');
  assert.equal(f.state.calls.length,0);assert.equal(f.state.listing.has_video,true);
});
test('unrelated inline scripts and five pre-existing syntax issues remain unchanged',()=>{
  const base=cp.execFileSync('git',['show','origin/main:index.html'],{cwd:root,encoding:'utf8',maxBuffer:1e7});
  const scripts=text=>[...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  const old=scripts(base),current=scripts(html);assert.equal(old.length,current.length);let legacy=0;
  for(let i=0;i<old.length;i++){
    const id=current[i][1];let before,after;
    try{new vm.Script(old[i][2]);}catch(e){before=e.message;legacy++;}
    try{new vm.Script(current[i][2]);}catch(e){after=e.message;}
    assert.equal(after,before);
    if(!id.includes(routerId)&&!id.includes(mediaId)&&!id.includes('austa-v153c-real-listing-form-js')){
      // P1.1C adds exactly one Rent-only spec; all other detail code stays identical.
      const rentalSpec="    ['İcarə növü',item.listing_type==='rent' ? vehicleText(item.rental_type) : ''],\n";
      // P1.1E.5 changes only Vehicle contact sourcing in the detail helper.
      const contactSource = "  if(item?.category === 'cars' || item?.category === 'rent' ||\n     item?.__austa_table === 'vehicle_listings' ||\n     item?.listing_type === 'sale' || item?.listing_type === 'rent'){\n    return String(item.contact_name ?? '').trim() || 'Elan sahibi';\n  }\n\n";
      assert.equal(current[i][2].replace(rentalSpec,'').replace(contactSource,''),old[i][2].replace(rentalSpec,''));
    }
  }
  assert.equal(legacy,5);
});
