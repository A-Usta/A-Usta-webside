const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const filename=path.join(__dirname,'listing-publish.test.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
let harness=fs.readFileSync(filename,'utf8').split('const noSuccess=f=>')[0]
 .replace('return {state,files,window,api,core','return {context,document,state,files,window,api,core')
 .replace('window.__media={patchSave,uploadMedia,','window.__media={mediaEdit,managerMutation,patchSave,uploadMedia,');
if(process.env.P15_MUTATION==='lock'){
 const old="const media=block(ids.media),end=media.lastIndexOf('})();');";
 const marker="if(mediaLifecycleFlights.has(source+':'+id))";
 const replacement="const media=block(ids.media).replace("+JSON.stringify(marker)+",'if(false)'),end=media.lastIndexOf('})();');";
 assert.ok(harness.includes(old));harness=harness.replace(old,replacement);
}
m._compile(harness+'\nmodule.exports=fixture;',filename);
const runtime=fs.readFileSync(path.join(root,'assets/marketplace/listing-lifecycle.js'),'utf8');
const mutations={
 source:["return {source,config:sources[source],id:item.id};", "return {source,config:{...sources[source],table:item.__austa_table},id:item.id};"],
 staging:["if(action==='reactivate'&&(status==='archived'", "if(action==='reactivate'&&(status==='draft'||status==='inactive'||status==='archived'"],
 cas:[".eq('status',row.status)",""],
 owner:["data.owner_id!==context.user.id",'false'],
 auth:["context.epoch===epoch",'true'],
 promotion:["if(row.status!=='active')",'if(false)']
};
const maps={cars:['vehicle','vehicle_listings','listing_type','sale'],rent:['vehicle','vehicle_listings','listing_type','rent'],parts:['marketplace','marketplace_listings','category','parts'],service:['service_provider','service_provider_listings','provider_type','service'],usta:['service_provider','service_provider_listings','provider_type','usta'],dealer:['auto_dealer','auto_dealer_listings',null,'dealer']};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};};
function fixture(type='cars',status='active'){
 const f=m.exports(),[source,table,field,subtype]=maps[type];
 const row={id:'listing',owner_id:f.state.owner,status,created_at:'2026-01-01',brand:'BMW',model:'X5',year:2024,price:0,daily_price:80,title:'Elan',dealer_name:'Salon',...(field?{[field]:subtype}:{})};
 f.state.tables[table].push(row);f.row=row;f.table=table;f.source=source;
 f.item={...row,__austa_source:source,__austa_table:table,__austa_title:'Elan'};
 const authEvents=[];f.authEvents=authEvents;f.state.user=f.state.owner;
 f.window.AUSTA_SUPABASE.auth.getUser=async()=>({data:{user:f.state.user?{id:f.state.user}:null},error:null});
 f.window.AUSTA_SUPABASE.auth.onAuthStateChange=cb=>{authEvents.push(cb);return {data:{subscription:{unsubscribe(){}}}};};
 f.switchUser=id=>{f.state.user=id;f.state.owner=id;authEvents.forEach(cb=>cb(id?'SIGNED_IN':'SIGNED_OUT',{user:id?{id}:null}));};
 f.window.confirm=()=>true;
 const from=f.window.AUSTA_SUPABASE.from;
 f.window.AUSTA_SUPABASE.from=table=>{
  const q=from(table),then=q.then.bind(q);
  q.then=(ok,bad)=>Promise.resolve().then(async()=>{if(f.hook)await f.hook(q);return then(value=>value);}).then(ok,bad);
  return q;
 };
 const nodes=new Map(),get=f.document.getElementById.bind(f.document);
 f.document.getElementById=id=>nodes.get(id)||get(id);
 f.host=(id='austaMyListings')=>{const node={id,isConnected:true,innerHTML:''};nodes.set(id,node);return node;};
 let sourceCode=runtime;
 if(mutations[process.env.P15_MUTATION]){const [before,after]=mutations[process.env.P15_MUTATION];assert.ok(sourceCode.includes(before));sourceCode=sourceCode.replace(before,after);}
 vm.runInContext(sourceCode,f.context);f.lifecycle=f.window.AUSTA_MY_LIFECYCLE;
 f.transition=action=>f.lifecycle.transition(f.item,action);
 f.writes=()=>f.state.ops.filter(o=>o.op==='update');
 return f;
}
const allowed={cars:[['active','mark_sold','sold'],['sold','reactivate','active'],['active','archive','archived'],['archived','reactivate','active']],rent:[['active','mark_rented','rented'],['rented','reactivate','active'],['active','archive','archived'],['archived','reactivate','active']],parts:[['active','mark_sold','sold'],['sold','reactivate','active'],['active','archive','archived'],['archived','reactivate','active']],service:[['active','archive','archived'],['archived','reactivate','active']],usta:[['active','archive','archived'],['archived','reactivate','active']],dealer:[['active','archive','archived'],['archived','reactivate','active']]};
for(const [type,transitions] of Object.entries(allowed))for(const [before,action,after] of transitions)test(`${type}: ${before} -> ${after} via ${action}`,async()=>{
 const f=fixture(type,before);const saved=await f.transition(action);assert.equal(saved.status,after);assert.equal(f.row.status,after);
 const writes=f.writes();assert.equal(writes.length,1);assert.equal(writes[0].table,f.table);
 assert.ok(writes[0].filters.some(([key,value])=>key==='status'&&value===before));
 assert.ok(writes[0].filters.some(([key,value])=>key==='owner_id'&&value==='owner-1'));
 assert.ok(f.state.ops.filter(o=>o.op==='read'&&o.table===f.table&&o.filters.some(([key])=>key==='id')).length>=2);
 assert.equal(f.state.ops.filter(o=>['upload','remove','delete','insert'].includes(o.op)).length,0);
});
for(const type of Object.keys(maps))for(const status of ['draft','inactive','unknown','__proto__'])for(const action of ['mark_sold','mark_rented','archive','reactivate'])test(`${type}: ${status} rejects ${action}`,async()=>{
 const f=fixture(type,status);await assert.rejects(f.transition(action));assert.equal(f.writes().length,0);assert.deepEqual([...f.lifecycle.actions(f.item)],[]);
});
for(const [type,status,action] of [['cars','sold','archive'],['cars','archived','mark_sold'],['cars','active','mark_rented'],['rent','rented','archive'],['rent','archived','mark_rented'],['rent','active','mark_sold'],['parts','sold','archive'],['parts','archived','mark_sold'],['service','active','mark_sold'],['usta','active','mark_rented'],['dealer','active','mark_sold'],['dealer','active','mark_rented']])test(`${type}/${status} incompatible ${action}`,async()=>{const f=fixture(type,status);await assert.rejects(f.transition(action));assert.equal(f.writes().length,0);});
for(const action of ['active','inactive','sold','rented','archived','__proto__',{status:'active'},null])test('arbitrary target/action rejected '+JSON.stringify(action),async()=>{const f=fixture();await assert.rejects(f.transition(action));assert.equal(f.writes().length,0);});
for(const source of ['profiles','storage.objects','vehicle_listings','__proto__',null,{}])test('source allowlist rejects '+JSON.stringify(source),async()=>{const f=fixture();f.item.__austa_source=source;await assert.rejects(f.transition('archive'));assert.equal(f.state.ops.length,0);});
test('DOM/table fields cannot select mutation table',async()=>{const f=fixture();f.item.__austa_table='profiles';f.item.bucket='private';await f.transition('archive');assert.ok(f.writes().every(o=>o.table==='vehicle_listings'));});
for(const type of ['cars','rent','parts','service','usta'])test(type+' invalid authoritative subtype rejected',async()=>{const f=fixture(type);f.row[maps[type][2]]='invalid';await assert.rejects(f.transition('archive'));assert.equal(f.writes().length,0);});
for(const category of ['parts','accessories','special','moto','plate','bus','water','caravan','trailer'])test('canonical Marketplace category '+category,async()=>{const f=fixture('parts');f.row.category=category;await f.transition('archive');assert.equal(f.row.status,'archived');});
test('cached status cannot authorize a staging reactivation',async()=>{const f=fixture('cars','draft');f.item.status='sold';await assert.rejects(f.transition('reactivate'));assert.equal(f.writes().length,0);});
test('authoritative active status wins over cached sold',async()=>{const f=fixture();f.item.status='sold';await f.transition('archive');assert.equal(f.row.status,'archived');});
test('owner mismatch fails closed even if SELECT returns foreign row',async()=>{const f=fixture();f.hook=q=>{if(q.one&&q.op==='read'){q.filters=q.filters.filter(([key])=>key!=='owner_id');f.row.owner_id='foreign';}};await assert.rejects(f.transition('archive'));assert.equal(f.writes().length,0);});
test('CAS rejects status changed during confirmation',async()=>{const f=fixture();f.window.confirm=()=>{f.row.status='sold';return true;};await assert.rejects(f.transition('archive'),{code:'LIFECYCLE_CONFLICT'});assert.equal(f.row.status,'sold');assert.ok(f.state.ops.filter(o=>o.op==='read'&&o.table===f.table).length>=3);});
test('zero-row UPDATE never returns success and re-reads persisted state',async()=>{const f=fixture();f.hook=q=>{if(q.op==='update')f.state.tables[f.table]=[];};await assert.rejects(f.transition('archive'),{code:'LIFECYCLE_CONFLICT'});assert.equal(f.writes().length,1);assert.ok(f.state.ops.some(o=>o.op==='read'&&o.table===f.table));});
test('post-write authoritative status mismatch fails',async()=>{const f=fixture();f.hook=q=>{if(q.one&&q.op==='read'&&f.writes().length)f.row.status='sold';};await assert.rejects(f.transition('archive'),{code:'LIFECYCLE_CONFLICT'});});
test('same-page repeated clicks launch exactly one mutation',async()=>{const f=fixture(),gate=deferred();f.hook=async q=>{if(q.op==='update')await gate.promise;};const a=f.transition('archive'),b=f.transition('archive');assert.equal(a,b);await tick();gate.resolve();await a;assert.equal(f.writes().length,1);});
test('cancelled confirmation causes no write',async()=>{const f=fixture();f.window.confirm=()=>false;assert.equal(await f.transition('archive'),null);assert.equal(f.writes().length,0);});
for(const type of Object.keys(maps))for(const status of ['draft','inactive','sold','rented','archived','unknown'])test(type+' non-active promotion blocked '+status,async()=>{const f=fixture(type,status);await assert.rejects(f.lifecycle.authorizePromotion(f.item));assert.equal(f.writes().length,0);});
test('promotion uses persisted status, not active cache',async()=>{const f=fixture('parts','sold');f.item.status='active';await assert.rejects(f.lifecycle.authorizePromotion(f.item));});
test('eligible active promotion returns fresh owner/source row',async()=>{const f=fixture();const row=await f.lifecycle.authorizePromotion({...f.item,owner_id:'fake'});assert.equal(row.owner_id,'owner-1');assert.equal(row.__austa_table,'vehicle_listings');});
test('A loader pending -> B completes -> A resolves cannot overwrite B cache/UI',async()=>{
 const f=fixture(),host=f.host(),gate=deferred();let held=false;
 f.hook=async q=>{if(q.op==='read'&&q.filters.some(([key,value])=>key==='owner_id'&&value==='owner-1')&&!held){held=true;await gate.promise;}};
 const old=f.lifecycle.load(host);await tick();f.switchUser('owner-B');f.state.tables.vehicle_listings.push({...f.row,id:'B',owner_id:'owner-B',brand:'B brand'});
 await f.lifecycle.load(host);const before=host.innerHTML;assert.ok(before.includes('B brand'));gate.resolve();await old;
 assert.equal(host.innerHTML,before);assert.ok(f.window.AUSTA_MY_REAL_LISTINGS.every(row=>row.owner_id==='owner-B'));
});
test('logout clears cache immediately and delayed load cannot restore it',async()=>{const f=fixture(),host=f.host();await f.lifecycle.load(host);assert.equal(f.window.AUSTA_MY_REAL_LISTINGS.length,1);const gate=deferred();let held=false;f.hook=async q=>{if(q.op==='read'&&!held){held=true;await gate.promise;}};const old=f.lifecycle.load(host);await tick();f.switchUser(null);assert.equal(f.window.AUSTA_MY_REAL_LISTINGS.length,0);gate.resolve();await old;assert.equal(f.window.AUSTA_MY_REAL_LISTINGS.length,0);assert.ok(host.innerHTML.includes('daxil olun'));});
test('obsolete mount cannot publish delayed loader result',async()=>{const f=fixture(),host=f.host(),gate=deferred();let held=false;f.hook=async q=>{if(q.op==='read'&&!held){held=true;await gate.promise;}};const old=f.lifecycle.load(host);await tick();host.isConnected=false;const next=f.host();await f.lifecycle.load(next);const before=next.innerHTML;gate.resolve();await old;assert.equal(next.innerHTML,before);});
test('auth switch while UPDATE pending cannot update B UI or report success',async()=>{const f=fixture(),host=f.host();await f.lifecycle.load(host);const gate=deferred();f.hook=async q=>{if(q.op==='update')await gate.promise;};const old=f.transition('archive');await tick();f.switchUser('owner-B');await f.lifecycle.load(host);const before=host.innerHTML;gate.resolve();await assert.rejects(old,error=>error.silent===true);assert.equal(host.innerHTML,before);});
test('client replacement rejects old pending lifecycle completion',async()=>{const f=fixture(),gate=deferred();f.hook=async q=>{if(q.op==='update')await gate.promise;};const old=f.transition('archive');await tick();f.window.AUSTA_SUPABASE={...f.window.AUSTA_SUPABASE};gate.resolve();await assert.rejects(old,error=>error.silent===true);});
test('old mount lifecycle completion cannot touch replacement UI',async()=>{const f=fixture(),host=f.host();await f.lifecycle.load(host);const gate=deferred();f.hook=async q=>{if(q.op==='update')await gate.promise;};const old=f.transition('archive');await tick();host.isConnected=false;const next=f.host();await f.lifecycle.load(next);const before=next.innerHTML;gate.resolve();await assert.rejects(old,error=>error.silent===true);assert.equal(next.innerHTML,before);});
test('partial source failure preserves successful rows and displays warning',async()=>{const f=fixture(),host=f.host();f.failure(o=>o.table==='marketplace_listings'&&o.op==='read',{once:false});await f.lifecycle.load(host);assert.equal(f.window.AUSTA_MY_REAL_LISTINGS.length,1);assert.ok(host.innerHTML.includes('Bəzi elanlar yüklənmədi'));assert.ok(host.innerHTML.includes('data-austa-my-retry'));assert.ok(host.innerHTML.includes('BMW'));assert.ok(!host.innerHTML.includes('Hələ elanınız yoxdur'));});
test('all source failures never claim empty listings',async()=>{const f=fixture(),host=f.host();f.failure(o=>o.op==='read',{once:false});await f.lifecycle.load(host);assert.ok(host.innerHTML.includes('Bəzi elanlar yüklənmədi'));assert.ok(!host.innerHTML.includes('Hələ elanınız yoxdur'));});
test('real empty response has an empty state without failure warning',async()=>{const f=fixture(),host=f.host();f.state.tables[f.table]=[];await f.lifecycle.load(host);assert.ok(host.innerHTML.includes('Hələ elanınız yoxdur'));assert.ok(!host.innerHTML.includes('Bəzi elanlar'));});
test('loader paginates owner-scoped sources and sorts globally',async()=>{const f=fixture('cars'),host=f.host();f.state.tables.marketplace_listings.push({id:'newer',owner_id:'owner-1',status:'active',category:'parts',created_at:'2026-02-01'});await f.lifecycle.load(host);assert.equal(f.window.AUSTA_MY_REAL_LISTINGS[0].id,'newer');assert.ok(f.state.ops.filter(o=>o.op==='read').every(o=>o.filters.some(([key,value])=>key==='owner_id'&&value==='owner-1')));});
for(const [status,label] of Object.entries({active:'Aktiv',inactive:'Aktiv deyil',draft:'Qaralama',sold:'Satılıb',rented:'İcarəyə verilib',archived:'Arxivdə'}))test('status label '+status,()=>assert.equal(fixture().lifecycle.statusLabel(status),label));
test('unknown status is neutral; no raw values or lifecycle/promotion actions',()=>{const f=fixture('cars','<script>secret</script>');const markup=f.lifecycle.render([f.item]);assert.ok(markup.includes('Status əlçatan deyil'));assert.ok(!markup.includes('secret'));assert.ok(!markup.includes('data-austa-my-transition'));assert.ok(!markup.includes('data-austa-my-vip'));});
test('seller-controlled owner listing text is escaped',async()=>{const f=fixture(),host=f.host();f.row.brand='<img src=x onerror=alert(1)>';await f.lifecycle.load(host);assert.ok(host.innerHTML.includes('&lt;img'));assert.ok(!host.innerHTML.includes('<img'));});
test('inactive/draft render never shows generic activation',()=>{for(const status of ['draft','inactive']){const f=fixture('parts',status),markup=f.lifecycle.render([f.item]);assert.ok(!markup.includes('data-austa-my-transition'));assert.ok(!markup.includes('data-austa-my-vip'));}});
test('lifecycle lock blocks full delete, edit/save, media mutation, and edit mount',async()=>{const f=fixture(),opened=await f.window.AUSTA_LISTING_MEDIA.open('cars','listing'),gate=deferred();f.hook=async q=>{if(q.op==='update')await gate.promise;};const work=f.transition('archive');await tick();await assert.rejects(f.window.AUSTA_LISTING_MEDIA.deleteOwnedListing(f.table,'listing'));await assert.rejects(f.window.__media.mediaEdit('cars','listing',async()=>{}));await assert.rejects(f.window.AUSTA_LISTING_MEDIA.cover(opened.handle,'missing'));await assert.rejects(f.window.AUSTA_LISTING_MEDIA.open('cars','listing'));gate.resolve();await work;});
test('active full delete blocks lifecycle before status write',async()=>{const f=fixture(),gate=deferred();let held=false;f.hook=async q=>{if(q.op==='read'&&q.table==='listing_media'&&!held){held=true;await gate.promise;}};const deleting=f.window.AUSTA_LISTING_MEDIA.deleteOwnedListing(f.table,'listing');await tick();await assert.rejects(f.transition('archive'));assert.equal(f.writes().length,0);gate.resolve();await deleting;});
test('active edit/save blocks lifecycle before status write',async()=>{const f=fixture(),gate=deferred();const editing=f.window.__media.mediaEdit('cars','listing',async()=>gate.promise);await tick();await assert.rejects(f.transition('archive'));assert.equal(f.writes().length,0);gate.resolve();await editing;});
test('active media mutation blocks lifecycle before status write',async()=>{const f=fixture(),opened=await f.window.AUSTA_LISTING_MEDIA.open('cars','listing'),gate=deferred();const mutation=f.window.__media.managerMutation(opened.handle,async()=>gate.promise);await tick();await assert.rejects(f.transition('archive'));assert.equal(f.writes().length,0);gate.resolve();await mutation;});
test('baseline repair is symmetric on exact main and retains real coordinator comparison',()=>{
 const main=cp.execFileSync('git',['show','origin/main:index.html'],{cwd:root,encoding:'utf8',maxBuffer:1e7});
 const publish=s=>s.slice(s.indexOf('const user=await currentUser();',s.indexOf('window.AUSTA_V153.saveListing = async')),s.indexOf('// Only completed activation'));
 const normalized=s=>publish(s).replace('saveDealer(attempt,sellerIntent,approved?.values)','saveDealer(attempt,sellerIntent)');
 assert.equal(normalized(html),normalized(main));
 assert.notEqual(normalized(html.replace('client:sb(),user,config:mediaConfig(type),files:snapshot','client:sb(),user,config:mediaConfig(type),files:[]')),normalized(main));
});

for(const type of Object.keys(maps))test(type+' public category query excludes every non-active lifecycle state',async()=>{
 const f=fixture(type);
 f.state.tables[f.table]=['draft','inactive','sold','rented','archived','active'].map((status,i)=>({...f.row,id:'public-'+i,status}));
 f.window.AUSTA_CATEGORY_FILTERS={applyQuery:q=>q};
 let code=html.match(/<script id="austa-v154e-global-promotion-pagination">([\s\S]*?)<\/script>/)[1];
 const end=code.lastIndexOf('})();');code=code.slice(0,end)+'window.__p15PublicQuery=queryAll;'+code.slice(end);
 vm.runInContext(code,f.context);
 const rows=await f.window.__p15PublicQuery(type);
 assert.equal(rows.length,1);assert.equal(rows[0].status,'active');
});
test('missing auth cannot mutate listing',async()=>{const f=fixture();f.state.user=null;await assert.rejects(f.transition('archive'));assert.equal(f.writes().length,0);});
test('same-user latest load supersedes an older delayed load',async()=>{
 const f=fixture(),host=f.host(),gate=deferred();let held=false;
 f.hook=async q=>{if(q.op==='read'&&!held){held=true;await gate.promise;}};
 const old=f.lifecycle.load(host);await tick();f.row.status='sold';await f.lifecycle.load(host);const before=host.innerHTML;
 assert.ok(before.includes('Satılıb'));gate.resolve();await old;assert.equal(host.innerHTML,before);
});
test('auth failure is a load error, not an empty result',async()=>{
 const f=fixture(),host=f.host();f.window.AUSTA_SUPABASE.auth.getUser=async()=>({data:{user:null},error:new Error('auth')});
 await f.lifecycle.load(host);assert.ok(host.innerHTML.includes('mümkün olmadı'));assert.ok(!host.innerHTML.includes('Hələ elanınız yoxdur'));
});
test('account, direct owner package and edit entry points use the actual lifecycle gates',async()=>{
 const f=fixture();const alerts=[];f.context.alert=message=>alerts.push(message);
 const start=html.indexOf('async function austaV157Open(');
 // Execute the actual package function; an ineligible row must return before touching DOM.
 const next=html.indexOf('window.AUSTA_PROMOTION_V157 =',start);
 const fn=html.slice(start,next);
 // The trailing public-API comment is harmless; any active-only UI path would hit this stub.
 f.context.austaV157Close=()=>{throw new Error('package must not open');};
 vm.runInContext(fn,f.context);
 f.row.status='sold';await vm.runInContext('austaV157Open('+JSON.stringify(f.item)+')',f.context);
 assert.equal(alerts.length,1);assert.match(alerts[0],/yalnız aktiv/);
 const a=html.indexOf('async function austaMyEdit(item) {'),b=html.indexOf('/* ------------------------------------------------------------',a);
 f.context.window.AUSTA_V153C.edit=async()=>{throw new Error('edit must not open');};
 vm.runInContext(html.slice(a,b),f.context);
 const gate=deferred(),locked=f.window.AUSTA_LISTING_MEDIA.withLifecycle(f.table,'listing',()=>gate.promise);
 await tick();await f.context.austaMyEdit(f.item);assert.equal(alerts.length,2);assert.match(alerts[1],/statusu dəyişdirilir/);gate.resolve();await locked;
});

for(const [type,status] of [['cars','rented'],['rent','sold'],['parts','rented'],['service','sold'],['usta','rented'],['dealer','sold'],['dealer','rented']])test(type+' incompatible persisted '+status+' cannot reactivate',async()=>{
 const f=fixture(type,status);await assert.rejects(f.transition('reactivate'));assert.equal(f.writes().length,0);
});
