/* Category-only search controls. Query predicates are applied before the existing V154-E sort/slice. */
(function(){
'use strict';
const text=(key,label,column=key)=>({key,label,column,kind:'text'});
const range=(key,label,integer=false)=>({key,label,column:key,kind:'range',integer});
const choice=(key,label,values,column=key)=>({key,label,column,kind:'choice',values});
const location=[text('region','Region'),text('district','Rayon')];
const brand=[text('brand','Marka'),text('model','Model')];
const condition=text('condition','Yeni / İşlənmiş');
const price=range('price','Qiymət (AZN)');
const year=range('year','Buraxılış ili',true);
const detail=(key,label)=>text(key,label,'details->>'+key);
const common=[...brand,year,price,condition,...location];
const technical=(key,label)=>{const field=window.AUSTA_VEHICLE_TECHNICAL?.fields.find(f=>f[0]===key);return field?.[2]==='select'?choice(key,label||field[1],field[3].map(v=>Array.isArray(v)?v:[v,v])):text(key,field?.[1]||key);};
const vehicleBrand=[choice('brand','Marka',()=>window.AUSTA_VEHICLE_CATALOG.brands.map(b=>[b,b])),text('model','Model')];
const yesNo=[['true','Bəli'],['false','Xeyr']];
// Text-backed fields intentionally stay text search; no invented canonical facets or numeric JSON casts.
const definitions={
 cars:{title:'Avtomobil axtar',fields:[...vehicleBrand,year,price,range('mileage','Yürüş (km)',true),range('engine_volume','Mühərrik həcmi (L)'),range('horsepower','Mühərrik gücü (a.g.)',true),technical('fuel_type','Yanacaq növü'),technical('transmission'),technical('drivetrain'),text('body_type','Ban növü'),text('color','Rəng'),technical('vehicle_condition','Avtomobilin vəziyyəti'),technical('market','Bazar'),choice('credit_available','Kredit',yesNo),choice('barter_available','Barter',yesNo),...location]},
 rent:{title:'İcarə avtomobili axtar',fields:[...vehicleBrand,year,range('daily_price','Günlük qiymət (AZN)'),detail('rental_type','İcarə növü'),technical('fuel_type','Yanacaq növü'),technical('transmission'),text('body_type','Ban növü'),...location]},
 parts:{title:'Ehtiyat hissəsi axtar',fields:[text('title','Hissənin adı'),text('brand','Avtomobil markası'),text('model','Avtomobil modeli'),detail('oem','OEM / hissə kodu'),condition,price,...location]},
 accessories:{title:'Avtomobil aksessuarı axtar',fields:[text('title','Aksessuarın adı'),text('brand','Avtomobil markası'),text('model','Avtomobil modeli'),condition,price,...location]},
 moto:{title:'Moto nəqliyyat axtar',fields:[detail('moto_type','Növ'),...common]},
 special:{title:'Xüsusi texnika axtar',fields:[detail('special_type','Texnika növü'),...brand,year,detail('sale_rent','Satış / İcarə'),price,condition,...location]},
 bus:{title:'Avtobus axtar',fields:[...brand,year,detail('sale_rent','Satış / İcarə'),price,condition,...location]},
 water:{title:'Su nəqliyyatı axtar',fields:[detail('water_type','Nəqliyyat növü'),...brand,year,detail('engine','Mühərrik'),price,condition,...location]},
 caravan:{title:'Karavan axtar',fields:[detail('caravan_type','Karavan növü'),...brand,year,detail('sale_rent','Satış / İcarə'),price,condition,...location]},
 trailer:{title:'Qoşqu və treyler axtar',fields:[detail('trailer_type','Növ'),...common]},
 plate:{title:'Qeydiyyat nişanı axtar',fields:[detail('plate_number','Nömrə'),detail('plate_series','Seriya'),price,...location]},
 service:{title:'Avtoservis axtar',fields:[text('specialty','İxtisaslaşma'),text('services','Göstərilən xidmətlər'),detail('brands','Xidmət göstərilən avtomobil markaları'),...location]},
 usta:{title:'Usta axtar',fields:[text('specialty','Usta ixtisası'),text('services','Göstərdiyi xidmətlər'),...location]}
};
const typeOf=type=>type==='mechanic'?'usta':type;
const schema=type=>definitions[typeOf(type)]||null;
const values=field=>typeof field.values==='function'?field.values():field.values;
function normalize(type,input={}){
 const result={},def=schema(type);
 if(!def)return result;
 for(const field of def.fields){
  const keys=field.kind==='range'?[field.key+'_min',field.key+'_max']:[field.key];
  for(const key of keys){
   if(input[key]==null||String(input[key]).trim()==='')continue;
   const raw=String(input[key]).trim();
   if(field.kind==='range'){
    const n=Number(raw);if(!Number.isFinite(n)||n<0||(field.integer&&!Number.isInteger(n)))throw new Error(field.label+': düzgün '+(field.integer?'tam ədəd':'rəqəm')+' daxil edin.');result[key]=n;
   }else if(field.kind==='choice'){
    if(!values(field).some(([value])=>String(value)===raw))throw new Error(field.label+': düzgün seçim edin.');result[key]=raw;
   }else{if(raw.length>150)throw new Error(field.label+': maksimum 150 simvol daxil edin.');result[key]=raw;}
  }
  if(field.kind==='range'&&result[field.key+'_min']!=null&&result[field.key+'_max']!=null&&result[field.key+'_min']>result[field.key+'_max'])throw new Error(field.label+': minimum maksimumdan böyük ola bilməz.');
 }
 return result;
}
function applyQuery(query,type,input){
 const filters=normalize(type,input),def=schema(type);if(!def)return query;
 for(const field of def.fields){
  if(field.kind==='range'){
   if(filters[field.key+'_min']!=null)query=query.gte(field.column,filters[field.key+'_min']);
   if(filters[field.key+'_max']!=null)query=query.lte(field.column,filters[field.key+'_max']);
  }else if(filters[field.key]!=null){
   const value=filters[field.key];
   if(field.kind==='choice')query=query.eq(field.column,field.key.endsWith('_available')?value==='true':value);
   else query=query.ilike(field.column,'%'+value.replace(/[\\%_]/g,'\\$&')+'%');
  }
 }
 return query;
}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const states=new WeakMap();
function fieldHtml(field,filters){
 const id='austaFilter-'+field.key;
 if(field.kind==='range')return `<fieldset><legend>${esc(field.label)}</legend><div class="acf-range">${['min','max'].map((side,i)=>`<label><span>${i?'Maksimum':'Minimum'}</span><input aria-label="${esc(field.label)} ${i?'Maksimum':'Minimum'}" name="${field.key}_${side}" type="number" min="0" step="${field.integer?'1':'any'}" value="${esc(filters[field.key+'_'+side])}"></label>`).join('')}</div></fieldset>`;
 if(field.kind==='choice')return `<label for="${id}">${esc(field.label)}</label><select id="${id}" name="${field.key}"><option value="">Hamısı</option>${values(field).map(([value,label])=>`<option value="${esc(value)}" ${String(filters[field.key])===String(value)?'selected':''}>${esc(label)}</option>`).join('')}</select>`;
 return `<label for="${id}">${esc(field.label)}</label><input id="${id}" name="${field.key}" type="text" maxlength="150" value="${esc(filters[field.key])}" ${field.key==='model'?'list="austaFilterModels"':''}>`;
}
function chipsHtml(def,filters){
 if(!def)return '';
 return def.fields.map(field=>{
  const keys=field.kind==='range'?[field.key+'_min',field.key+'_max']:[field.key];
  const selected=keys.filter(key=>filters[key]!=null);if(!selected.length)return '';
  let value=field.kind==='range'?(filters[keys[0]]??'…')+'–'+(filters[keys[1]]??'…'):filters[field.key];
  if(field.kind==='choice')value=values(field).find(([key])=>String(key)===String(value))?.[1]||value;
  return `<button type="button" data-acf-chip="${esc(field.key)}" aria-label="${esc(field.label)} filtrini sil">${esc(field.label)}: ${esc(value)} <span aria-hidden="true">×</span></button>`;
 }).join('')+(Object.keys(filters).length?'<button type="button" data-acf-reset>Filtrləri təmizlə</button>':'');
}
function mount(page,type,filters,onApply){
 const def=schema(type);let state=states.get(page);
 if(!state){
  const layout=document.createElement('div');layout.className='acf-layout';
  const results=document.createElement('div');results.className='acf-results';
  const grid=page.querySelector('#austaV151CategoryGrid'),pagination=page.querySelector('#austaV151Pagination');
  grid.before(layout);layout.append(results);results.append(grid,pagination);
  const panel=document.createElement('aside');panel.className='acf-panel';panel.id='austaCategoryFilters';panel.setAttribute('aria-label','Filtrlər');layout.prepend(panel);
  const toggle=document.createElement('button');toggle.type='button';toggle.className='acf-toggle';toggle.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-expanded','false');layout.before(toggle);
  const count=document.createElement('p');count.className='acf-count';count.setAttribute('role','status');
  const header=page.querySelector('.austa-v151-category-header');header.after(count);
  const breadcrumb=document.createElement('nav');breadcrumb.className='acf-breadcrumb';breadcrumb.setAttribute('aria-label','Səhifə yolu');header.before(breadcrumb);
  const toolbar=document.createElement('div');toolbar.className='acf-toolbar';toolbar.textContent='Sıralama: mövcud elan prioriteti';results.prepend(toolbar);
  const chips=document.createElement('div');chips.className='acf-chips';chips.setAttribute('aria-label','Tətbiq edilmiş filtrlər');toolbar.after(chips);
  state={panel,toggle,count,layout,breadcrumb,chips};
  chips.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const next={...state.filters};if(button.hasAttribute('data-acf-reset'))state.onApply({});else if(button.dataset.acfChip){delete next[button.dataset.acfChip];delete next[button.dataset.acfChip+'_min'];delete next[button.dataset.acfChip+'_max'];if(button.dataset.acfChip==='brand')delete next.model;state.onApply(next);}});
  results.addEventListener('click',event=>{if(event.target.closest('[data-acf-empty-clear]'))state.onApply({});if(event.target.closest('[data-acf-retry]'))state.onApply(state.filters);});
  const homeButton=document.createElement('button');homeButton.type='button';homeButton.textContent='Ana səhifə';homeButton.addEventListener('click',()=>page.querySelector('#austaV151CategoryBack').click());breadcrumb.append(homeButton,document.createTextNode(' / '));
  const crumb=document.createElement('span');crumb.setAttribute('aria-current','page');breadcrumb.append(crumb);state.crumb=crumb;states.set(page,state);
  toggle.addEventListener('click',()=>{const open=page.classList.toggle('acf-filters-open');toggle.setAttribute('aria-expanded',String(open));if(open)panel.querySelector('input,select,button')?.focus();});
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){page.classList.remove('acf-filters-open');toggle.setAttribute('aria-expanded','false');toggle.focus();}});
 }
 if(state.type!==type){page.classList.remove('acf-filters-open');state.toggle.setAttribute('aria-expanded','false');}state.type=type;
 state.filters={...filters};state.onApply=onApply;
 state.crumb.textContent=page.querySelector('#austaV151CategoryTitle').textContent;
 state.chips.innerHTML=chipsHtml(def,filters);
 try{window.AUSTA_CATEGORY_CAMPAIGNS?.mount(page,{onAction:()=>window.AUSTA_V151_MARKETPLACE.openCategory('cars')});}catch(error){console.warn('A-USTA category campaign:',error?.message);}
 state.panel.hidden=!def;state.toggle.hidden=!def;state.layout.classList.toggle('acf-with-filters',Boolean(def));state.count.textContent='Elanlar yüklənir…';
 if(!def)return;
 state.toggle.textContent='Filtrlər · '+Object.keys(filters).length;
 state.panel.innerHTML=`<form><p class="acf-panel-label">Filtrlər</p><h3>${esc(def.title)}</h3>${def.fields.map(f=>fieldHtml(f,filters)).join('')}<datalist id="austaFilterModels"></datalist><p class="acf-error" role="alert"></p><div class="acf-actions"><button type="submit">Tətbiq et</button><button type="button" data-acf-clear>Filtrləri təmizlə</button></div></form>`;
 const form=state.panel.querySelector('form');
 const models=()=>{const brand=form.elements.namedItem('brand')?.value;form.querySelector('datalist').innerHTML=(window.AUSTA_VEHICLE_CATALOG?.models[brand]||[]).map(model=>`<option value="${esc(model)}"></option>`).join('');};models();
 form.elements.namedItem('brand')?.addEventListener('change',()=>{const model=form.elements.namedItem('model');if(model)model.value='';models();});
 const navigate=next=>{page.classList.remove('acf-filters-open');state.toggle.setAttribute('aria-expanded','false');state.toggle.focus({preventScroll:true});onApply(next);};
 form.addEventListener('submit',event=>{event.preventDefault();try{navigate(normalize(type,Object.fromEntries(new FormData(form))));}catch(error){form.querySelector('.acf-error').textContent=error.message;}});
 form.querySelector('[data-acf-clear]').addEventListener('click',()=>navigate({}));
}
function result(page,total){const state=states.get(page);if(state){state.count.textContent=Number(total)+' elan';state.crumb.textContent=page.querySelector('#austaV151CategoryTitle').textContent;}}
function error(page){const state=states.get(page);if(state)state.count.textContent='Elanları yükləmək mümkün olmadı.';}
window.AUSTA_CATEGORY_FILTERS=Object.freeze({normalize,applyQuery,mount,result,error});
})();
