/* Explicit owner publication. Never imports private profile coordinates/contact. */
(function(){
'use strict';
if(window.AUSTA_MAP_PUBLICATION)return;
function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
async function open(host,context){
 host.replaceChildren();const root=node('section');root.className='am-publication';host.append(root);root.append(node('h2','Məntəqəmi xəritədə göstər'),node('p','Öz dərc olunmuş elanınızı seçin. Yalnız aktiv provider və təsdiqlənmiş biznes uyğun olduqda görünəcək. Şəxsi ev ünvanı və şəxsi nömrə dərc etməyin. Açıq elan profilinizə keçid veriləcək.'));
 const status=node('p','Hesab yoxlanılır…');status.setAttribute('role','status');root.append(status);const client=window.AUSTA_SUPABASE,valid=()=>context.current()&&root.isConnected&&client===window.AUSTA_SUPABASE;let busy=false,revision=0;
 let loadedListingId=null,loadedRevision=null,pendingRequest=null;
 const fail=()=>{status.textContent='Xəritədə dərc hazırda əlçatan deyil. Hesabı və bağlantını yoxlayın.';};
 try{const auth=await client?.auth?.getUser();if(!valid())return;const uid=auth?.data?.user?.id;if(auth?.error||!uid){status.textContent='Bu əməliyyat üçün mövcud Hesab bölməsindən daxil olun.';return;}
 const rows=await client.from('service_provider_listings').select('id,title,provider_type').eq('owner_id',uid).eq('status','active').limit(40);if(!valid())return;if(rows.error)throw Error();if(!rows.data?.length){status.textContent='Dərc olunmuş provider elanınız tapılmadı.';return;}
 const form=node('form'),select=node('select');select.setAttribute('aria-label','Öz elanınız');for(const row of rows.data){const o=node('option',row.title);o.value=row.id;select.append(o);}form.append(select);const fields={};
 function field(key,label,type='text'){const l=node('label',label),i=node('input');i.type=type;if(type==='number'){i.step='any';i.min=key==='latitude'?-90:-180;i.max=key==='latitude'?90:180;}i.maxLength=key==='public_name'?120:key==='public_area'?100:key==='public_phone'?30:200;l.append(i);form.append(l);fields[key]=i;return i;}
 const kind=node('select');kind.setAttribute('aria-label','Lokasiya növü');for(const [k,t]of [['service_area','Mobil xidmət — yalnız şəhər/rayon'],['business','İctimai fiziki iş yeri']]){const o=node('option',t);o.value=k;kind.append(o);}form.append(kind);
 field('public_name','Açıq biznes adı').required=true;field('public_area','Xidmət ərazisi — şəhər / rayon').required=true;field('public_address','İctimai iş ünvanı — ev ünvanı deyil');field('public_phone','Açıq iş əlaqəsi (istəyə bağlı)');field('latitude','İctimai iş yerinin enliyi','number');field('longitude','İctimai iş yerinin uzunluğu','number');
 const tags=node('fieldset');tags.append(node('legend','Göstərilən xidmətlər'));const choices=[];for(const key of ['repair','wash','tyre','alignment']){const l=node('label',window.AUSTA_MAP_DATA.filters[key]),i=node('input');i.type='checkbox';i.value=key;l.append(i);tags.append(l);choices.push(i);}form.append(tags);
 const l=node('label','Bu məlumatların ictimai dərcinə razıyam. Dəqiq nöqtə yalnız ictimai iş yerimdir; ev ünvanı deyil.');const consent=node('input');consent.type='checkbox';consent.required=true;l.append(consent);form.append(l);
 const save=node('button','Razılıqla dərc et');save.type='submit';save.className='am-primary';const withdraw=node('button','Dərcdən çıxar');withdraw.type='button';const close=node('button','Bağla');close.type='button';close.onclick=()=>{revision++;root.remove();};form.append(save,withdraw,close);root.append(form);
 function visible(){const fixed=kind.value==='business';for(const k of ['public_address','latitude','longitude']){fields[k].parentElement.hidden=!fixed;fields[k].required=fixed;}}kind.onchange=visible;
 async function load(){if(busy)return;const rev=++revision;save.disabled=withdraw.disabled=true;loadedListingId=null;loadedRevision=null;pendingRequest=null;status.textContent='Məlumat yüklənir…';try{const r=await client.from('provider_map_publications').select('public_name,public_area,public_address,public_phone,latitude,longitude,location_kind,services,enabled,revision').eq('listing_id',select.value).maybeSingle();if(!valid()||rev!==revision)return;if(r.error)throw Error();for(const [k,i]of Object.entries(fields))i.value=r.data?.[k]??(k==='public_name'?select.selectedOptions[0].textContent:'');kind.value=r.data?.location_kind||'service_area';for(const i of choices)i.checked=(r.data?.services||[]).includes(i.value);consent.checked=false;visible();loadedListingId=select.value;loadedRevision=r.data?.revision??0;status.textContent=r.data?.enabled?'Razılığı dəyişə və ya geri götürə bilərsiniz.':'Yeni açıq məlumat və razılıq tələb olunur.';save.disabled=withdraw.disabled=false;}catch{if(valid()&&rev===revision)fail();}}
 async function persist(enabled){
 if(busy||!valid())return;
 const listingId=select.value;
 if(loadedListingId!==listingId||!Number.isSafeInteger(loadedRevision)||loadedRevision<0){fail();return;}
 // Bind explicit consent and expected version before the async Auth recheck.
 const args={p_listing_id:listingId,p_expected_revision:loadedRevision,p_enabled:enabled};
 if(enabled)Object.assign(args,{p_consent:consent.checked,p_public_name:fields.public_name.value.trim(),p_public_area:fields.public_area.value.trim(),p_public_phone:fields.public_phone.value.trim()||null,p_public_address:kind.value==='business'?fields.public_address.value.trim():null,p_latitude:kind.value==='business'?Number(fields.latitude.value):null,p_longitude:kind.value==='business'?Number(fields.longitude.value):null,p_location_kind:kind.value,p_services:choices.filter(i=>i.checked).map(i=>i.value)});
 const fingerprint=JSON.stringify(args);
 const requestId=pendingRequest?.fingerprint===fingerprint?pendingRequest.id:window.crypto?.randomUUID?.();
 if(!requestId){fail();return;}
 pendingRequest={fingerprint,id:requestId};args.p_request_id=requestId;
 const rev=++revision;busy=true;const controls=[select,kind,...Object.values(fields),...choices,consent,save,withdraw];for(const control of controls)control.disabled=true;
 let stale=false;
 try{const a=await client.auth.getUser();if(!valid()||a.error||a.data?.user?.id!==uid)throw Error();
 const r=await client.rpc('v355_apply_map_publication',args).single();
 if(r.error||!r.data){if(r.error?.code==='40001')stale=true;throw Error();}
 if(r.data.listing_id!==listingId||!Number.isSafeInteger(r.data.revision)||r.data.revision<loadedRevision||r.data.enabled!==enabled)throw Error();
 loadedRevision=r.data.revision;pendingRequest=null;
 if(valid()&&rev===revision){status.textContent=enabled?'Razılıq saxlanıldı. Görünmə uyğunluq qaydalarından asılıdır.':'Dərc razılığı geri götürüldü.';context.reset();}}
 catch{if(valid()&&rev===revision){status.textContent=stale?'Bu elan başqa sessiyada dəyişib. Yenidən yüklənir…':'Xəritədə dərc hazırda əlçatan deyil. Bağlantını yoxlayın.';}}
 finally{busy=false;if(valid()&&rev===revision){select.value=listingId;for(const control of controls)control.disabled=false;if(stale)void load();}}
 }
 select.onchange=load;form.onsubmit=e=>{e.preventDefault();if(!form.reportValidity())return;if(!choices.some(i=>i.checked)){status.textContent='Ən azı bir xidmət seçin.';return;}void persist(true);};withdraw.onclick=()=>persist(false);visible();await load();
 }catch{if(valid())fail();}
}
window.AUSTA_MAP_PUBLICATION=Object.freeze({open});
})();
