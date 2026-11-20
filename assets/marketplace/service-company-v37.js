/* V3.7 service-company listing questionnaires; persistence/media remain on the existing provider pipeline. */
(function(){
'use strict';
const forms={
leasing:{label:'💳 Lizinq şirkətləri',fields:[
['company_name','Şirkətin adı','text'],['tax_id','VÖEN','text'],['legal_name','Hüquqi və ya ticarət adı','text'],['phone','Əlaqə nömrəsi','tel'],['email','E-poçt','email'],['website','Veb-sayt','url'],['city','Şəhər','text'],['service_area','Xidmət ərazisi','text'],
['vehicle_categories','Avtomobil kateqoriyaları','checklist',['Sedan','SUV / krossover','Pikap','Kommersiya avtomobili','Digər']],['vehicle_condition','Avtomobilin vəziyyəti','select',['Yeni','İşlənmiş','Yeni və işlənmiş']],['customer_types','Müştəri növü','checklist',['Fiziki şəxslər','Hüquqi şəxslər']],
['minimum_down_payment','Minimum ilkin ödəniş','number'],['minimum_term','Minimum lizinq müddəti (ay)','number'],['maximum_term','Maksimum lizinq müddəti (ay)','number'],['rate','Faiz dərəcəsi (%)','number'],['interest_type','Faiz dövrü','select',[['annual','İllik'],['monthly','Aylıq']]],['currency','Valyuta','select',['AZN','USD','EUR']],['minimum_financing','Minimum maliyyələşmə məbləği','number'],['maximum_financing','Maksimum maliyyələşmə məbləği','number'],['guarantor_required','Zamin tələbi','select',['Tələb olunur','Tələb olunmur','Şərtdən asılıdır']],['income_proof_required','Gəlir sənədi tələbi','select',['Tələb olunur','Tələb olunmur','Şərtdən asılıdır']],['required_documents','Tələb olunan digər sənədlər','textarea'],['terms','Təklifin şərtləri','textarea'],['description','Xidmətin təsviri','textarea']]},
insurance:{label:'🛡️ Avtomobil sığorta şirkətləri',fields:[
['company_name','Şirkətin adı','text'],['tax_id','VÖEN','text'],['phone','Əlaqə nömrəsi','tel'],['email','E-poçt','email'],['website','Veb-sayt','url'],['city','Şəhər','text'],['service_area','Fəaliyyət ərazisi','text'],
['insurance_types','Sığorta xidmətləri','checklist',['İcbari avtomobil sığortası','KASKO','Digər avtomobil sığortası']],['coverage','Sığorta təminatı','textarea'],['franchise','Franşiza şərtləri','text'],['contract_months','Müqavilə müddəti (ay)','number'],['payment_methods','Ödəniş üsulları','checklist',['Nağd','Bank kartı','Bank köçürməsi','Onlayn ödəniş']],['installments_available','Hissəli ödəniş imkanı','select',['Bəli','Xeyr','Şərtdən asılıdır']],['online_application','Onlayn müraciət','select',['Bəli','Xeyr']],['claims_support','Hadisə zamanı dəstək xidməti','select',['Bəli','Xeyr']],['repair_network','Partnyor təmir şəbəkəsi','textarea'],['exclusions','İstisnalar və məhdudiyyətlər','textarea'],['license_reference','Şirkətin təqdim etdiyi lisenziya / icazə məlumatı','text'],['license_disclosure','Lisenziya məlumatının statusu','select',[['company_reported_unverified','Şirkət tərəfindən təqdim edilib; platforma tərəfindən yoxlanılmayıb']]],['description','Şirkətin təsviri','textarea']]},
sober_driver:{label:'🚘 Ayıq sürücü şirkətləri',fields:[
['company_name','Şirkətin adı','text'],['tax_id','VÖEN (tətbiq olunduqda)','text'],['phone','Əlaqə nömrəsi','tel'],['city','Şəhər','text'],['service_area','Xidmət rayonları','text'],['service_24_7','24/7 xidmət','select',['Bəli','Xeyr']],['working_hours','İş saatları','text'],['minimum_order_price','Minimum sifariş qiyməti (AZN)','number'],['rate_per_km','Kilometr üzrə tarif (AZN)','number'],['rate_per_hour','Saat üzrə tarif (AZN)','number'],['night_rate','Gecə tarifi (AZN)','number'],['city_service','Şəhərdaxili xidmət','select',['Bəli','Xeyr']],['intercity_service','Şəhərlərarası xidmət','select',['Bəli','Xeyr']],['advance_booking','Əvvəlcədən sifariş','select',['Bəli','Xeyr']],['urgent_service','Təcili sifariş','select',['Bəli','Xeyr']],['driver_experience','Sürücülərin təcrübəsi','text'],['payment_methods','Ödəniş üsulları','checklist',['Nağd','Bank kartı','Köçürmə']],['waiting_fee','Gözləmə haqqı (AZN)','number'],['special_conditions','Xüsusi şərtlər','textarea'],['description','Xidmətin təsviri','textarea']]}
};
forms.leasing.fields.splice(forms.leasing.fields.findIndex(field=>field[0]==='description'),0,['license_reference','Şirkətin təqdim etdiyi maliyyə icarəsi reyestri məlumatı','text'],['license_disclosure','Reyestr məlumatının statusu','select',[['company_reported_unverified','Şirkət tərəfindən təqdim edilib; platforma tərəfindən yoxlanılmayıb']]]);
function install(){
 const api=window.AUSTA_V153C;if(!api?.categories)return false;
 Object.assign(api.categories,forms);
 const select=document.querySelector('#austaV153CCategory');
 if(select)for(const [key,value]of Object.entries(forms)){if(![...select.options].some(o=>o.value===key)){const option=document.createElement('option');option.value=key;option.textContent=value.label;select.append(option);}}
 const grid=document.querySelector('#austaV107ListingCategories .austa-v107-category-grid');
 if(grid)for(const [key,value]of Object.entries(forms)){if(grid.querySelector('[data-austa-v107-category="'+key+'"]'))continue;const b=document.createElement('button');b.type='button';b.className='austa-v107-category';b.dataset.austaV107Category=key;b.innerHTML='<span class="austa-v107-category-icon">'+value.label.split(' ')[0]+'</span><span class="austa-v107-category-name">'+value.label.slice(value.label.indexOf(' ')+1)+'</span>';grid.append(b);}
 return true;
}
function restoreChecks(){
 const root=document.querySelector('#austaV153CFields');if(!root)return;
 root.querySelectorAll('[data-v153c-key]').forEach(hidden=>{if(!forms[document.querySelector('#austaV153CCategory')?.value])return;let values=[];try{values=JSON.parse(hidden.value||'[]')}catch{}if(!Array.isArray(values))return;root.querySelectorAll('[data-v37-choice="'+hidden.dataset.v153cKey+'"]').forEach(input=>{input.checked=values.includes(input.value);});});
}
function syncChecks(event){
 const input=event.target.closest?.('[data-v37-choice]');if(!input)return;
 const root=input.closest('#austaV153CFields'),group=input.dataset.v37Choice,hidden=root?.querySelector('[data-v153c-key="'+group+'"]');
 if(hidden)hidden.value=JSON.stringify([...root.querySelectorAll('[data-v37-choice="'+group+'"]:checked')].map(n=>n.value));
}
// Use the real marketplace route for these three homepage categories. Legacy
// V106 click handlers may otherwise consume the click without opening a list.
document.addEventListener('click',event=>{
 const card=event.target.closest?.('#austaV107ListingCategories [data-austa-v107-category]');
 const type=card?.dataset.austaV107Category;
 if(!Object.prototype.hasOwnProperty.call(forms,type))return;
 const open=window.AUSTA_V151_MARKETPLACE?.openCategory;
 if(typeof open!=='function')return;
 event.preventDefault();
 event.stopImmediatePropagation();
 open(type);
},true);
document.addEventListener('change',syncChecks,true);
const obs=new MutationObserver(()=>{install();restoreChecks();});
function boot(){install();restoreChecks();obs.observe(document.documentElement,{subtree:true,childList:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AUSTA_SERVICE_COMPANY_V37=Object.freeze({forms,install,isType:type=>Object.prototype.hasOwnProperty.call(forms,type)});
})();