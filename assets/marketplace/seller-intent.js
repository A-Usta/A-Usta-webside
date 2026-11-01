/* P1.2B: owned RPC discovery and explicit seller intent, separate from form data. */
(function(){
'use strict';
const labels=Object.freeze({dealer:'Avtosalon',store:'Mağaza',service:'Servis',usta:'Usta'});
const business=Object.freeze({cars:'dealer',rent:'dealer',parts:'store',accessories:'store',
  special:'store',moto:'store',plate:'store',bus:'store',trailer:'store',water:'store',caravan:'store',
  service:'service',usta:'usta',dealer:'dealer'});
const fields=['id','business_type','display_name','status','verification_status','official_status','official_scope'];
const roots=new WeakMap(),tokens=new WeakMap(),live=new Set();
let client=null,subscription=null,epoch=0,authKey=null,cache=null,pending=null;
const error=()=>new Error('Satıcı profili təsdiqlənmədi. Seçimi yoxlayıb yenidən cəhd edin.');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eligible=p=>p&&typeof p.id==='string'&&p.id.length>0&&typeof p.display_name==='string'&&
  p.status==='active'&&p.verification_status==='verified'&&Object.hasOwn(labels,p.business_type);
function invalidate(){
  epoch++;cache=null;pending=null;
  for(const state of live){
    state.blocked=Boolean(state.selected || state.changed);state.selected=null;state.profiles=[];
    state.owner=null;state.version=epoch;
    render(state,'Hesab dəyişib. Satıcı seçimini yenidən təsdiqləyin.');
  }
}
function sb(){
  const next=window.AUSTA_SUPABASE;
  if(next!==client){subscription?.unsubscribe();client=next;authKey=null;invalidate();
    const result=client?.auth?.onAuthStateChange?.((_event,session)=>{
      if(client!==next)return;
      const key=(session?.user?.id||'')+':'+(session?.access_token||'');
      if((authKey!==null&&key!==authKey)||[...live].some(s=>s.owner&&s.owner!==(session?.user?.id||null)))invalidate();authKey=key;
    });subscription=result?.data?.subscription||null;
  }
  return client;
}
async function actor(){
  const connection=sb(),version=epoch;
  const result=await connection?.auth?.getUser();
  const id=result?.data?.user?.id;
  const session=await connection?.auth?.getSession?.();
  if(session?.error)throw error();
  if(connection!==client||version!==epoch)throw error();
  const key=(id||'')+':'+(session?.data?.session?.access_token||'');
  if(authKey!==null&&authKey!==key)invalidate();authKey=key;
  if(!id||result.error||connection!==client||version!==epoch)throw error();
  return {id,version,connection};
}
function same(a,b){return a.id===b.id&&a.version===b.version&&a.connection===b.connection;}
async function discover(fresh=false){
  const who=await actor();
  if(!fresh&&cache&&same(cache.who,who)&&cache.until>Date.now())return cache;
  if(!fresh&&pending&&same(pending.who,who))return pending.promise;
  const promise=(async()=>{
    const result=await who.connection.rpc('get_my_seller_profiles');
    if(result.error||!Array.isArray(result.data)||!same(who,await actor()))throw error();
    const profiles=result.data.filter(eligible).map(p=>Object.freeze(Object.fromEntries(fields.map(k=>[k,p[k]??null]))));
    const value={who,profiles,until:Date.now()+60000};cache=value;return value;
  })();
  if(!fresh)pending={who,promise};
  try{return await promise;}finally{if(pending?.promise===promise)pending=null;}
}
function currentState(state,version,revision){
  return epoch===version&&roots.get(state.root)===state&&state.revision===revision&&state.root.isConnected!==false;
}
function render(state,message=''){
  const current=state.existing?.seller_profile_id;
  const unavailable=current&&!state.profiles.some(p=>p.id===current);
  const value=state.blocked?'__blocked':state.changed?state.selected||'':current||'';
  state.box.innerHTML=`<label><strong>Satıcı profili</strong><select data-seller-choice aria-label="Satıcı profili">
    <option value="">Şəxsi elan — Elanı şəxsi profilimlə yerləşdir</option>
    ${state.blocked?'<option value="__blocked" disabled>Seçimi yenidən təsdiqləyin</option>':''}
    ${unavailable?`<option value="${esc(current)}" disabled>Mövcud peşəkar profil — hazırda seçim üçün əlçatan deyil</option>`:''}
    ${state.profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.display_name)} — ${labels[p.business_type]} · Təsdiqlənmiş${p.official_status==='approved'?' · Rəsmi':''}</option>`).join('')}
    </select></label><p role="status">${esc(message||(!state.profiles.length?'Bu elan növü üçün təsdiqlənmiş peşəkar profiliniz yoxdur.':'Təsdiqlənmiş biznes profilini seçə bilərsiniz.'))}</p>`;
  const select=state.box.querySelector('[data-seller-choice]');select.value=value;
  select.addEventListener('change',()=>{
    ++state.revision;state.changed=true;state.blocked=false;state.selected=select.value||null;
    // Rebinding after an auth switch requires a new current-user discovery.
    if(!state.owner){
      state.blocked=true;
      const version=epoch,revision=state.revision;
      void (async()=>{
        const who=await actor();
        if(!currentState(state,version,revision))return;
        await load(state);
        if(!currentState(state,version,revision))return;
        const now=await actor();
        // The outer completion has its own authority check, even when load retired.
        if(!same(who,now)||!currentState(state,version,revision))return;
        state.selected=null;state.changed=true;state.blocked=false;render(state);
      })().catch(()=>{});
    }
  });
}
async function load(state){
  const version=epoch,revision=state.revision;
  try{
    const data=await discover();
    if(!currentState(state,version,revision))return;
    state.owner=data.who.id;state.version=data.who.version;
    state.profiles=data.profiles.filter(p=>p.business_type===business[state.type]);render(state);
  }catch{
    if(currentState(state,version,revision))render(state,'Peşəkar profillər yüklənmədi. Şəxsi elan yerləşdirə və ya formanı yenidən aça bilərsiniz.');
  }
}
function mount(root,type,existing=null){
  if(!root||!Object.hasOwn(business,type))return;
  sb();for(const s of live)if(s.root.isConnected===false)live.delete(s);
  const old=roots.get(root);if(old){live.delete(old);old.box.remove();}
  const box=document.createElement('section');box.className='austa-v153c-field full';
  box.dataset.sellerIntent='true';root.appendChild(box);
  const state={root,type,existing,box,owner:null,version:epoch,profiles:[],selected:null,changed:false,blocked:false,revision:0};
  roots.set(root,state);live.add(state);render(state,'Peşəkar profillər yüklənir...');
  return load(state);
}
function capture(root){
  const state=roots.get(root);if(!state)return undefined;
  if(state.blocked)throw error();
  if(state.changed&&state.selected&&!state.profiles.some(p=>p.id===state.selected))throw error();
  const token=Object.freeze({});
  tokens.set(token,{type:state.type,id:state.existing?.id||null,update:Boolean(state.existing),
    owner:state.owner,version:state.version,changed:state.changed,selected:state.selected});
  return token;
}
async function resolve(type,user,token,update=false,id=null){
  if(!Object.hasOwn(business,type))throw error();
  const intent=token&&tokens.get(token);
  if(token&&!intent)throw error();
  const who=await actor();if(who.id!==user.id)throw error();
  if(intent&&(intent.type!==type||intent.update!==update||intent.id!==(id||null)||
      intent.version!==who.version||(intent.owner&&intent.owner!==who.id)))throw error();
  if(update&&(!intent||!intent.changed))return {};
  if(!intent?.selected)return {seller_profile_id:null};
  const refreshed=await discover(true);
  if(!same(who,refreshed.who)||!refreshed.profiles.some(p=>p.id===intent.selected&&p.business_type===business[type]))throw error();
  return {seller_profile_id:intent.selected};
}
function detail(item){
  const identity=window.AUSTA_SELLER_IDENTITY;
  const p=identity?.getForListing(item);
  if(!eligible(p))return '';
  return `<section class="austa-professional-seller" aria-label="Peşəkar satıcı"><strong>${esc(p.display_name)}</strong><div>${labels[p.business_type]} · Təsdiqlənmiş${p.official_status==='approved'?' · Rəsmi':''}</div></section>`;
}
window.AUSTA_SELLER_INTENT=Object.freeze({mount,capture,resolve,detail});
})();
