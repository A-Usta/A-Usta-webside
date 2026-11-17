/* Approved domain-restricted Geoapify BROWSER key may be injected before this file.
   Never inject a Supabase/service-role/server secret. No real key is committed. */
(function(){
'use strict';
const existing=window.AUSTA_MAP_SETTINGS;
if(existing&&Object.isFrozen(existing))return;
const candidate=existing?.geoapifyBrowserKey;
const valid=typeof candidate==='string'&&/^[a-zA-Z0-9_-]{20,100}$/.test(candidate)&&!/^sb_(secret|publishable)/.test(candidate);
window.AUSTA_MAP_SETTINGS=Object.freeze({geoapifyBrowserKey:valid?candidate:''});
})();
