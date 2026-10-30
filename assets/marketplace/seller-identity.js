/* V169F.2A — public seller registry data only; no DOM, listing writes or badges. */
(function(){
'use strict';
const fields=['id','business_type','display_name','country_code','status','verification_status','official_status','official_scope'];
const labels=Object.freeze({dealer:'Avtosalon',store:'Mağaza',service:'Servis',usta:'Usta'});
const CACHE_MS=60000, MISSING_MS=30000, ERROR_MS=5000, BATCH_SIZE=200, MAX_CACHE=1000;
const cache=new Map(),pending=new Map(),errors=new Map();
let generation=0,boundClient=null,subscription=null,authUser=undefined;
const idOf=value=>typeof value==='string'&&value.length>0?value:null;
const publicProfile=profile=>Boolean(profile&&profile.status==='active'&&profile.verification_status==='verified'&&Object.prototype.hasOwnProperty.call(labels,profile.business_type));
function invalidate(){generation++;cache.clear();pending.clear();errors.clear();}
function client(){
  const sb=window.AUSTA_SUPABASE;
  if(sb!==boundClient){
    subscription?.unsubscribe();subscription=null;boundClient=sb||null;authUser=undefined;invalidate();
    if(sb?.auth?.onAuthStateChange){
      const result=sb.auth.onAuthStateChange((_event,session)=>{
        if(boundClient!==sb)return;
        const next=session?.user?.id||null;
        if(authUser!==undefined&&authUser!==next)invalidate();
        authUser=next;
      });
      subscription=result?.data?.subscription||null;
    }
  }
  return sb;
}
function get(id){
  const key=idOf(id),entry=key&&cache.get(key);
  if(!entry)return null;
  if(entry.until<=Date.now()){cache.delete(key);return null;}
  return entry.profile;
}
function getForListing(item){return get(item?.seller_profile_id);}
function label(profile){return publicProfile(profile)?labels[profile.business_type]:'';}
function isOfficial(profile){return publicProfile(profile)&&profile.official_status==='approved';}
function remember(id,profile){
  cache.delete(id);cache.set(id,{profile,until:Date.now()+(profile?CACHE_MS:MISSING_MS)});
  while(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value);
  errors.delete(id);
}
function fetchBatch(sb,ids,gen){
  // Defer work so concurrent hydrate calls can share the pending entries first.
  const request=Promise.resolve().then(async()=>{
    if(gen!==generation)return;
    const result=await sb.from('seller_profiles').select(fields.join(',')).in('id',ids);
    if(gen!==generation)return;
    if(result.error)throw result.error;
    if(!Array.isArray(result.data))throw new Error('Satıcı məlumatının formatı düzgün deyil.');
    const found=new Map();
    for(const row of result.data){
      if(!ids.includes(row?.id)||!publicProfile(row))continue;
      found.set(row.id,Object.freeze(Object.fromEntries(fields.map(field=>[field,row[field]??null]))));
    }
    ids.forEach(id=>remember(id,found.get(id)||null));
  }).catch(error=>{
    if(gen===generation){ids.forEach(id=>errors.set(id,Date.now()+ERROR_MS));console.warn('A-USTA seller identity:',error?.message||'Məlumat yüklənmədi.');}
  }).finally(()=>{
    ids.forEach(id=>{if(pending.get(id)?.request===request)pending.delete(id);});
  });
  ids.forEach(id=>pending.set(id,{request}));
  return request;
}
async function hydrate(items,options={}){
  // Supplemental data must never reject a listing/card loading operation.
  try{
    if(!Array.isArray(items)||options.signal?.aborted)return [];
    const ids=[...new Set(items.map(item=>idOf(item?.seller_profile_id)).filter(Boolean))];
    if(!ids.length)return [];
    const sb=client();if(!sb?.from)return [];
    const gen=generation,now=Date.now(),fresh=[],wait=new Set();
    for(const id of ids){
      get(id); // Retire expired positive or negative entries.
      if(cache.has(id))continue;
      if(pending.has(id)){wait.add(pending.get(id).request);continue;}
      if((errors.get(id)||0)>now)continue;
      errors.delete(id);fresh.push(id);
    }
    for(let i=0;i<fresh.length;i+=BATCH_SIZE)wait.add(fetchBatch(sb,fresh.slice(i,i+BATCH_SIZE),gen));
    await Promise.all(wait);
    if(gen!==generation||options.signal?.aborted)return [];
    return ids.map(get).filter(Boolean);
  }catch(error){console.warn('A-USTA seller identity:',error?.message||'Məlumat yüklənmədi.');return [];}
}
// A public seller page must revalidate even when an old card/cache is still present.
async function resolveFresh(id){
  const key=idOf(id),sb=client();
  if(!key)return null;
  if(!sb?.from)throw new Error('Satıcı məlumatı hazırda yüklənmir.');
  invalidate(); // Retire older in-flight reads as well as cached public identities.
  const gen=generation;
  await fetchBatch(sb,[key],gen);
  if(gen!==generation)return null;
  if(errors.has(key))throw new Error('Satıcı məlumatı yüklənmədi. Yenidən cəhd edin.');
  return get(key);
}
window.AUSTA_SELLER_IDENTITY=Object.freeze({hydrate,get,getForListing,label,isOfficial,invalidate,resolveFresh});
})();
