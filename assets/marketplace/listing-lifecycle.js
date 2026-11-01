/* P1.5A: owner listing lifecycle. RLS is authoritative for ownership, not transitions. */
(function(){
'use strict';
const sources=Object.freeze({
  vehicle:{table:'vehicle_listings',field:'listing_type',types:['sale','rent']},
  marketplace:{table:'marketplace_listings',field:'category',types:['parts','accessories','special','moto','plate','bus','water','caravan','trailer']},
  service_provider:{table:'service_provider_listings',field:'provider_type',types:['service','usta']},
  auto_dealer:{table:'auto_dealer_listings',types:['dealer']}
});
const aliases=Object.freeze({provider:'service_provider',dealer:'auto_dealer'});
const labels=Object.freeze({active:'Aktiv',inactive:'Aktiv deyil',draft:'Qaralama',sold:'Satılıb',rented:'İcarəyə verilib',archived:'Arxivdə'});
const actionLabels=Object.freeze({mark_sold:'Satılıb kimi işarələ',mark_rented:'İcarəyə verilib',archive:'Arxivlə',reactivate:'Yenidən aktiv et'});
const categoryLabels=Object.freeze({parts:'Ehtiyat hissələri',accessories:'Aksesuarlar',special:'Xüsusi texnika',moto:'Moto / Moped / Skuter',plate:'Qeydiyyat nömrəsi',bus:'Avtobus',water:'Su nəqliyyatı',caravan:'Karavan',trailer:'Qoşqu / Treyler'});
const own=(object,key)=>typeof key==='string'&&Object.prototype.hasOwnProperty.call(object,key);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const failure=(message,code='LIFECYCLE_REJECTED')=>Object.assign(new Error(message),{code});
let client=null,subscription=null,epoch=0,loadRevision=0,mountRevision=0;
const hosts=new Map(),flights=new Map();
let view={kind:'idle',items:[],failed:[],message:''};
function ref(item){
  const raw=item?.__austa_source,source=own(aliases,raw)?aliases[raw]:raw;
  if(!own(sources,source)||typeof item?.id!=='string'||!item.id)throw failure('Elan mənbəyi müəyyən edilmədi.');
  return {source,config:sources[source],id:item.id};
}
function subtype(source,row){
  const config=sources[source],type=config.field?row[config.field]:'dealer';
  if(!config.types.includes(type))throw failure('Elanın kateqoriyası uyğun deyil.');
  return type;
}
function target(source,row,action){
  const type=subtype(source,row),status=row.status;
  if(!own(actionLabels,action))throw failure('Bu status əməliyyatına icazə verilmir.');
  if(status==='active'){
    if(action==='archive')return 'archived';
    if(action==='mark_sold'&&(source==='marketplace'||source==='vehicle'&&type==='sale'))return 'sold';
    if(action==='mark_rented'&&source==='vehicle'&&type==='rent')return 'rented';
  }
  if(action==='reactivate'&&(status==='archived'||status==='sold'&&(source==='marketplace'||source==='vehicle'&&type==='sale')||status==='rented'&&source==='vehicle'&&type==='rent'))return 'active';
  throw failure('Elanın hazırkı statusunda bu əməliyyat mümkün deyil.');
}
function actions(item){
  try{const {source}=ref(item);return Object.keys(actionLabels).filter(action=>{try{target(source,item,action);return true;}catch{return false;}});}catch{return [];}
}
function statusLabel(status){return own(labels,status)?labels[status]:'Status əlçatan deyil';}
function decorate(source,row){
  let type;try{type=subtype(source,row);}catch{type='';}
  const label=source==='vehicle'?(type==='rent'?'Avtomobil icarəsi':'Avtomobil satışı'):source==='marketplace'?(categoryLabels[type]||'Elan'):source==='service_provider'?(type==='usta'?'Usta':'Avtoservis'):'Avtosalon';
  const title=source==='vehicle'?[row.brand,row.model,row.year].filter(Boolean).join(' '):source==='auto_dealer'?row.dealer_name:row.title||row.name||row.specialty;
  const amount=source==='vehicle'&&type==='rent'?row.daily_price:row.price;
  return {...row,__austa_source:source,__austa_table:sources[source].table,__austa_label:label,
    __austa_title:title||label,__austa_price:amount==null?'':amount+' '+(row.currency||'AZN')+(source==='vehicle'&&type==='rent'?' / gün':'')};
}
function render(items=view.items,state=view){
  const note=state.message?'<p role="alert">'+esc(state.message)+'</p>':'';
  if(state.kind==='loading')return '<p role="status">Elanlar yüklənir...</p>';
  if(state.kind==='signedout')return '<p>Elanlarınızı görmək üçün hesabınıza daxil olun.</p>';
  const warning=state.failed?.length?'<p role="alert">Bəzi elanlar yüklənmədi: '+esc(state.failed.join(', '))+'. Yenidən cəhd edin.</p>':'';
  const retry=state.failed?.length||state.kind==='error'?'<button type="button" data-austa-my-retry>Yenidən yüklə</button>':'';
  if(!items.length)return note+warning+retry+(state.failed?.length||state.kind==='error'?'':'<p>Hələ elanınız yoxdur.</p>');
  return note+warning+retry+items.map(item=>{
    const button=(attribute,text)=>'<button type="button" '+attribute+'>'+esc(text)+'</button>';
    return '<article class="austa-listing-card austa-p15-listing" data-austa-my-id="'+esc(item.id)+'" data-austa-my-table="'+esc(item.__austa_table)+'">'+
      '<div><b>'+esc(item.__austa_title)+'</b><p>'+esc(item.__austa_label)+' · '+esc([item.region,item.district].filter(Boolean).join(' / '))+'</p>'+
      (item.__austa_price?'<strong>'+esc(item.__austa_price)+'</strong>':'')+'<p><strong class="austa-p15-status">'+esc(statusLabel(item.status))+'</strong></p></div>'+
      '<div class="austa-p15-actions"><div class="austa-listing-actions" role="group" aria-label="Elana baxış və redaktə">'+button('data-austa-my-view','Bax')+button('data-austa-my-edit','Düzəlt')+'</div>'+
      '<div class="austa-listing-actions" role="group" aria-label="Elanın vəziyyəti">'+actions(item).map(action=>button('data-austa-my-transition="'+action+'"',actionLabels[action])).join('')+'</div>'+
      (item.status==='active'&&actions(item).length?'<div class="austa-listing-actions" role="group" aria-label="Elanı tanıt">'+button('data-austa-my-boost','İrəli çək')+button('data-austa-my-vip','VIP')+button('data-austa-my-premium','Premium')+'</div>':'')+
      '<div class="austa-listing-actions" role="group" aria-label="Elanı sil">'+button('data-austa-my-delete','Sil')+'</div></div></article>';
  }).join('');
}
function mounted(host){return host&&host.isConnected!==false&&(!host.id||document.getElementById(host.id)===host);}
function paint(){for(const [id,host] of hosts){if(!mounted(host)){hosts.delete(id);continue;}host.innerHTML=render();}}
function mount(host){
  if(!host||!mounted(host))return false;
  if(hosts.get(host.id)!==host){hosts.set(host.id,host);mountRevision++;}
  return true;
}
function invalidate(){epoch++;loadRevision++;window.AUSTA_MY_REAL_LISTINGS=[];view={kind:'signedout',items:[],failed:[],message:''};paint();}
function bindAuth(){
  const next=window.AUSTA_SUPABASE;
  if(next===client)return;
  subscription?.unsubscribe?.();client=next;invalidate();
  const observed=client;
  subscription=client?.auth?.onAuthStateChange?.(()=>{
    if(client!==observed||window.AUSTA_SUPABASE!==observed)return;
    invalidate();setTimeout(()=>{if(client===observed&&window.AUSTA_SUPABASE===observed)void load();},0);
  })?.data?.subscription;
}
function current(context){return context.client===window.AUSTA_SUPABASE&&context.epoch===epoch&&context.mount===mountRevision&&(!context.host||mounted(context.host))&&(!context.hosts||context.hosts.every(mounted));}
async function auth(context){
  if(!current(context))throw failure('Hesab və ya elan pəncərəsi dəyişib.','LIFECYCLE_STALE');
  const {data,error}=await context.client.auth.getUser();
  if(!current(context))throw failure('Hesabı yenidən yoxlayın.','LIFECYCLE_STALE');
  if(error||!data?.user?.id||context.user&&context.user.id!==data.user.id){invalidate();throw failure('Hesabı yenidən yoxlayın.','LIFECYCLE_STALE');}
  context.user=data.user;return data.user;
}
async function load(host){
  bindAuth();if(host&&!mount(host))return;
  const context={client,epoch,mount:mountRevision,host},revision=++loadRevision;
  const live=()=>current(context)&&revision===loadRevision;
  if(!client?.auth)return;
  view={kind:'loading',items:[],failed:[],message:''};paint();
  try{
    const result=await client.auth.getUser();if(!live())return;
    if(result.error)throw result.error;
    if(!result.data?.user){window.AUSTA_MY_REAL_LISTINGS=[];view={kind:'signedout',items:[],failed:[],message:''};paint();return;}
    context.user=result.data.user;
    const results=await Promise.all(Object.entries(sources).map(async([source,config])=>{
      try{
        const rows=[];
        for(let offset=0;;){
          const {data,error}=await context.client.from(config.table).select('*').eq('owner_id',context.user.id)
            .order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999);
          if(error||!Array.isArray(data)||data.some(row=>row.owner_id!==context.user.id))throw failure('load');
          rows.push(...data);if(!data.length)break;offset+=data.length;
        }
        return {items:rows.map(row=>decorate(source,row))};
      }catch{return {failed:{vehicle:'Avtomobil / İcarə',marketplace:'Marketplace',service_provider:'Servis / Usta',auto_dealer:'Avtosalon'}[source]};}
    }));
    if(!live())return;
    await auth(context);if(!live())return;
    const items=results.flatMap(result=>result.items||[]).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
    window.AUSTA_MY_REAL_LISTINGS=items;view={kind:'ready',items,failed:results.flatMap(result=>result.failed?[result.failed]:[]),message:''};paint();
  }catch{if(live()){window.AUSTA_MY_REAL_LISTINGS=[];view={kind:'error',items:[],failed:[],message:'Elanları yükləmək mümkün olmadı. Yenidən cəhd edin.'};paint();}}
}
async function parent(context,reference){
  await auth(context);
  const {data,error}=await context.client.from(reference.config.table).select('*').eq('id',reference.id).eq('owner_id',context.user.id).maybeSingle();
  if(!current(context))throw failure('Hesab dəyişib.','LIFECYCLE_STALE');
  if(error||!data||data.id!==reference.id||data.owner_id!==context.user.id)throw failure('Elan tapılmadı və ya sahibliyi təsdiqlənmədi.','LIFECYCLE_CONFLICT');
  subtype(reference.source,data);return data;
}
function transition(item,action){
  let reference;try{reference=ref(item);}catch(error){return Promise.reject(error);}
  const key=reference.source+':'+reference.id;
  if(flights.has(key))return flights.get(key);
  bindAuth();const context={client,epoch,mount:mountRevision,hosts:[...hosts.values()].filter(mounted)};
  const work=Promise.resolve().then(async()=>{
    if(!window.AUSTA_LISTING_MEDIA?.withLifecycle)throw failure('Elan əməliyyatları sistemi hazır deyil.');
    return window.AUSTA_LISTING_MEDIA.withLifecycle(reference.config.table,reference.id,async()=>{
      const row=await parent(context,reference),next=target(reference.source,row,action);
      if(!window.confirm(actionLabels[action]+' — davam etmək istəyirsiniz?'))return null;
      await auth(context);
      let query=context.client.from(reference.config.table).update({status:next,updated_at:new Date().toISOString()})
        .eq('id',reference.id).eq('owner_id',context.user.id).eq('status',row.status);
      if(reference.config.field)query=query.eq(reference.config.field,row[reference.config.field]);
      const {data,error}=await query.select('*');
      if(!current(context))throw failure('Hesab dəyişib.','LIFECYCLE_STALE');
      if(error||!Array.isArray(data)||data.length!==1||data[0].id!==reference.id||data[0].owner_id!==context.user.id||data[0].status!==next)throw failure('Elan dəyişib və ya əməliyyat təsdiqlənmədi. Yenidən yoxlayın.','LIFECYCLE_CONFLICT');
      const persisted=await parent(context,reference);
      if(persisted.status!==next||reference.config.field&&persisted[reference.config.field]!==row[reference.config.field])throw failure('Elanın yeni statusu təsdiqlənmədi.','LIFECYCLE_CONFLICT');
      if(current(context))await load();
      if(!current(context))throw failure('Hesab və ya elan pəncərəsi dəyişib.','LIFECYCLE_STALE');
      return persisted;
    });
  }).catch(async error=>{
    if(!current(context)){error.silent=true;throw error;}
    // Failure/zero-row writes reconcile persisted state; never fabricate success.
    try{await parent(context,reference);}catch{}
    if(current(context))await load();
    if(current(context)){view.message=error.message;paint();}else error.silent=true;
    throw error;
  }).finally(()=>flights.delete(key));
  flights.set(key,work);return work;
}
async function authorizePromotion(item){
  const reference=ref(item);bindAuth();const context={client,epoch,mount:mountRevision,hosts:[...hosts.values()].filter(mounted)};
  const row=await parent(context,reference);await auth(context);
  if(row.status!=='active')throw failure('Tanıtım yalnız aktiv elan üçün mümkündür.');
  return decorate(reference.source,row);
}
window.AUSTA_MY_LIFECYCLE=Object.freeze({load,mount,render,actions,statusLabel,transition,authorizePromotion,bindAuth,
  state:()=>({kind:view.kind,failed:[...view.failed],message:view.message})});
})();
