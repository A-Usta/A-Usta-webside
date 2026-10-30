/* V169F.2B — shared presentation shell; persistence, fetching and eligibility stay external. */
(function(){
'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function text(value){
  if(Array.isArray(value))return value.map(text).filter(Boolean).join(', ');
  if(typeof value!=='string'&&typeof value!=='number')return '';
  if(typeof value==='number'&&!Number.isFinite(value))return '';
  const result=String(value).trim();return /^(null|undefined|\[object Object\]|N\/A)$/i.test(result)?'':result;
}
const number=value=>(typeof value==='number'||typeof value==='string')&&String(value).trim()!==''&&Number.isFinite(Number(value));
const digits=value=>new Intl.NumberFormat('az-AZ',{maximumFractionDigits:2}).formatToParts(Number(value)).map(part=>part.type==='group'?' ':part.value).join('');
function money(value,currency){return number(value)&&Number(value)>0?digits(value)+' '+(text(currency)||'AZN'):'';}
const partsFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function dateParts(date){return Object.fromEntries(partsFormat.formatToParts(date).map(p=>[p.type,p.value]));}
function publication(item,now=Date.now()){
  let time=NaN;
  for(const value of [item?.published_at,item?.created_at]){
    if(typeof value==='string'&&value.trim()&&Number.isFinite(Date.parse(value))){time=Date.parse(value);break;}
  }
  if(!Number.isFinite(time))return '';
  const p=dateParts(time),today=dateParts(now);
  const day=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day));
  const current=Date.UTC(Number(today.year),Number(today.month)-1,Number(today.day));
  const label=day===current?'Bu gün':current-day===86400000?'Dünən':`${p.day}.${p.month}.${p.year}`;
  return `${label} ${p.hour}:${p.minute}`;
}
function location(item){return text(item?.region)||text(item?.district);}
function locationRow(item){
  const city=location(item),posted=publication(item);
  return city||posted?`<div class="austa-card-location-time">${city?`<span class="austa-card-city" title="${esc(city)}">${esc(city)}</span>`:''}${posted?`<span class="austa-card-posted">${esc(posted)}</span>`:''}</div>`:'';
}
function mileage(value){return number(value)&&Number.isInteger(Number(value))&&Number(value)>=0?digits(value)+' km':'';}
function vehicleSummary(item){
  const fuels={petrol:'Benzin',gasoline:'Benzin',diesel:'Dizel',hybrid:'Hibrid',electric:'Elektrik',lpg:'Qaz'};
  const fuel=fuels[String(item.fuel_type).toLowerCase()]||text(item.fuel_type);
  const engine=window.AUSTA_VEHICLE_TECHNICAL?.engineLabel(item,fuel)?.text||text(item.engine);
  return [text(item.year),engine,mileage(item.mileage)].filter(Boolean);
}
function content(type,item){
  const d=item.details&&typeof item.details==='object'&&!Array.isArray(item.details)?item.details:{};
  const brandModel=[text(item.brand),text(item.model)].filter(Boolean).join(' ');
  const condition={new:'Yeni',used:'İşlənmiş'}[item.condition]||text(item.condition);
  let title=text(item.title)||brandModel,summary=[],price=money(item.price,item.currency),business=false;
  switch(type){
    case 'cars':case 'rent':
      title=brandModel||text(item.title);summary=vehicleSummary(item);
      price=type==='rent'?(money(item.daily_price,'AZN')?money(item.daily_price,'AZN')+' / gün':''):money(item.price,'AZN');break;
    case 'parts':title=text(item.title)||text(d.part_name);summary=[text(d.oem)?'OEM '+text(d.oem):'',text(d.compatibility)||brandModel,condition];break;
    case 'accessories':title=text(item.title)||text(d.accessory_name);summary=[brandModel,condition];break;
    case 'moto':summary=[text(d.moto_type),text(item.year),mileage(d.mileage),condition];break;
    case 'special':summary=[text(d.special_type),text(item.year),text(d.work_hours),text(d.sale_rent)];break;
    case 'bus':summary=[text(item.year),number(d.capacity)&&Number(d.capacity)>0?digits(d.capacity)+' nəfər':'',text(d.sale_rent)];break;
    case 'water':summary=[text(d.water_type),text(item.year),text(d.engine),condition];break;
    case 'caravan':summary=[text(d.caravan_type),text(item.year),number(d.beds)&&Number(d.beds)>0?digits(d.beds)+' yataq':'',text(d.sale_rent)];break;
    case 'trailer':summary=[text(d.trailer_type),text(item.year),number(d.load_capacity)&&Number(d.load_capacity)>0?digits(d.load_capacity)+' kq':'',condition];break;
    case 'plate':title=text(d.plate_number)||text(item.title);summary=[text(d.plate_series),text(d.document_status)];break;
    case 'service':case 'usta':
      business=true;title=text(item.name)||text(item.title);summary=[text(item.specialty)||text(item.services)];
      price=type==='service'?text(d.price_policy):'';break;
    case 'dealer':business=true;title=text(item.dealer_name)||text(item.title);summary=[text(item.brands),text(item.working_hours)];price='';break;
  }
  return {title,price,business,summary:[...new Set(summary.map(text).filter(Boolean))]};
}
function attributes(type,item){
  if(type!=='cars'||item.listing_type!=='sale')return '';
  const icon=(symbol,label)=>`<span class="austa-card-attribute" title="${label}" aria-label="${label}" role="img">${symbol}</span>`;
  return `<div class="austa-card-attributes">${item.barter_available===true?icon('⇄','Barter mümkündür'):''}${item.credit_available===true?icon('%','Kredit mümkündür'):''}</div>`;
}
function promotion(item,candidate){
  // Defensive display guard, matching the existing strict Home date contract.
  const start=Date.parse(item.promotion_started_at),end=Date.parse(item.promotion_until),now=Date.now();
  if(!['premium','vip'].includes(candidate)||!Number.isFinite(start)||!Number.isFinite(end)||start>now||end<=now)return '';
  return `<span class="austa-card-promotion ${candidate}">${candidate==='premium'?'Premium':'VIP'}</span>`;
}
function sellerHtml(id){
  const api=window.AUSTA_SELLER_IDENTITY,profile=api?.getForListing({seller_profile_id:id}),label=api?.label(profile)||'';
  if(!label)return '';
  return `<span class="austa-card-seller-label" title="${esc(text(profile.display_name)||label)}">${esc(label)}${api.isOfficial(profile)?'<span class="austa-card-official" role="img" title="Rəsmi satıcı" aria-label="Rəsmi satıcı">✓</span>':''}</span>`;
}
function render(typeValue,item,options={}){
  const type=typeValue==='mechanic'?'usta':typeValue,c=content(type,item),home=options.home===true,id=text(item.id);
  const klass=home?'austa-v151-card':'austa-v154-card',mediaClass=home?'austa-v151-media':'austa-v154-media';
  const connection=home?`data-austa-v151-listing-id="${esc(id)}"`:`data-austa-v154-id="${esc(id)}" data-austa-v154-type="${esc(type)}"`;
  const image=text(item._austaV151Image),sellerId=text(item.seller_profile_id);
  const price=c.price?`<div class="austa-card-price">${esc(c.price)}</div>`:'';
  const title=c.title?`<h3 class="austa-card-title" title="${esc(c.title)}">${esc(c.title)}</h3>`:'';
  const summary=c.summary.length?`<div class="austa-card-summary">${c.summary.map(esc).join(' • ')}</div>`:'';
  return `<article class="${klass} austa-market-card" ${connection}>
    <div class="${mediaClass} austa-card-media">
      ${image?`<img src="${esc(image)}" alt="${esc(c.title)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="austa-card-no-image" hidden>Şəkil mövcud deyil</div>`:'<div class="austa-card-no-image">Şəkil mövcud deyil</div>'}
      ${attributes(type,item)}${window.AUSTA_MARKETPLACE_CARD_DATA.heart(type,item)}
      <div class="austa-card-lower-overlay"><span class="austa-card-seller" data-card-seller="${esc(sellerId)}">${sellerHtml(sellerId)}</span>${promotion(item,options.promotion)}</div>
    </div>
    <div class="austa-card-content${c.business?' austa-card-content-business':''}">${c.business?title+summary+price:price+title+summary}${locationRow(item)}</div>
  </article>`;
}
let scheduled=false;const tokens=new WeakMap();
const cardKey=card=>card?JSON.stringify([card.dataset.austaV151ListingId||card.dataset.austaV154Id,card.dataset.austaV154Type||'cars']):'';
function refreshSellers(){
  scheduled=false;const api=window.AUSTA_SELLER_IDENTITY;if(!api)return;
  const slots=[...document.querySelectorAll('.austa-market-card [data-card-seller]')].filter(slot=>slot.dataset.cardSeller);
  const records=slots.map(slot=>{const token={},card=slot.closest('.austa-market-card');tokens.set(slot,token);return {slot,card,key:cardKey(card),id:slot.dataset.cardSeller,token};});
  void api.hydrate(records.map(r=>({seller_profile_id:r.id}))).then(()=>{
    records.forEach(({slot,card,key,id,token})=>{if(slot.isConnected&&slot.closest('.austa-market-card')===card&&cardKey(card)===key&&slot.dataset.cardSeller===id&&tokens.get(slot)===token)slot.innerHTML=sellerHtml(id);});
  }).catch(error=>console.warn('A-USTA card seller:',error?.message));
}
function start(){
  const schedule=()=>{if(!scheduled){scheduled=true;setTimeout(refreshSellers,0);}};
  new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.austa-market-card')||n.querySelector?.('.austa-market-card')))))schedule();}).observe(document.body,{childList:true,subtree:true});
  schedule();
}
window.AUSTA_LISTING_CARDS=Object.freeze({render,content,publication,locationRow,attributes,promotion});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
