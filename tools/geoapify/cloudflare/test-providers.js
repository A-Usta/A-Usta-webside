/* TEST-only anonymous discovery. No Auth, table access, mutation or privileged key. */
(function(){
'use strict';
if(window.location.origin!=='https://austa-map-test.austahelper.workers.dev')return;
const endpoint='https://xnhxneziasqthkhhntkv.supabase.co/rest/v1/rpc/discover_public_providers';
let config;
window.AUSTA_SUPABASE=Object.freeze({rpc(name,args){
 let signal;
 const job=Promise.resolve().then(async()=>{
  if(name!=='discover_public_providers')throw Error('TEST_RPC_DENIED');
  const allowed=['south','west','north','east','query','area','countrywide','result_offset','category'];
  if(!args||Object.keys(args).some(k=>!allowed.includes(k)))throw Error('TEST_RPC_ARGUMENTS');
  if(!config){const r=await fetch('/map-test-config',{credentials:'omit',cache:'no-store',redirect:'error',signal});if(!r.ok)throw Error('TEST_CONFIG');const c=await r.json();if(c.project!=='xnhxneziasqthkhhntkv'||!/^sb_publishable_[A-Za-z0-9_-]{10,100}$/.test(c.publishableKey))throw Error('TEST_IDENTITY');config=c;}
  const r=await fetch(endpoint,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal,headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(args)});
  if(!r.ok)throw Error('TEST_DISCOVERY');const body=await r.text();if(body.length>100000)throw Error('TEST_RESPONSE');const data=JSON.parse(body);if(!Array.isArray(data)||data.length>40)throw Error('TEST_RESPONSE');return {data,error:null};
 });
 job.abortSignal=s=>{signal=s;return job;};return job;
}});
})();
