/* V3.5.4: presentation only. Existing selects, field nodes, media and Save own all data. */
(function(){
'use strict';
if(window.AUSTA_LISTING_EXPERIENCE)return;
window.AUSTA_LISTING_EXPERIENCE=Object.freeze({version:'3.5.4'});
const images={cars:'avtomobiller',rent:'rent-a-car',parts:'ehtiyat-hisseleri',accessories:'aksesuarlar',moto:'moto-moped',special:'xususi-texnika',bus:'avtobuslar',water:'su-neqliyyati',caravan:'karavanlar',trailer:'qosqu-treyler',plate:'qeydiyyat-nomreleri',service:'avtoservisler',usta:'usta-profilleri'};
const titles={basic:'Əsas məlumatlar',technical:'Kateqoriyaya aid məlumatlar',media:'Şəkil və video',contact:'Əlaqə və yerləşmə'};
const basic=new Set(['brand','model','year','price','daily_price','deposit','part_name','accessory_name','service_name','dealer_name','plate_number','special_type','water_type','trailer_type','moto_type','caravan_type','sale_rent','rental_type','description','about']);
// Presentation hints mirror the existing controller; no new validation gate.
const required={cars:['phone','brand','model','year','price'],rent:['phone','brand','model','year','daily_price'],parts:['phone','part_name','price'],accessories:['phone','accessory_name','price'],moto:['phone','price'],special:['phone','special_type','price'],bus:['phone','price'],water:['phone','water_type','price'],caravan:['phone','price'],trailer:['phone','trailer_type','price'],plate:['phone','plate_number','price'],service:['phone','service_name','specialty'],usta:['phone','name','specialty'],dealer:['dealer_name','phone','region','address']};
const contact=new Set(['name','phone','region_address','message_contact','region','district','address','contact_name','working_hours']);
let active=null,scheduled=false;
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,run,cls){const b=node('button',text,cls);b.type='button';b.addEventListener('click',run);return b;}
function categoryButton(run){const b=node('div',undefined,'v354-category');b.setAttribute('role','button');b.tabIndex=0;b.addEventListener('click',run);b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click();}});return b;}
function label(text){return text.replace(/^[^\p{L}\p{N}]+/u,'').trim();}
function topLayer(){return document.querySelector('dialog[open]');}
function queue(){if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;sync();});}}
function cleanup(s){s.observer.disconnect();s.statusObserver?.disconnect();s.selectObserver?.disconnect();document.removeEventListener('keydown',s.keys,true);for(const [n,inert]of s.background)if(n.isConnected)n.inert=inert;document.body.style.overflow=s.overflow;if(!topLayer())s.focus?.focus?.();}
function sync(){
 const overlay=document.getElementById('austaV153COverlay');
 if(active&&active.overlay!==overlay){if(topLayer())return;cleanup(active);active=null;}
 if(!overlay||active)return;
 const select=overlay.querySelector('#austaV153CCategory'),fields=overlay.querySelector('#austaV153CFields');
 if(!select||!fields)return;
 const s={overlay,select,fields,modal:overlay.querySelector('#austaV153CModal'),body:overlay.querySelector('.austa-v153c-body'),picker:true,step:'basic',background:new Map(),focus:document.activeElement,overflow:document.body.style.overflow};active=s;
 overlay.dataset.v354='';s.modal.setAttribute('aria-labelledby','v354Title');const title=s.modal.querySelector('h2');title.id='v354Title';
 s.intro=node('p','Kateqoriyanı seçin, məlumatları əlavə edin və elanı ön baxışda yoxlayın.','v354-intro');s.body.prepend(s.intro);
 s.grid=node('div',undefined,'v354-categories');s.grid.setAttribute('aria-label','Elan kateqoriyasını seçin');s.intro.after(s.grid);
 s.nav=node('nav',undefined,'v354-steps');s.nav.setAttribute('aria-label','Elan məlumatları');fields.before(s.nav);
 s.heading=node('h3',undefined,'v354-section-title');fields.before(s.heading);
 s.back=button('← Kateqoriyalar',()=>{s.picker=true;paint(s);s.grid.querySelector('[role=button]')?.focus();},'v354-back');s.intro.before(s.back);
 fields.addEventListener('input',()=>{s.dirty=true;});fields.addEventListener('change',()=>{s.dirty=true;});
 s.controls=node('div',undefined,'v354-step-controls');s.prev=button('← Əvvəlki',()=>move(s,-1));s.next=button('Davam et →',()=>move(s,1),'v354-primary');s.controls.append(s.prev,s.next);fields.after(s.controls);
 select.addEventListener('change',()=>{s.picker=false;s.step='basic';queueMicrotask(()=>{decorate(s);paint(s);});});
 s.selectObserver=new MutationObserver(()=>{if(select.disabled){s.picker=false;paint(s);}});s.selectObserver.observe(select,{attributes:true,attributeFilter:['disabled']});
 s.observer=new MutationObserver(()=>{decorate(s);});s.observer.observe(fields,{childList:true,subtree:true});
 const status=overlay.querySelector('#austaV153CStatus');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 // The original controller owns validation; reveal every field when it reports an error.
 s.statusObserver=new MutationObserver(()=>{if(status.textContent.trim().startsWith('✕')||status.classList.contains('error')||/doldurun|xəta|olmadı|seçin|düzgün/i.test(status.textContent)){s.step='all';s.overlay.dataset.v354Error='true';paint(s);}else delete s.overlay.dataset.v354Error;});s.statusObserver.observe(status,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 s.keys=e=>{
  if(!s.overlay.isConnected||topLayer()||document.querySelector('.austa-v169-overlay'))return;
  if(e.key==='Escape'){e.preventDefault();overlay.querySelector('#austaV153CClose').click();return;}
  if(e.key!=='Tab')return;
  const f=[...s.modal.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(n=>!n.disabled&&!n.closest('[hidden]')&&n.getClientRects().length);
  const first=f[0],last=f.at(-1);if(e.shiftKey&&(document.activeElement===first||!s.modal.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!s.modal.contains(document.activeElement))){e.preventDefault();first?.focus();}
 };
 document.addEventListener('keydown',s.keys,true);
 for(const n of document.body.children)if(n!==overlay&&n.tagName!=='SCRIPT'&&n.tagName!=='STYLE'&&n.tagName!=='LINK'&&!n.matches('dialog')){s.background.set(n,n.inert);n.inert=true;}
 document.body.style.overflow='hidden';
 const registry=window.AUSTA_V153C?.categories;if(!registry)return;
 for(const option of select.options)if(!Object.hasOwn(registry,option.value)){option.hidden=true;option.disabled=true;}
 const options=[...select.options].filter(option=>Object.hasOwn(registry,option.value));for(const option of options){if(!option.value)continue;const b=categoryButton(()=>{
  if(option.value!==select.value&&s.dirty&&!window.confirm('Kateqoriyanı dəyişsəniz, bu formanın məlumatları sıfırlanacaq. Davam edilsin?'))return;
  s.picker=false;s.step='basic';if(select.value!==option.value){s.dirty=false;select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));}decorate(s);paint(s);s.heading.focus();
 });b.dataset.v354Category=option.value;
 if(images[option.value]){const img=node('img');img.src='assets/austa-home/'+images[option.value]+'.webp';img.alt='';img.loading='lazy';b.append(img);}else b.append(node('span','A-USTA','v354-category-mark'));
 b.append(node('strong',label(option.textContent)),node('span','Elan məlumatlarını əlavə edin →','v354-category-caption'));s.grid.append(b);}
 s.heading.tabIndex=-1;decorate(s);s.picker=!select.disabled;paint(s);(s.picker?s.grid.querySelector('[role=button]'):s.heading)?.focus();
}
function decorate(s){
 let changed=false;for(const child of s.fields.children){
  if(child.dataset.v354Group)continue;
  const inputs=[...child.querySelectorAll('[data-v153c-key]')],key=inputs[0]?.dataset.v153cKey;
  const group=child.id==='austaV153CMediaBox'?'media':key?(contact.has(key)?'contact':basic.has(key)?'basic':'technical'):'contact';
  child.dataset.v354Group=group;changed=true;
  for(const input of inputs){if(!input.id)input.id='v354-field-'+input.dataset.v153cKey;const l=input.closest('.austa-v153c-field')?.querySelector('label');if(l)l.htmlFor=input.id;
   const mandatory=(required[s.select.value]||[]).includes(input.dataset.v153cKey);if(mandatory){input.setAttribute('aria-required','true');l?.append(node('span',' *','v354-required'));}
   const hint=node('span',undefined,'v354-field-error');hint.id=input.id+'-hint';hint.hidden=true;input.after(hint);
   const described=input.getAttribute('aria-describedby');input.setAttribute('aria-describedby',[described,hint.id].filter(Boolean).join(' '));
   const check=()=>{const missing=mandatory&&!input.value.trim();const invalid=missing||Boolean(input.value&&!input.validity.valid);hint.textContent=missing?'Bu sahəni doldurun.':invalid?'Dəyəri yoxlayın.':'';hint.hidden=!invalid;input.setAttribute('aria-invalid',String(invalid));};
   input.addEventListener('blur',check);input.addEventListener('input',()=>{if(input.getAttribute('aria-invalid')==='true')check();});}
 }
 if(changed)paint(s);
}
function groups(s){return Object.keys(titles).filter(k=>[...s.fields.children].some(n=>n.dataset.v354Group===k));}
function move(s,delta){const list=groups(s);const i=list.indexOf(s.step);s.step=list[Math.max(0,Math.min(list.length-1,i+delta))];paint(s);s.heading.focus();s.body.scrollTop=0;}
function paint(s){
 if(!s.overlay.isConnected)return;
 const list=groups(s);if(!list.includes(s.step)&&s.step!=='all')s.step=list[0];
 s.overlay.dataset.v354View=s.picker?'categories':'form';
 s.grid.hidden=!s.picker;s.back.hidden=s.picker||s.select.disabled;s.nav.hidden=s.picker;s.heading.hidden=s.picker;s.fields.hidden=s.picker;s.controls.hidden=s.picker;
 // Cards/back control replace the visual select; the same canonical select still owns routing.
 s.select.hidden=true;s.body.querySelector('.austa-v153c-category-label')?.setAttribute('hidden','');s.intro.hidden=!s.picker;
 s.body.querySelector('#v352ListingHelp')?.setAttribute('hidden','');
 const actions=s.body.querySelector('.austa-v153c-actions'),note=s.body.querySelector('.austa-v153c-note');actions.hidden=s.picker;note.hidden=s.picker;
 s.heading.textContent=s.step==='all'?'Bütün məlumatlar':titles[s.step];
 const h=s.modal.querySelector('h2');h.textContent=s.picker?'Elan yerləşdir':label(s.select.selectedOptions[0]?.textContent||'Elan məlumatları');
 s.nav.replaceChildren();for(const [i,k]of list.entries()){const b=button((i+1)+'. '+titles[k],()=>{s.step=k;paint(s);s.heading.focus();});b.setAttribute('aria-current',s.step===k?'step':'false');s.nav.append(b);}
 const all=button('Hamısı',()=>{s.step='all';paint(s);s.heading.focus();});all.setAttribute('aria-current',s.step==='all'?'step':'false');s.nav.append(all);
 for(const child of s.fields.children)child.hidden=s.step!=='all'&&child.dataset.v354Group!==s.step;
 s.prev.hidden=s.step==='all'||list.indexOf(s.step)===0;s.next.hidden=s.step==='all'||list.indexOf(s.step)===list.length-1;
}
new MutationObserver(queue).observe(document.body,{childList:true});queue();
})();
