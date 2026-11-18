/* Only a domain-restricted PUBLIC Geoapify browser key belongs here at runtime.
   Never commit a real key or load Supabase/server credentials. */
(function(){
'use strict';
if(window.AUSTA_MAP_CONFIG)return;
const valid=k=>typeof k==='string'&&/^[a-zA-Z0-9_-]{20,100}$/.test(k)&&!/^sb_(secret|publishable)/.test(k);
const existing=window.AUSTA_MAP_SETTINGS;
if(!existing||!Object.isFrozen(existing))window.AUSTA_MAP_SETTINGS=Object.freeze({geoapifyBrowserKey:valid(existing?.geoapifyBrowserKey)?existing.geoapifyBrowserKey:''});
let pending;
async function ready(){
 if(valid(window.AUSTA_MAP_SETTINGS?.geoapifyBrowserKey))return true;
 if(pending)return pending;
 pending=(async()=>{let timer;try{
  // Same-origin public configuration, requested only when the user opens the map.
  const url=new URL('assets/map/runtime-config.json',document.baseURI);
  if(url.origin!==window.location.origin||url.protocol!=='https:')return false;
  const control=new AbortController();timer=setTimeout(()=>control.abort(),4000);
  const response=await fetch(url,{signal:control.signal,credentials:'omit',cache:'no-store',redirect:'error'});
  if(!response.ok||response.url&&new URL(response.url).origin!==url.origin)return false;
  const body=await response.text();if(body.length>4096)return false;
  const config=JSON.parse(body);
  if(!valid(config.geoapifyBrowserKey)||!Array.isArray(config.allowedOrigins)||!config.allowedOrigins.includes(window.location.origin)||config.allowedOrigins.some(v=>typeof v!=='string'||new URL(v).origin!==v||!v.startsWith('https://')))return false;
  window.AUSTA_MAP_SETTINGS=Object.freeze({geoapifyBrowserKey:config.geoapifyBrowserKey});return true;
 }catch{return false;}finally{clearTimeout(timer);pending=null;}})();return pending;
}
window.AUSTA_MAP_CONFIG=Object.freeze({ready});
})();
