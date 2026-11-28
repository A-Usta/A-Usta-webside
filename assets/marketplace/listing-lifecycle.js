/* P1.5A: owner listing lifecycle. RLS is authoritative for ownership, not transitions. */
(function(){
'use strict';
const sources=Object.freeze({
  vehicle:{table:'vehicle_listings',field:'listing_type',types:['sale','rent']},
  marketplace:{table:'marketplace_listings',field:'category',types:['parts','accessories','special','moto','plate','bus','water','caravan','trailer']},
  service_provider:{table:'service_provider_listings',field:'provider_type',types:['service','usta','leasing','insurance','sober_driver']},
  auto_dealer:{table:'auto_dealer_listings',types:['dealer']}
});
const aliases=Object.freeze({provider:'service_provider',dealer:'auto_dealer'});
const labels=Object.freeze({active:'Aktiv',inactive:'Aktiv deyil',draft:'Qaralama',sold:'Satılıb',rented:'İcarəyə verilib',expired:'Vaxtı bitib',archived:'Arxivdə'});
const statusFilters=Object.freeze([['all','Bütün elanlar'],['active','Aktiv'],['vip','VIP'],['premium','Premium'],['expired','Vaxtı bitmiş'],['draft','Qaralamalar'],['inactive','Deaktiv']]);
const actionLabels=Object.freeze({mark_sold:'Satılıb kimi işarələ',mark_rented:'İcarəyə verilib',archive:'Arxivlə',reactivate:'Yenidən aktiv et'});
const categoryLabels=Object.freeze({leasing:'Lizinq şirkəti',insurance:'Avtomobil sığortası',sober_driver:'Ayıq sürücü',parts:'Ehtiyat hissələri',accessories:'Aksesuarlar',special:'Xüsusi texnika',moto:'Moto / Moped / Skuter',plate:'Qeydiyyat nömrəsi',bus:'Avtobus',water:'Su nəqliyyatı',caravan:'Karavan',trailer:'Qoşqu / Treyler'});
const own=(object,key)=>typeof key==='string'&&Object.prototype.hasOwnProperty.call(object,key);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const failure=(message,code='LIFECYCLE_REJECTED')=>Object.assign(new Error(message),{code});
let client=null,subscription=null,epoch=0,loadRevision=0,mountRevision=0;
const hosts=new Map(),flights=new Map();
let view={kind:'idle',items:[],failed:[],message:''},statusFilter='all';
if(typeof document!=='undefined'&&document.createElement&&document.head?.appendChild&&!document.getElementById('austa-my-status-filter-style')){const style=document.createElement('style');style.id='austa-my-status-filter-style';style.textContent='.austa-my-status-filters{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.austa-my-status-filters button{border:1px solid #245c7e;background:#092239;color:#d7e2eb;border-radius:999px;padding:6px 9px;font-size:10px;cursor:pointer}.austa-my-status-filters button[aria-pressed="true"]{border-color:#e21e48;background:#35101c;color:#fff}';document.head.appendChild(style);}
function ref(item){
  const raw=item?.__austa_source,source=own(aliases,raw)?aliases[raw]:raw;
  if(!own(sources,source)||typeof item?.id!=='string'||!item.id)throw failure('Elan mənbəyi müəyyən edilmədi.');
  return {source,config:sources[source],id:item.id};
}
function subtype(source,row){
  const config=sources[source];
  let type=config.field?row[config.field]:'dealer';
  // V3.7 listings persist on the established provider table/type; the subtype
  // lives in the allowlisted details JSON and must be validated explicitly.
  if(source==='service_provider'&&type==='service'&&
    ['leasing','insurance','sober_driver'].includes(row.details?.service_category)){
    type=row.details.service_category;
  }
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
  const label=source==='vehicle'?(type==='rent'?'Avtomobil icarəsi':'Avtomobil satışı'):source==='marketplace'?(categoryLabels[type]||'Elan'):source==='service_provider'?({leasing:'Lizinq şirkəti',insurance:'Avtomobil sığortası',sober_driver:'Ayıq sürücü',usta:'Usta',service:'Avtoservis'}[type]||'Xidmət şirkəti'):'Avtosalon';
  const title=source==='vehicle'?[row.brand,row.model,row.year].filter(Boolean).join(' '):source==='auto_dealer'?row.dealer_name:row.details?.company_name||row.title||row.name||row.specialty;
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
  const filtered=items.filter(item=>{const promoActive=item.promotion_until&&Date.parse(item.promotion_until)>Date.now()&&(!item.promotion_started_at||Date.parse(item.promotion_started_at)<=Date.now());if(statusFilter==='vip'||statusFilter==='premium')return item.promotion_type===statusFilter&&promoActive;if(statusFilter==='inactive')return ['inactive','archived','sold','rented'].includes(item.status);return statusFilter==='all'||item.status===statusFilter;});
  const filters='<div class="austa-my-status-filters" role="group" aria-label="Elan statusu">'+statusFilters.map(([key,label])=>'<button type="button" data-austa-my-filter="'+key+'" aria-pressed="'+(statusFilter===key)+'">'+label+'</button>').join('')+'</div>';
  if(!filtered.length)return filters+note+warning+retry+(items.length?'<p>Bu statusda elan yoxdur.</p>':state.failed?.length||state.kind==='error'?'':'<p>Hələ elanınız yoxdur.</p>');
  return filters+note+warning+retry+filtered.map(item=>{
    const button=(attribute,text)=>'<button type="button" '+attribute+'>'+esc(text)+'</button>';
    const expiry=item.expires_at?'<p>Bitmə tarixi: '+esc(new Date(item.expires_at).toLocaleDateString('az-AZ'))+'</p>':'';
    return '<article class="austa-listing-card austa-p15-listing" data-austa-my-id="'+esc(item.id)+'" data-austa-my-table="'+esc(item.__austa_table)+'">'+
      '<div><b>'+esc(item.__austa_title)+'</b><p>'+esc(item.__austa_label)+' · '+esc([item.region,item.district].filter(Boolean).join(' / '))+'</p>'+
      (item.__austa_price?'<strong>'+esc(item.__austa_price)+'</strong>':'')+'<p><strong class="austa-p15-status">'+esc(statusLabel(item.status))+'</strong></p>'+expiry+'</div>'+
      '<div class="austa-p15-actions"><div class="austa-listing-actions" role="group" aria-label="Elana baxış və redaktə">'+button('data-austa-my-view','Bax')+button('data-austa-my-edit','Düzəlt')+'</div>'+
      (item.status==='expired'?'<div class="austa-listing-actions" role="group" aria-label="Vaxtı bitmiş elan">'+button('data-austa-my-renew','30 gün yenilə')+'</div>':'')+
      '<div class="austa-listing-actions" role="group" aria-label="Elanın vəziyyəti">'+actions(item).map(action=>button('data-austa-my-transition="'+action+'"',actionLabels[action])).join('')+'</div>'+
      (item.status==='active'&&actions(item).length?'<div class="austa-listing-actions" role="group" aria-label="Elanı tanıt">'+button('data-austa-my-boost','İrəli çək')+button('data-austa-my-vip','VIP')+button('data-austa-my-premium','Premium')+'</div>':'')+
      '<div class="austa-listing-actions" role="group" aria-label="Elanı sil">'+button('data-austa-my-delete','Sil')+'</div></div></article>';
  }).join('');
}
async function renew(item){
  const {source}=ref(item);bindAuth();const context={client,epoch,mount:mountRevision,hosts:[...hosts.values()].filter(mounted)};
  if(!window.crypto?.randomUUID)throw failure('Bu brauzerdə təhlükəsiz yeniləmə sorğusu dəstəklənmir.');
  await auth(context);if(item.status!=='expired')throw failure('Yalnız vaxtı bitmiş elan yenilənə bilər.');
  const result=await context.client.rpc('austa_renew_listing',{p_source:source,p_listing_id:item.id,p_request_id:window.crypto.randomUUID()});
  if(!current(context))throw failure('Hesab dəyişib.','LIFECYCLE_STALE');
  if(result.error)throw result.error;const row=Array.isArray(result.data)?result.data[0]:result.data;
  if(row?.listing_id!==item.id||row?.status!=='active'||!row?.expires_at)throw failure('Server elan yenilənməsini təsdiqləmədi.');
  await load();return row;
}
document.addEventListener('click',event=>{
  const filter=event.target?.closest?.('[data-austa-my-filter]');if(filter){statusFilter=filter.dataset.austaMyFilter;paint();return;}
  const button=event.target?.closest?.('[data-austa-my-renew]');if(!button)return;
  const card=button.closest('[data-austa-my-id]'),item=(window.AUSTA_MY_REAL_LISTINGS||[]).find(row=>String(row.id)===String(card?.dataset.austaMyId)&&row.__austa_table===card?.dataset.austaMyTable);
  if(!item)return;button.disabled=true;void renew(item).catch(error=>{if(current({client,epoch,mount:mountRevision})){view.message=error?.message||'Elanı yeniləmək mümkün olmadı.';paint();}}).finally(()=>{if(button.isConnected)button.disabled=false;});
});
function mounted(host){return host&&host.isConnected!==false&&(!host.id||document.getElementById(host.id)===host);}
function paint(){for(const [id,host] of hosts){if(!mounted(host)){hosts.delete(id);continue;}host.innerHTML=render();}}
function mount(host){
  if(!host||!mounted(host))return false;
  if(hosts.get(host.id)!==host){hosts.set(host.id,host);mountRevision++;}
  return true;
}
function invalidate(){epoch++;loadRevision++;statusFilter='all';window.AUSTA_MY_REAL_LISTINGS=[];view={kind:'signedout',items:[],failed:[],message:''};paint();}
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
window.AUSTA_MY_LIFECYCLE=Object.freeze({load,mount,render,actions,statusLabel,transition,authorizePromotion,bindAuth,renew,
  state:()=>({kind:view.kind,failed:[...view.failed],message:view.message})});
})();
