/* V169F.1 — sale attributes and authenticated marketplace favorites. */
(function(){
'use strict';
const keys=['barter_available','credit_available'];
const snapshots=new WeakMap();
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function salePayload(type,input){
  const result={};
  if(type!=='cars')return result;
  keys.forEach(key=>{if(own(input,key)&&input[key]!==undefined){
    if(typeof input[key]!=='boolean')throw new Error('Barter/Kredit seçimi düzgün deyil.');
    result[key]=input[key];
  }});
  return result;
}
function mount(container){
  keys.forEach((key,i)=>{
    const label=document.createElement('label');label.className='austa-sale-toggle';
    const input=document.createElement('input');input.type='checkbox';input.dataset.saleAttribute=key;
    label.append(input,document.createTextNode(i?'Kredit mümkündür':'Barter mümkündür'));container.append(label);
    input.addEventListener('change',()=>{const snapshot=snapshots.get(container);if(snapshot)snapshot.dirty.add(key);});
  });
}
function remember(container,item){
  const raw={};keys.forEach(key=>{raw[key]=item[key];const input=container.querySelector(`[data-sale-attribute="${key}"]`);if(input)input.checked=item[key]===true;});
  snapshots.set(container,{raw,dirty:new Set()});
}
function read(container,editing){
  const result={},snapshot=snapshots.get(container);
  keys.forEach(key=>{const input=container.querySelector(`[data-sale-attribute="${key}"]`);
    if(input&&(!editing||snapshot?.dirty.has(key)))result[key]=input.checked===true;
  });return result;
}
const fk={vehicle:'vehicle_listing_id',marketplace:'marketplace_listing_id',service_provider:'service_provider_listing_id',auto_dealer:'auto_dealer_listing_id'};
function source(type){return ['cars','rent'].includes(type)?'vehicle':['service','usta','mechanic'].includes(type)?'service_provider':type==='dealer'?'auto_dealer':['parts','accessories','moto','special','bus','water','caravan','trailer','plate'].includes(type)?'marketplace':null;}
function attributes(type,item){return type==='cars'&&item?.listing_type==='sale'?`<div class="austa-sale-badges">${item.barter_available===true?'<span>Barter</span>':''}${item.credit_available===true?'<span>Kredit</span>':''}</div>`:'';}
function heart(type,item){const s=source(type);return s&&item?.id?`<button type="button" class="austa-favorite" data-favorite-source="${s}" data-favorite-id="${esc(item.id)}" aria-label="Elanı yadda saxla" aria-pressed="false" aria-busy="true" disabled>♡</button>`:'';}
let client=null,userId=null,generation=0,ready=false,initializing=null,timer=null,reading=false,queued=false;
const state=new Map(),locks=new Map(),revisions=new Map();
const keyOf=(s,id)=>s+':'+id;
const buttons=()=>[...document.querySelectorAll('button[data-favorite-source][data-favorite-id]')];
function paint(){buttons().forEach(b=>{
  const key=keyOf(b.dataset.favoriteSource,b.dataset.favoriteId),saved=state.get(key)===true;
  b.textContent=saved?'♥':'♡';b.setAttribute('aria-pressed',String(saved));b.setAttribute('aria-label',saved?'Yadda saxlanılanlardan çıxar':'Elanı yadda saxla');
  b.disabled=locks.has(key);b.setAttribute('aria-busy',String(!ready||locks.has(key)));
});}
function setUser(id){generation++;userId=id||null;state.clear();locks.clear();revisions.clear();ready=true;paint();schedule();}
async function session(){
  if(client)return initializing;
  const sb=window.AUSTA_SUPABASE;if(!sb?.auth)return;
  client=sb;const before=generation;
  client.auth.onAuthStateChange((_event,s)=>{if(!ready||userId!==(s?.user?.id||null))setUser(s?.user?.id);});
  initializing=(async()=>{try{const r=await client.auth.getSession();if(r.error)throw r.error;if(before===generation)setUser(r.data?.session?.user?.id);}catch(e){client=null;ready=false;paint();console.warn('A-USTA favorites session:',e.message);}})();
  return initializing;
}
function schedule(){clearTimeout(timer);timer=setTimeout(hydrate,20);}
async function hydrate(){
  await session();if(!ready||!client)return;
  if(reading){queued=true;return;}if(!userId){paint();return;}
  reading=true;const gen=generation,uid=userId;
  try{
    const groups=new Map();buttons().forEach(b=>{const s=b.dataset.favoriteSource,id=b.dataset.favoriteId,key=keyOf(s,id);if(fk[s]&&!state.has(key)&&!locks.has(key)){if(!groups.has(s))groups.set(s,new Set());groups.get(s).add(id);}});
    await Promise.all([...groups].map(async([s,set])=>{
      const ids=[...set],versions=new Map(ids.map(id=>[id,revisions.get(keyOf(s,id))||0]));
      const r=await client.from('listing_favorites').select('listing_id').eq('user_id',uid).eq('listing_source',s).in('listing_id',ids);
      if(r.error)throw r.error;if(gen!==generation)return;
      const saved=new Set((r.data||[]).map(row=>String(row.listing_id)));
      ids.forEach(id=>{const key=keyOf(s,id);if(!locks.has(key)&&(revisions.get(key)||0)===versions.get(id))state.set(key,saved.has(id));});
    }));
  }catch(e){console.warn('A-USTA favorites:',e.message);}finally{reading=false;paint();if(queued){queued=false;schedule();}}
}
async function toggle(button){
  await session();if(!ready)return;
  if(!userId){document.getElementById('headerAccountLink')?.click();return;}
  const s=button.dataset.favoriteSource,id=button.dataset.favoriteId,key=keyOf(s,id);
  if(!fk[s]||!id||locks.has(key))return;
  const gen=generation,uid=userId,token={};locks.set(key,token);revisions.set(key,(revisions.get(key)||0)+1);paint();
  let previous=state.get(key),optimistic=false;
  try{
    if(previous===undefined){
      const r=await client.from('listing_favorites').select('listing_id').eq('user_id',uid).eq('listing_source',s).in('listing_id',[id]);
      if(r.error)throw r.error;if(gen!==generation)return;previous=(r.data||[]).length>0;
    }
    if(gen!==generation)return;state.set(key,!previous);optimistic=true;paint();
    const r=previous
      ?await client.from('listing_favorites').delete().eq('user_id',uid).eq('listing_source',s).eq('listing_id',id)
      :await client.from('listing_favorites').insert({user_id:uid,[fk[s]]:id});
    if(r.error&&!(r.error.code==='23505'&&!previous))throw r.error;
  }catch(e){if(gen===generation){if(optimistic)state.set(key,previous);window.alert('Elanı yadda saxlamaq mümkün olmadı. Yenidən cəhd edin.');}}
  finally{if(gen===generation&&locks.get(key)===token){locks.delete(key);paint();}}
}
function start(){
  window.addEventListener('click',e=>{const b=e.target.closest?.('button[data-favorite-source]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(!b.disabled)void toggle(b);},true);
  new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('[data-favorite-source]')||n.querySelector?.('[data-favorite-source]')))))schedule();}).observe(document.body,{childList:true,subtree:true});
  schedule();
}
window.AUSTA_MARKETPLACE_CARD_DATA=Object.freeze({salePayload,mount,remember,read,attributes,heart,source});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
