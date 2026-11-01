/* P1.6: fresh source-aware detail. Database RLS/Storage remain authoritative. */
(function(){
'use strict';
const sources=Object.freeze({
 vehicle:{table:'vehicle_listings',field:'listing_type',types:{sale:'cars',rent:'rent'},statuses:['draft','active','sold','rented','archived']},
 marketplace:{table:'marketplace_listings',field:'category',types:Object.fromEntries(['parts','accessories','special','moto','plate','bus','water','caravan','trailer'].map(x=>[x,x])),statuses:['draft','active','sold','inactive','archived']},
 service_provider:{table:'service_provider_listings',field:'provider_type',types:{service:'service',usta:'usta'},statuses:['draft','active','inactive','archived']},
 auto_dealer:{table:'auto_dealer_listings',statuses:['draft','active','inactive','archived']}
});
const own=(o,k)=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(o,k);
let hooks=null,client=null,subscription=null,authKey,authEpoch=0,revision=0,installation=0,active=null,linkSeen=null;
const stale=()=>Object.assign(new Error('Detail context changed'),{stale:true});
function reference(id,source='vehicle'){
 if(!own(sources,source)||typeof id!=='string'||!id.trim()||id.length>128)throw new Error('Unavailable');
 return {id,source,config:sources[source]};
}
const key=s=>s?.user?.id?s.user.id+':'+(s.access_token||''):'';
function stop(page){page?.querySelectorAll?.('video').forEach(video=>{try{video.pause();}catch{}});}
function dismiss(){
 const page=document.getElementById('austaFinalListingPage');stop(page);hooks?.close?.();page?.remove();
}
function close(event){
 event?.preventDefault?.();event?.stopPropagation?.();event?.stopImmediatePropagation?.();
 const focus=active?.focus;revision++;active=null;dismiss();
 if(document.body)document.body.style.overflow='';
 try{const url=new URL(location.href);url.searchParams.delete('listing');url.searchParams.delete('source');if(url.hash.startsWith('#listing='))url.hash='';history.replaceState(null,'',url.pathname+url.search+url.hash);}catch{}
 if(focus?.isConnected)focus.focus?.({preventScroll:true});
}
function bind(){
 const next=window.AUSTA_SUPABASE;if(client===next)return;
 subscription?.unsubscribe?.();client=next;authKey=undefined;authEpoch++;close();
 const observed=client;
 subscription=client?.auth?.onAuthStateChange?.((_event,session)=>{
  if(client!==observed||window.AUSTA_SUPABASE!==observed)return;
  const nextKey=key(session);
  if(authKey!==nextKey){authEpoch++;close();}
  authKey=nextKey;
 })?.data?.subscription;
}
function current(c){return c.revision===revision&&c.epoch===authEpoch&&c.installation===installation&&c.client===window.AUSTA_SUPABASE&&c.body===document.body&&document.getElementById('austaFinalListingPage')===(c.page||c.anchor||null)&&(!c.page||c.page.isConnected!==false);}
function check(c){if(!current(c))throw stale();}
async function actor(c){
 check(c);if(!c.client?.auth)throw new Error('Unavailable');
 const session=await c.client.auth.getSession();check(c);if(session.error)throw new Error('Unavailable');
 const value=session.data?.session;let user=null;
 if(value?.user?.id){const result=await c.client.auth.getUser();check(c);if(result.error||result.data?.user?.id!==value.user.id)throw new Error('Unavailable');user=result.data.user;}
 const nextKey=key(value);if(c.key!==undefined&&c.key!==nextKey){authEpoch++;close();throw stale();}
 c.key=nextKey;c.user=user;authKey=nextKey;
}
async function read(c){
 await actor(c);
 const {data,error}=await c.client.from(c.config.table).select('*').eq('id',c.id).maybeSingle();check(c);
 if(error||!data||String(data.id)!==c.id)return null;
 const type=c.config.field?c.config.types[data[c.config.field]]:'dealer';
 if(!type||c.config.field&&!own(c.config.types,data[c.config.field])||c.expected&&type!==c.expected)return null;
 const owner=Boolean(c.user&&data.owner_id===c.user.id);
 if(!c.config.statuses.includes(data.status)||data.status!=='active'&&!owner)return null;
 c.owner=owner;c.type=type;
 return {...data,category:type,__austa_table:c.config.table,__austa_source:c.source,_austaSupabase:true};
}
function mount(c,page){
 check(c);c.page=null;dismiss();check(c);document.body.appendChild(page);c.page=page;active=c;
 page.setAttribute('role','dialog');page.setAttribute('aria-modal','true');page.setAttribute('aria-label','Elan məlumatları');page.tabIndex=-1;
 page.addEventListener('keydown',event=>{if(event.key==='Escape')close(event);});
 document.body.style.overflow='hidden';page.focus?.({preventScroll:true});
 try{history.replaceState(null,'',url(c.id,c.source));linkSeen=location.href;}catch{}
}
function unavailable(c){
 check(c);const page=document.createElement('div');page.id='austaFinalListingPage';
 page.innerHTML='<div class="austa-p16-unavailable"><h1>Bu elan artıq əlçatan deyil.</h1><button type="button" data-detail-unavailable-close>Geri</button></div>';
 page.querySelector('[data-detail-unavailable-close]')?.addEventListener('click',close);mount(c,page);return false;
}
function context(ref){return {...ref,client,epoch:authEpoch,revision,installation,focus:document.activeElement,body:document.body,anchor:document.getElementById('austaFinalListingPage')};}
async function open(id,source='vehicle',expected){
 bind();const focus=active?.focus||document.activeElement;revision++;dismiss();
 let ref;try{ref=reference(id,source);}catch{ref={id:typeof id==='string'?id:'',source:'vehicle'};}
 const c={...context(ref),focus,expected};c.isCurrent=()=>current(c);c.mount=page=>mount(c,page);active=c;
 try{
  if(!ref.config||!hooks)throw new Error('Unavailable');
  let row=await read(c);if(!row)return unavailable(c);
  row=await hooks.hydrate(row);check(c);
  if(row.seller_profile_id&&window.AUSTA_SELLER_IDENTITY?.resolveFresh){await window.AUSTA_SELLER_IDENTITY.resolveFresh(row.seller_profile_id);check(c);}
  const fresh=await read(c);if(!fresh)return unavailable(c);
  // An attachment/subtype change during hydration requires a new explicit open.
  if(fresh.seller_profile_id!==row.seller_profile_id||fresh[c.config.field]!==row[c.config.field])return unavailable(c);
  await actor(c);check(c);
  const item={...row,...fresh,image_paths:row.image_paths,cover_image_path:row.cover_image_path,video_path:row.video_path,_austaMediaError:row._austaMediaError};
  c.item=item;await hooks.render(item,c);check(c);return true;
 }catch(error){if(!current(c)||error.stale)return false;return unavailable(c);}
}
async function lookup(id,source='vehicle'){
 bind();const c=context(reference(id,source)),row=await read(c);await actor(c);check(c);
 return row?{source:c.config.table,canonicalSource:c.source,listing:row}:null;
}
function url(id,source='vehicle'){
 reference(id,source);const value=new URL(location.href);value.searchParams.set('listing',id);value.searchParams.set('source',source);value.hash='';return value.href;
}
async function share(id,source,title){
 const href=url(id,source);try{if(navigator.share){await navigator.share({title,url:href});return;}}catch(error){if(error.name==='AbortError')return;}
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(href);return;}catch{}}
 window.prompt?.('Elan linkini kopyala:',href);
}
function management(item){return {...item,__austa_source:item.__austa_source,__austa_title:item.title||item.dealer_name||[item.brand,item.model].filter(Boolean).join(' ')};}
async function promote(id,source,type){
 if(!['boost','vip','premium'].includes(type))return;
 try{const found=await lookup(id,source);if(found)await window.AUSTA_PROMOTION_V157?.open(management(found.listing),type);}catch{}
}
function openLink(){
 if(!hooks||linkSeen===location.href)return;
 const value=new URL(location.href),fragment=new URLSearchParams(value.hash.replace(/^#/,''));
 const id=value.searchParams.get('listing')||fragment.get('listing');if(!id)return;
 linkSeen=location.href;return open(id,value.searchParams.get('source')||fragment.get('source')||'vehicle');
}
function install(value){hooks=value;installation++;}
window.AUSTA_LISTING_DETAIL=Object.freeze({install,open,lookup,close,url,share,promote,openLink});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',openLink,{once:true});else setTimeout(openLink,0);
window.addEventListener('hashchange',openLink);
})();
