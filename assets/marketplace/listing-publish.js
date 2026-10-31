/* P0.3: private staging + attempt-scoped compensation, not a DB transaction. */
(function(){
'use strict';
let flight=null, completed=null, pending=null;
const sources=new Set(['vehicle_listings','marketplace_listings','service_provider_listings','auto_dealer_listings']);
const failure=code=>Object.assign(new Error(code==='PUBLISH_FAILED'
  ? 'Elan yerləşdirilmədi. Məlumatlar saxlanılıb; yenidən cəhd edə bilərsiniz.'
  : 'Elan yerləşdirilmədi. Əvvəlki əməliyyatın təmizlənməsi təsdiqlənmədi; təkrar elan yaradılmadı. Yenidən cəhd edin və ya dəstəyə müraciət edin.'),{code});
async function cleanup(a){
  if(!a.listing)return !a.insertStarted;
  const sb=a.client,id=a.listing.id,owner=a.user.id;
  try{
    const auth=await sb.auth.getUser();
    if(auth.error||auth.data?.user?.id!==owner)return false;
    // Activation may have committed even if its response was lost.
    if(a.activationStarted){
      const {error}=await sb.from(a.config.parentTable).update({status:'inactive'})
        .eq('id',id).eq('owner_id',owner).select('id').single();
      if(error)return false;
    }
    let clean=true;
    for(const entry of [...a.objects].reverse()){
      if(!entry.path.startsWith(`${owner}/${id}/`)){clean=false;continue;}
      try{
        if(!entry.rowsRemoved){
          const {data,error}=await sb.from(a.config.table).delete()
            .eq('listing_id',id).eq('owner_id',owner).eq('storage_path',entry.path)
            .select('storage_path');
          if(error||!Array.isArray(data))throw failure('PUBLISH_CLEANUP_PENDING');
          entry.rowsRemoved=true;
        }
        if(!entry.objectRemoved){
          const {data,error}=await sb.storage.from(a.config.bucket).remove([entry.path]);
          if(error||!Array.isArray(data)||!data.some(object=>object.name===entry.path))throw failure('PUBLISH_CLEANUP_PENDING');
          entry.objectRemoved=true;
        }
      }catch{clean=false;}
    }
    // Storage policies may require the parent to exist: never remove it early.
    if(!clean)return false;
    const {data,error}=await sb.from(a.config.parentTable).delete()
      .eq('id',id).eq('owner_id',owner).eq('status','inactive').select('id');
    if(error||!Array.isArray(data))return false;
    if(data.length===0){
      const check=await sb.from(a.config.parentTable).select('id')
        .eq('id',id).eq('owner_id',owner).maybeSingle();
      if(check.error||check.data)return false;
    }
    return true;
  }catch{return false;}
}
function begin(){
  if(flight)return false;
  completed=null;
  // An unfinished cleanup must survive form reopening.
  return true;
}
function run(options){
  if(flight)return flight;
  if(completed){
    return completed.owner===options.user.id
      ? Promise.resolve(completed.result)
      : Promise.reject(failure('PUBLISH_CLEANUP_PENDING'));
  }
  flight=(async()=>{
    if(pending){
      if(!await cleanup(pending))throw failure('PUBLISH_CLEANUP_PENDING');
      pending=null;
    }
    const a={client:options.client,user:options.user,config:options.config,
      files:options.files,objects:[],listing:null,insertStarted:false,activationStarted:false};
    if(!sources.has(a.config.parentTable))throw failure('PUBLISH_FAILED');
    let result;
    try{
      result=await options.create(a);
      const listing=result?.listing||result?.data||result;
      if(!listing?.id||listing.owner_id!==a.user.id||listing.status!=='inactive'){
        throw failure('PUBLISH_CLEANUP_PENDING');
      }
      a.listing=listing;
      await options.upload(a);
      a.activationStarted=true;
      const {data,error}=await a.client.from(a.config.parentTable)
        .update({status:'active'}).eq('id',listing.id).eq('owner_id',a.user.id)
        .eq('status','inactive').select().single();
      if(error||!data||data.status!=='active')throw failure('PUBLISH_FAILED');
      result=result?.listing?{...result,listing:data}:result?.data?{...result,data}:data;
    }catch(error){
      // A rejected SQL statement is known not to have inserted a row. A lost
      // response is ambiguous: block a new create rather than assume rollback.
      if(!a.listing&&/^(22|23|42)[0-9A-Z]{3}$/.test(String(error?.code||'')))a.insertStarted=false;
      if(!await cleanup(a)){pending=a;throw failure('PUBLISH_CLEANUP_PENDING');}
      throw failure('PUBLISH_FAILED');
    }
    completed={owner:a.user.id,result};
    return result;
  })().finally(()=>{flight=null;});
  return flight;
}
window.AUSTA_LISTING_PUBLISH=Object.freeze({begin,run});
})();
