/* V169F.2C — optional production Vehicle Sale VIN contract. */
(function(){
'use strict';
const pattern=/^[A-HJ-NPR-Z0-9]{17}$/;
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const snapshots=new WeakMap();
function valid(value){return typeof value==='string'&&pattern.test(value)?value:'';}
function normalize(value){
  if(value==null || value==='')return null;
  if(typeof value!=='string')throw new Error('VIN-kod 17 simvoldan ibarət olmalıdır və I, O, Q hərflərindən istifadə edilmir.');
  const vin=value.trim().toUpperCase();
  if(!vin)return null;
  if(!valid(vin))throw new Error('VIN-kod 17 simvoldan ibarət olmalıdır və I, O, Q hərflərindən istifadə edilmir.');
  return vin;
}
function payload(type,input){return type==='cars'&&own(input,'vin')&&input.vin!==undefined?{vin:normalize(input.vin)}:{};}
function remember(container,item){
  const input=container.querySelector('[data-v153c-key="vin"]');
  if(input){input.value=item.vin??'';snapshots.set(container,input.value);}
}
function read(container,data,editing){
  if(editing&&snapshots.has(container)&&data.vin===snapshots.get(container))delete data.vin;
  return data;
}
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function detail(item){
  const vin=item?.listing_type==='sale'?valid(item.vin):'';
  if(!vin)return '';
  return `<div class="austa-vin-detail"><span>VIN-kod</span><strong>${esc(vin)}</strong><button type="button" data-austa-copy-vin="${esc(vin)}" title="VIN-kodu kopyala" aria-label="VIN-kodu kopyala">Kopyala</button><a href="https://www.google.com/search?q=${encodeURIComponent(vin)}" target="_blank" rel="noopener noreferrer">İnternetdə axtar</a><small role="status" aria-live="polite"></small></div>`;
}
document.addEventListener('click',async event=>{
  const button=event.target.closest?.('[data-austa-copy-vin]');if(!button)return;
  event.preventDefault();event.stopPropagation();
  const vin=valid(button.dataset.austaCopyVin);if(!vin)return;
  const status=button.parentElement.querySelector('[role="status"]');
  try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(vin);if(status)status.textContent='Kopyalandı';}
  catch{if(status)status.textContent='Kopyalama mümkün olmadı.';}
});
window.AUSTA_VEHICLE_VIN=Object.freeze({valid,normalize,payload,remember,read,detail});
})();
