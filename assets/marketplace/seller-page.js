/* V169F.2D — public verified dealer view; registry identity and explicit listing links only. */
(function(){
'use strict';
const BATCH_SIZE=40;
const fields='id,listing_type,status,seller_profile_id,brand,model,year,mileage,engine,engine_volume,horsepower,fuel_type,price,region,district,vin,barter_available,credit_available,promotion_type,promotion_started_at,promotion_until,published_at,created_at';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current=null,session=0;
const active=state=>current===state&&state.session===session&&state.root.isConnected;
function close(){
  const state=current;if(!state)return;
  current=null;++session;state.controller?.abort();state.subscription?.unsubscribe();state.observer?.disconnect();state.root.remove();
  if(!document.getElementById('austaFinalListingPage'))document.body.style.overflow=state.overflow;
  if(state.returnFocus?.isConnected)state.returnFocus.focus({preventScroll:true});
}
function status(state,text,retry=false){
  state.message.textContent=text;
  state.retry.hidden=!retry;
}
function controls(state){
  state.more.hidden=!state.profile||!state.hasMore;
  state.more.disabled=state.loading;
  state.more.textContent=state.loading?'Yüklənir...':'Daha çox elan göstər';
}
async function loadBatch(state){
  if(!active(state)||!state.profile||state.loading||!state.hasMore)return;
  state.loading=true;status(state,'Elanlar yüklənir...');controls(state);
  const controller=new AbortController();state.controller=controller;
  try{
    const sb=window.AUSTA_SUPABASE,api=window.AUSTA_V151_MARKETPLACE;
    if(!sb?.from||!api?.hydrateVehicleCardMedia||!api?.vehicleCardHtml)throw new Error('Elanlar hazırda yüklənmir.');
    let query=sb.from('vehicle_listings').select(fields)
      .eq('status','active').eq('listing_type','sale').eq('seller_profile_id',state.id)
      .order('created_at',{ascending:false}).order('id',{ascending:false})
      .range(state.offset,state.offset+BATCH_SIZE);
    if(typeof query.abortSignal==='function')query=query.abortSignal(controller.signal);
    const {data,error}=await query;
    if(!active(state)||controller.signal.aborted)return;
    if(error)throw error;
    if(!Array.isArray(data))throw new Error('Elan məlumatının formatı düzgün deyil.');
    const consumed=data.slice(0,BATCH_SIZE);
    const eligible=consumed.filter(item=>item?.id&&item.status==='active'&&item.listing_type==='sale'&&item.seller_profile_id===state.id&&!state.seen.has(item.id));
    await api.hydrateVehicleCardMedia(eligible);
    if(!active(state)||controller.signal.aborted)return;
    const markup=eligible.map(item=>api.vehicleCardHtml(item)).join('');
    state.grid.insertAdjacentHTML('beforeend',markup);
    eligible.forEach(item=>state.seen.add(item.id));
    state.offset+=consumed.length;state.hasMore=data.length>BATCH_SIZE;
    status(state,state.seen.size?'':state.hasMore?'':'Bu avtosalonun aktiv avtomobil satışı elanı yoxdur.');
  }catch(error){
    if(active(state)&&!controller.signal.aborted){console.warn('A-USTA seller listings:',error?.message);status(state,'Elanlar yüklənmədi. Yenidən cəhd edin.',true);}
  }finally{if(active(state)){state.loading=false;controls(state);}}
}
async function resolve(state){
  if(!active(state)||state.resolving)return;
  state.resolving=true;
  status(state,'Avtosalon yüklənir...');state.retry.hidden=true;
  try{
    const api=window.AUSTA_SELLER_IDENTITY;
    if(!api?.resolveFresh)throw new Error('Satıcı məlumatı hazır deyil.');
    const profile=await api.resolveFresh(state.id);
    if(!active(state))return;
    if(!profile||profile.id!==state.id||profile.status!=='active'||profile.verification_status!=='verified'||profile.business_type!=='dealer'){
      status(state,'Avtosalon mövcud deyil');return;
    }
    state.profile=profile;
    state.header.innerHTML=`<h1 id="austaSellerPageTitle">${esc(profile.display_name||'Avtosalon')}</h1><div class="austa-seller-page-meta"><span>Avtosalon</span>${api.isOfficial(profile)===true?'<span class="austa-seller-page-official">Rəsmi</span>':''}${profile.country_code?`<span>${esc(profile.country_code)}</span>`:''}</div>`;
    await loadBatch(state);
  }catch(error){if(active(state)){console.warn('A-USTA seller page:',error?.message);status(state,'Avtosalon məlumatı yüklənmədi. Yenidən cəhd edin.',true);}}
  finally{state.resolving=false;}
}
async function open(id){
  close();
  if(typeof id!=='string'||!id)return;
  const root=document.createElement('section');root.id='austaSellerPage';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','austaSellerPageTitle');root.tabIndex=-1;
  root.innerHTML='<div class="austa-seller-page-inner"><button type="button" class="austa-seller-page-back" data-seller-close>← Geri</button><header data-seller-header><h1 id="austaSellerPageTitle">Avtosalon</h1></header><div data-seller-status role="status" aria-live="polite"></div><button type="button" data-seller-retry hidden>Yenidən cəhd et</button><div class="austa-seller-page-grid" data-seller-grid></div><button type="button" data-seller-more hidden>Daha çox elan göstər</button></div>';
  const state={root,id,session:++session,profile:null,offset:0,hasMore:true,loading:false,seen:new Set(),returnFocus:document.activeElement,overflow:document.body.style.overflow};
  state.header=root.querySelector('[data-seller-header]');state.message=root.querySelector('[data-seller-status]');state.grid=root.querySelector('[data-seller-grid]');state.retry=root.querySelector('[data-seller-retry]');state.more=root.querySelector('[data-seller-more]');current=state;
  root.querySelector('[data-seller-close]').addEventListener('click',close);
  state.more.addEventListener('click',()=>void loadBatch(state));
  state.retry.addEventListener('click',()=>{if(!state.loading)void(state.profile?loadBatch(state):resolve(state));});
  root.addEventListener('keydown',event=>{
    if(document.getElementById('austaFinalListingPage'))return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    if(event.key==='Tab'){
      const buttons=[...root.querySelectorAll('button:not([disabled]),a[href]')].filter(node=>node.getClientRects().length);
      const first=buttons[0],last=buttons.at(-1);
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===root)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  document.body.appendChild(root);document.body.style.overflow='hidden';root.focus({preventScroll:true});
  // Existing listing detail sits above this view. Restore its scroll lock after detail closes.
  state.observer=new MutationObserver(()=>{
    if(!active(state))return;
    const detailOpen=Boolean(document.getElementById('austaFinalListingPage'));
    if(!detailOpen){document.body.style.overflow='hidden';if(state.detailOpen)root.focus({preventScroll:true});}
    state.detailOpen=detailOpen;
  });
  state.observer.observe(document.body,{childList:true});
  const auth=window.AUSTA_SUPABASE?.auth;let authUser;
  try{if(auth?.onAuthStateChange){state.subscription=auth.onAuthStateChange((_event,value)=>{const next=value?.user?.id||null;if(authUser!==undefined&&authUser!==next&&active(state))close();authUser=next;})?.data?.subscription;}}
  catch(error){console.warn('A-USTA seller session:',error?.message);}
  await resolve(state);
}
document.addEventListener('click',event=>{
  const control=event.target.closest?.('button[data-austa-seller-page]');if(!control)return;
  event.preventDefault();event.stopPropagation();void open(control.dataset.austaSellerPage);
});
window.AUSTA_SELLER_PAGE=Object.freeze({open,close});
})();
