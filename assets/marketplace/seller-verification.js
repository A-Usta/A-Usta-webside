/* V169F.2E — owner-only professional verification; installed RPC lifecycle only. */
(function(){
'use strict';
const BUCKET='seller-verification',MAX_FILE=10485760;
const SELLER_FIELDS='id,business_type,display_name,country_code,status,verification_status,official_status,official_scope,created_at,updated_at';
const APPLICATION_FIELDS='id,seller_profile_id,applicant_type,tax_id,legal_name,representative_name,phone,region,district,address,status,submitted_at,reviewed_at,rejection_reason,created_at,updated_at';
const DOCUMENT_FIELDS='id,application_id,seller_profile_id,document_type,storage_bucket,storage_path,original_file_name,mime_type,file_size,created_at';
const businesses=Object.freeze({dealer:'Avtosalon',store:'Mağaza',service:'Servis',usta:'Usta'});
const applicants=Object.freeze({legal_entity:'Hüquqi şəxs',individual_entrepreneur:'Fərdi sahibkar',individual:'Fiziki şəxs'});
const statuses=Object.freeze({draft:'Qaralama',submitted:'Göndərilib',under_review:'Yoxlanılır',approved:'Təsdiqlənib',rejected:'Rədd edilib',cancelled:'Ləğv edilib'});
const documents=Object.freeze({identity_document:'Şəxsiyyəti təsdiq edən sənəd',tax_registration:'Vergi qeydiyyatı sənədi',business_registration:'Biznes qeydiyyatı sənədi',authorization_document:'Səlahiyyət sənədi',official_dealer_proof:'Rəsmi diler sübutu (adi təsdiq üçün tələb olunmur)',other:'Digər sənəd'});
const extensions=Object.freeze({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'});
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const trim=value=>String(value??'').trim();
let current=null,generation=0,openRequest=0,accountUser=null,bound=null,subscription=null;
const cleanupByOwner=new Map();
const setCleanups=(s,entries)=>{s.cleanups=entries;cleanupByOwner.set(s.userId,entries);};
const pendingCleanup=s=>s.cleanups.some(c=>c.applicationId===selected(s)?.id);
const active=s=>current===s&&s.generation===generation&&s.root.isConnected;
const selected=s=>s.apps.find(app=>app.id===s.applicationId)||null;
const profile=s=>s.sellers.get(selected(s)?.seller_profile_id)||null;
const verified=p=>p?.status==='active'&&p?.verification_status==='verified';
const editable=s=>selected(s)?.status==='draft'&&!verified(profile(s))&&!s.readError;
const required=app=>app?.applicant_type==='individual'?['identity_document']:['identity_document','tax_registration','business_registration'];
function failure(error){console.warn('A-USTA seller verification:',error?.code||'request failed');return new Error('Server sorğusu alınmadı. Yenidən cəhd edin.');}
function login(){document.getElementById('headerAccountLink')?.click();}
async function session(){const sb=window.AUSTA_SUPABASE;if(!sb?.auth)throw new Error('Hesaba giriş hazır deyil.');const {data,error}=await sb.auth.getSession();if(error)throw failure(error);return data?.session||null;}
async function ownSession(s){const value=await session();if(!active(s)||value?.user?.id!==s.userId)throw new Error('Hesab dəyişib. Biznes bölməsini yenidən açın.');return value;}
async function rpc(s,name,args){await ownSession(s);s.needsRefresh=true;const {data,error}=await window.AUSTA_SUPABASE.rpc(name,args);if(error)throw failure(error);await ownSession(s);return data;}
function close(force=false){++openRequest;const s=current;if(!s)return;if(s.busy&&!force){message(s,'Əməliyyat davam edir. Tamamlanmasını gözləyin.');return;}current=null;++generation;s.root.remove();document.body.style.overflow=s.overflow;if(s.focus?.isConnected)s.focus.focus({preventScroll:true});}
function message(s,text){if(!active(s))return;s.message=text;const box=s.root.querySelector('[data-sv-message]');if(box)box.textContent=text;}
function capture(s){s.root.querySelectorAll('[data-sv-field]').forEach(input=>{s.form[input.dataset.svField]=input.value;});}
function field(s,key,label,options={}){return `<label>${esc(label)}${options.required?' *':' (istəyə bağlı)'}<input data-sv-field="${key}" type="${options.type||'text'}" value="${esc(s.form[key]??'')}" ${options.required?'required':''} ${options.max?`maxlength="${options.max}"`:''} ${key==='tax_id'?'inputmode="numeric" pattern="[0-9]{10}"':''}></label>`;}
function button(action,label,extra=''){return `<button type="button" data-sv-action="${action}" ${extra}>${label}</button>`;}
function summary(s){const app=selected(s),p=profile(s);const rows=[['Biznes növü',businesses[p?.business_type]||''],['Profil adı',p?.display_name],['Müraciət edən',applicants[app?.applicant_type]],['VÖEN',app?.tax_id],['Hüquqi / kommersiya adı',app?.legal_name],['Səlahiyyətli nümayəndə',app?.representative_name],['Telefon',app?.phone],['Region',app?.region],['Rayon',app?.district],['Ünvan',app?.address]];return `<dl class="sv-summary">${rows.filter(([,v])=>v!=null&&v!=='').map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;}
function cleanupHtml(s){return s.cleanups.length?`<aside class="sv-warning"><p>Fayl metadatası ilə Storage təmizlənməsi tam başa çatmayıb. Göndərmə/ləğvdən əvvəl təmizləməni tamamlayın.</p>${s.cleanups.map((entry,i)=>button('cleanup','Faylı yenidən təmizlə',`data-sv-cleanup="${i}"`)).join('')}</aside>`:'';}
function listHtml(s){
  const groups=new Map();for(const app of s.apps){if(!groups.has(app.seller_profile_id))groups.set(app.seller_profile_id,[]);groups.get(app.seller_profile_id).push(app);}
  return `<div class="sv-actions">${button('new','Biznes profili yarat')}${button('refresh','Yenilə')}</div>${!groups.size?'<p>Hələ biznes müraciətiniz yoxdur.</p>':''}${[...groups].map(([id,apps])=>{
    const p=s.sellers.get(id),app=apps.find(a=>['draft','submitted','under_review'].includes(a.status))||apps[0];
    return `<section class="sv-identity"><h2>${esc(p?.display_name||'Biznes müraciəti')}</h2><p>${esc(businesses[p?.business_type]||'')} · ${esc(verified(p)?'Təsdiqlənmiş biznes profili':statuses[app.status]||'Status əlçatan deyil')}</p>${button('select',app.status==='draft'&&!verified(p)?'Davam et':'Müraciətə bax',`data-sv-id="${esc(app.id)}"`)}${verified(p)&&p.business_type==='dealer'?button('public','Avtosalona bax',`data-sv-seller="${esc(id)}"`):''}<details><summary>Müraciət tarixçəsi</summary>${apps.map(a=>`<p>${esc(statuses[a.status]||'Status əlçatan deyil')} ${button('select','Bax',`data-sv-id="${esc(a.id)}"`)}</p>`).join('')}</details></section>`;
  }).join('')}${s.hasOlder?button('older','Daha çox müraciət göstər'):''}`;
}
function newHtml(s){return `<p>Adi biznes təsdiqi “Rəsmi” satıcı statusu vermir.</p><div class="sv-fields"><label>Biznes növü *<select data-sv-field="business_type">${Object.entries(businesses).map(([k,v])=>`<option value="${k}" ${s.form.business_type===k?'selected':''}>${v}</option>`).join('')}</select></label>${field(s,'display_name','Biznes profilinin adı',{required:true})}${field(s,'country_code','Ölkə kodu',{required:true,max:2})}<label>Müraciət edən *<select data-sv-field="applicant_type">${Object.entries(applicants).filter(([k])=>k!=='individual'||s.form.business_type==='usta').map(([k,v])=>`<option value="${k}" ${s.form.applicant_type===k?'selected':''}>${v}</option>`).join('')}</select></label></div><div class="sv-actions">${button('create','Qaralama yarat')}</div>`;}
function documentsHtml(s){const app=selected(s),needed=required(app),registered=new Set(s.docs.map(d=>d.document_type));return `<p>Sənədlər məxfidir. JPEG, PNG, WebP və PDF; hər fayl maksimum 10 MB.</p><ul>${needed.map(k=>`<li>${esc(documents[k])}: ${registered.has(k)?'Yüklənib':'Tələb olunur'}</li>`).join('')}</ul><div class="sv-fields"><label>Sənəd növü<select data-sv-document-type>${Object.entries(documents).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></label><label>Fayl<input type="file" data-sv-file accept="image/jpeg,image/png,image/webp,application/pdf"></label></div>${button('upload','Sənədi yüklə')}<ul class="sv-documents">${s.docs.map(doc=>`<li><span>${esc(documents[doc.document_type]||'Sənəd')} — ${esc(doc.original_file_name||'Fayl')}</span>${button('delete','Sil',`data-sv-document="${esc(doc.id)}"`)}</li>`).join('')}</ul>`;}
function workflowHtml(s){const app=selected(s),p=profile(s);if(!app)return '<p>Müraciət əlçatan deyil.</p>';
  const head=`<h2>${esc(p?.display_name||'Biznes müraciəti')}</h2><p>${esc(statuses[app.status]||'Status əlçatan deyil')}</p>`;
  if(verified(p))return head+'<p>Təsdiqlənmiş biznes profili</p>'+summary(s)+(p.business_type==='dealer'?button('public','Avtosalona bax',`data-sv-seller="${esc(p.id)}"`):'');
  if(!editable(s)){
    const activeApplication=s.apps.some(a=>a.seller_profile_id===app.seller_profile_id&&['draft','submitted','under_review'].includes(a.status));
    const resubmit=app.status==='rejected'&&p?.status==='pending'&&p?.verification_status==='rejected'&&!activeApplication;
    return head+(['submitted','under_review'].includes(app.status)?'<p>Müraciətiniz yoxlanılır.</p>':'')+summary(s)+(app.status==='rejected'&&app.rejection_reason?`<p class="sv-warning">Rədd səbəbi: ${esc(app.rejection_reason)}</p>`:'')+(resubmit?button('resubmit','Düzəlt və yenidən göndər'):'');
  }
  const legal=app.applicant_type!=='individual';let body='';
  if(s.step===2)body=`<div class="sv-fields">${field(s,'tax_id','VÖEN',{required:legal,max:10})}${field(s,'legal_name','Hüquqi / kommersiya adı',{required:legal,max:200})}${field(s,'representative_name','Səlahiyyətli nümayəndə',{required:true,max:120})}</div><p>Bu məlumatlar əlaqə addımından sonra birlikdə yadda saxlanılacaq.</p>`;
  if(s.step===3)body=`<div class="sv-fields">${field(s,'phone','Telefon',{required:true,type:'tel',max:30})}${field(s,'region','Region',{required:true,max:100})}${field(s,'district','Rayon',{max:100})}${field(s,'address','Ünvan',{required:true,max:300})}</div>`;
  if(s.step===4)body=documentsHtml(s);
  if(s.step===5)body=summary(s)+`<h3>Tələb olunan sənədlər</h3><ul>${required(app).map(k=>`<li>${esc(documents[k])}: ${s.docs.some(d=>d.document_type===k)?'Yüklənib':'Çatışmır'}</li>`).join('')}</ul><p>Müraciət yalnız adi biznes təsdiqi üçündür.</p>`;
  return head+body+`<div class="sv-actions">${s.step>2?button('back','Geri'):''}${s.step<5?button('next',s.step===3?'Yadda saxla və davam et':'Davam et'):button('submit','Müraciəti göndər')}${button('cancel','Qaralamanı ləğv et','class="sv-danger"')}</div>`;
}
function render(s){if(!active(s))return;
  const step=s.view==='new'?1:s.step;
  s.root.innerHTML=`<div class="sv-shell"><header><h1 id="austaSellerVerificationTitle">Biznes profili və təsdiq</h1><button type="button" data-sv-action="close" aria-label="Bağla">×</button></header><div class="sv-actions">${button('list','Biznes profillərim')}</div>${s.view!=='list'?`<ol class="sv-steps">${['Biznes növü','Hüquqi məlumatlar','Əlaqə və ünvan','Sənədlər','Yoxla və göndər'].map((v,i)=>`<li ${step===i+1?'aria-current="step"':''}>${i+1}. ${v}</li>`).join('')}</ol>`:''}<p data-sv-message role="status" aria-live="polite">${esc(s.message||'')}</p>${s.busy?'<progress aria-label="Əməliyyat davam edir"></progress>':''}${cleanupHtml(s)}${s.readError?'<p>Server vəziyyəti yenilənmədi. Dəyişiklik etməzdən əvvəl yenidən yoxlayın.</p>'+button('refresh','Yenidən yoxla'):s.view==='list'?listHtml(s):s.view==='new'?newHtml(s):workflowHtml(s)}</div>`;
  if(s.busy)s.root.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
}
async function readState(s){
  await ownSession(s);const token=++s.readToken,sb=window.AUSTA_SUPABASE;
  const {data,error}=await sb.from('seller_verification_applications').select(APPLICATION_FIELDS).eq('owner_id',s.userId).order('created_at',{ascending:false}).order('id',{ascending:false}).range(0,s.limit);
  if(error)throw failure(error);if(!Array.isArray(data))throw new Error('Müraciət məlumatının formatı düzgün deyil.');
  const apps=data.slice(0,s.limit);
  if(s.applicationId&&!apps.some(a=>a.id===s.applicationId)){
    const result=await sb.from('seller_verification_applications').select(APPLICATION_FIELDS).eq('owner_id',s.userId).eq('id',s.applicationId).maybeSingle();if(result.error)throw failure(result.error);if(result.data)apps.push(result.data);
  }
  const ids=[...new Set(apps.map(a=>a.seller_profile_id).filter(uuid))],sellers=new Map();
  for(let i=0;i<ids.length;i+=200){const result=await sb.from('seller_profiles').select(SELLER_FIELDS).in('id',ids.slice(i,i+200)).order('created_at',{ascending:true});if(result.error)throw failure(result.error);if(!Array.isArray(result.data))throw new Error('Biznes məlumatı düzgün formatda deyil.');result.data.forEach(p=>{if(ids.includes(p.id))sellers.set(p.id,p);});}
  const app=apps.find(a=>a.id===s.applicationId);let docs=[];
  if(app){const result=await sb.from('seller_verification_documents').select(DOCUMENT_FIELDS).eq('owner_id',s.userId).eq('application_id',app.id).order('created_at',{ascending:true});if(result.error)throw failure(result.error);if(!Array.isArray(result.data))throw new Error('Sənəd məlumatı düzgün formatda deyil.');docs=result.data.filter(d=>d.application_id===app.id&&d.seller_profile_id===app.seller_profile_id);}
  await ownSession(s);if(!active(s)||token!==s.readToken)return;
  s.apps=apps;s.sellers=sellers;s.docs=docs;s.hasOlder=data.length>s.limit;s.readError=false;s.needsRefresh=false;
  if(app)s.form={tax_id:app.tax_id??'',legal_name:app.legal_name??'',representative_name:app.representative_name??'',phone:app.phone??'',region:app.region??'',district:app.district??'',address:app.address??''};
}
async function run(s,operation){if(!active(s)||s.busy)return;capture(s);s.busy=true;s.message='';render(s);
  try{await ownSession(s);await operation();}
  catch(error){if(active(s))s.message=error?.message||'Əməliyyat alınmadı.';}
  finally{
    if(active(s)&&s.needsRefresh){try{await readState(s);}catch(error){s.readError=true;s.message='Server vəziyyəti yenilənmədi. Yenidən yoxlayın.';}}
    if(active(s)){s.busy=false;render(s);}
  }
}
async function refresh(){const s=current;if(!s)return;return run(s,async()=>{try{await readState(s);}catch(error){s.readError=true;throw error;}});}
function validateLegal(s){const app=selected(s),f=s.form;const tax=trim(f.tax_id),name=trim(f.legal_name),representative=trim(f.representative_name);if((app.applicant_type!=='individual'||tax)&&!/^\d{10}$/.test(tax))throw new Error('VÖEN dəqiq 10 rəqəmdən ibarət olmalıdır.');if((app.applicant_type!=='individual'&&!name)||name.length>200)throw new Error('Hüquqi / kommersiya adını düzgün daxil edin (maksimum 200 simvol).');if(representative.length<2||representative.length>120)throw new Error('Səlahiyyətli nümayəndənin adı 2–120 simvol olmalıdır.');}
function validateContact(s){const f=s.form;if(trim(f.phone).length<7||trim(f.phone).length>30)throw new Error('Telefon 7–30 simvol olmalıdır.');if(!trim(f.region)||trim(f.region).length>100||trim(f.district).length>100)throw new Error('Region/rayon məlumatını düzgün daxil edin (maksimum 100 simvol).');if(trim(f.address).length<3||trim(f.address).length>300)throw new Error('Ünvan 3–300 simvol olmalıdır.');}
async function ensureDraft(s){await ownSession(s);const app=selected(s);if(!app||verified(profile(s)))throw new Error('Qaralama əlçatan deyil.');const result=await window.AUSTA_SUPABASE.from('seller_verification_applications').select('id,seller_profile_id,status').eq('owner_id',s.userId).eq('id',app.id).maybeSingle();if(result.error)throw failure(result.error);await ownSession(s);if(result.data?.status!=='draft'||result.data.seller_profile_id!==app.seller_profile_id){s.needsRefresh=true;throw new Error('Müraciət artıq qaralama deyil. Vəziyyət yenilənir.');}return app;}
function pathMatches(s,app,path){const parts=typeof path==='string'?path.split('/'):[];return parts.length===4&&parts[0]===s.userId&&parts[1]===app.seller_profile_id&&parts[2]===app.id&&parts[3]!=='.'&&parts[3]!=='..'&&Boolean(parts[3]);}
async function removeObject(s,app,path){await ownSession(s);if(!pathMatches(s,app,path))throw new Error('Fayl yolu təsdiqlənmədi; Storage silinmədi.');const {error}=await window.AUSTA_SUPABASE.storage.from(BUCKET).remove([path]);if(error)throw new Error('Storage təmizlənmədi. Faylı yenidən təmizləyin.');}
function trackCleanup(s,app,path){if(!s.cleanups.some(c=>c.path===path))setCleanups(s,[...s.cleanups,{applicationId:app.id,sellerId:app.seller_profile_id,path}]);}
async function deleteDocument(s,doc){const app=await ensureDraft(s);if(doc.application_id!==app.id||doc.seller_profile_id!==app.seller_profile_id||doc.storage_bucket!==BUCKET)throw new Error('Sənəd uyğun deyil.');const path=await rpc(s,'delete_seller_verification_document',{p_document_id:doc.id});if(path!==doc.storage_path||!pathMatches(s,app,path))throw new Error('Server fayl yolu uyğun deyil. Storage silinmədi.');trackCleanup(s,app,path);await removeObject(s,app,path);setCleanups(s,s.cleanups.filter(c=>c.path!==path));}
function checkDocuments(s){if(pendingCleanup(s))throw new Error('Əvvəl uğursuz fayl təmizlənməsini tamamlayın.');if(required(selected(s)).some(type=>!s.docs.some(d=>d.document_type===type)))throw new Error('Tələb olunan sənədlərin hamısını yükləyin.');}
async function upload(s,file,type){const app=await ensureDraft(s);if(!file)throw new Error('Fayl seçin.');if(!Object.prototype.hasOwnProperty.call(extensions,file.type))throw new Error('Yalnız JPEG, PNG, WebP və PDF qəbul edilir.');if(file.size<=0||file.size>MAX_FILE)throw new Error('Fayl boş olmamalıdır və 10 MB-dan böyük ola bilməz.');if(!Object.prototype.hasOwnProperty.call(documents,type))throw new Error('Sənəd növünü seçin.');const owner=await ownSession(s);const path=[owner.user.id,app.seller_profile_id,app.id,crypto.randomUUID()+'.'+extensions[file.type]].join('/');message(s,'Fayl yüklənir...');const {error}=await window.AUSTA_SUPABASE.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});if(error)throw failure(error);
  try{message(s,'Sənəd qeydiyyata alınır...');const id=await rpc(s,'register_seller_verification_document',{p_application_id:app.id,p_document_type:type,p_storage_path:path,p_original_file_name:file.name,p_mime_type:file.type,p_file_size:file.size});if(!uuid(id))throw new Error('Sənəd cavabı təsdiqlənmədi. Vəziyyəti yeniləyin.');message(s,'Sənəd yükləndi və qeydiyyata alındı.');}
  catch(error){
    trackCleanup(s,app,path);s.needsRefresh=true;
    // A network error can follow a committed registration. Reconcile before removing the object.
    await readState(s);
    if(s.docs.some(d=>d.storage_path===path)){setCleanups(s,s.cleanups.filter(c=>c.path!==path));throw error;}
    try{await removeObject(s,app,path);setCleanups(s,s.cleanups.filter(c=>c.path!==path));}
    catch{throw new Error('Sənəd qeydiyyatı tamamlanmadı və Storage təmizlənmədi. Faylı yenidən təmizləyin.');}
    throw error;
  }
}
async function action(s,name,control){
  if(name==='close'){close();return;}
  if(s.busy)return;
  if(name==='public'){const id=control.dataset.svSeller,p=s.sellers.get(id);if(!verified(p)||p.business_type!=='dealer')return;if(!window.AUSTA_SELLER_PAGE?.open){message(s,'Avtosalon səhifəsi hazır deyil.');return;}close();const account=document.getElementById('austaAccountModal');account?.classList.remove('open');account?.style.removeProperty('display');document.body.classList.remove('austa-account-open');await window.AUSTA_SELLER_PAGE.open(id);return;}
  if(name==='refresh'){await refresh();return;}
  if(name==='new'){capture(s);s.view='new';s.applicationId=null;s.step=1;s.form={business_type:'dealer',display_name:'',country_code:'AZ',applicant_type:'legal_entity'};s.message='';render(s);return;}
  if(name==='list'){s.view='list';s.applicationId=null;s.message='';render(s);return;}
  if(name==='select'){if(!s.apps.some(a=>a.id===control.dataset.svId))return;s.applicationId=control.dataset.svId;s.view='workflow';s.step=2;await refresh();return;}
  if(name==='older'){s.limit+=50;await refresh();return;}
  const file=s.root.querySelector('[data-sv-file]')?.files?.[0],documentType=s.root.querySelector('[data-sv-document-type]')?.value;
  await run(s,async()=>{
    if(name==='create'){
      const f=s.form;if(!Object.prototype.hasOwnProperty.call(businesses,f.business_type)||!Object.prototype.hasOwnProperty.call(applicants,f.applicant_type)||(f.applicant_type==='individual'&&f.business_type!=='usta'))throw new Error('Biznes və müraciət edən növünü düzgün seçin.');if(!trim(f.display_name))throw new Error('Biznes profilinin adını daxil edin.');const country=trim(f.country_code).toUpperCase();if(!/^[A-Z]{2}$/.test(country))throw new Error('Ölkə kodu iki latın hərfi olmalıdır.');s.view='list';const data=await rpc(s,'create_seller_verification_draft',{p_business_type:f.business_type,p_display_name:trim(f.display_name),p_country_code:country,p_applicant_type:f.applicant_type});s.view='list';const result=Array.isArray(data)&&data.length===1?data[0]:null;if(!uuid(result?.seller_profile_id)||!uuid(result?.application_id))throw new Error('Müraciət cavabı təsdiqlənmədi. Siyahını yeniləyin.');s.applicationId=result.application_id;s.view='workflow';s.step=2;return;
    }
    if(name==='resubmit'){
      const app=selected(s),p=profile(s);if(app?.status!=='rejected'||p?.status!=='pending'||p?.verification_status!=='rejected'||s.apps.some(a=>a.seller_profile_id===app.seller_profile_id&&['draft','submitted','under_review'].includes(a.status)))throw new Error('Yenidən müraciət hazırda mümkün deyil.');const id=await rpc(s,'create_seller_verification_resubmission',{p_seller_profile_id:app.seller_profile_id});if(!uuid(id))throw new Error('Yeni qaralama cavabı təsdiqlənmədi. Siyahını yeniləyin.');s.applicationId=id;s.step=2;return;
    }
    if(name==='cleanup'){const entry=s.cleanups[Number(control.dataset.svCleanup)];if(!entry)throw new Error('Təmizləmə əlçatan deyil.');s.applicationId=entry.applicationId;await readState(s);const app=await ensureDraft(s);if(app.seller_profile_id!==entry.sellerId)throw new Error('Fayl profili uyğun deyil.');const registered=s.docs.find(d=>d.storage_path===entry.path);if(registered)await deleteDocument(s,registered);else await removeObject(s,app,entry.path);setCleanups(s,s.cleanups.filter(c=>c!==entry));s.needsRefresh=true;return;}
    if(!editable(s))throw new Error('Bu müraciət redaktə edilə bilməz.');
    if(name==='back'){s.step=Math.max(2,s.step-1);return;}
    if(name==='next'){
      if(s.step===2){validateLegal(s);s.step=3;return;}
      if(s.step===3){validateLegal(s);validateContact(s);const app=await ensureDraft(s),f=s.form;await rpc(s,'update_seller_verification_draft',{p_application_id:app.id,p_tax_id:trim(f.tax_id)||null,p_legal_name:trim(f.legal_name)||null,p_representative_name:trim(f.representative_name),p_phone:trim(f.phone),p_region:trim(f.region),p_district:trim(f.district)||null,p_address:trim(f.address)});s.step=4;return;}
      if(s.step===4){await readState(s);checkDocuments(s);s.step=5;return;}
    }
    if(name==='upload'){await upload(s,file,documentType);return;}
    if(name==='delete'){const doc=s.docs.find(d=>d.id===control.dataset.svDocument);if(!doc)throw new Error('Sənəd tapılmadı.');if(!window.confirm('Sənədi silmək istəyirsiniz?'))return;try{await deleteDocument(s,doc);}finally{s.needsRefresh=true;}return;}
    if(name==='submit'){await readState(s);await ensureDraft(s);checkDocuments(s);await rpc(s,'submit_seller_verification_application',{p_application_id:selected(s).id});return;}
    if(name==='cancel'){
      if(!window.confirm('Qaralamanı və ona aid sənədləri ləğv etmək istəyirsiniz?'))return;
      await readState(s);await ensureDraft(s);if(pendingCleanup(s))throw new Error('Əvvəl uğursuz fayl təmizlənməsini tamamlayın.');
      try{for(const doc of [...s.docs])await deleteDocument(s,doc);const app=selected(s),result=await rpc(s,'cancel_seller_verification_draft',{p_application_id:app.id});if(result?.success!==true||result.application_id!==app.id||result.seller_profile_id!==app.seller_profile_id||result.status!=='cancelled')throw new Error('Ləğv cavabı təsdiqlənmədi. Vəziyyəti yeniləyin.');}finally{s.needsRefresh=true;}
    }
  });
}
async function open(options={}){
  if(current?.busy)return;
  const request=++openRequest;
  try{const value=await session();if(request!==openRequest)return;if(!value?.user){login();return;}close(true);const root=document.createElement('section');root.id='austaSellerVerification';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','austaSellerVerificationTitle');root.tabIndex=-1;const s={root,userId:value.user.id,generation:++generation,apps:[],sellers:new Map(),docs:[],cleanups:cleanupByOwner.get(value.user.id)||[],applicationId:null,view:'list',step:1,form:{},limit:50,readToken:0,readError:false,busy:false,needsRefresh:false,focus:document.activeElement,overflow:document.body.style.overflow};current=s;document.body.append(root);document.body.style.overflow='hidden';render(s);root.focus();
    root.addEventListener('click',event=>{const control=event.target.closest('button[data-sv-action]');if(!control)return;event.preventDefault();event.stopPropagation();void action(s,control.dataset.svAction,control).catch(error=>message(s,error?.message||'Əməliyyat alınmadı.'));});
    root.addEventListener('change',event=>{if(event.target.matches('[data-sv-field="business_type"]')){capture(s);if(s.form.business_type!=='usta'&&s.form.applicant_type==='individual')s.form.applicant_type='legal_entity';render(s);}});
    root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}if(event.key==='Tab'){const list=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')].filter(el=>el.getClientRects().length);if(event.shiftKey&&(document.activeElement===list[0]||document.activeElement===root)){event.preventDefault();list.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===list.at(-1)){event.preventDefault();list[0]?.focus();}}});
    await refresh();if(active(s)&&!s.readError&&options.create)await action(s,'new');
  }catch(error){console.warn('A-USTA business entry:',error?.message);const box=document.querySelector('#austaAccountModal [data-sv-entry-status]');if(box)box.textContent='Biznes bölməsi açılmadı. Yenidən cəhd edin.';}
}
function mountAccount(){const main=document.getElementById('austaV39Main');if(!main)return;const existing=main.querySelector('[data-sv-account-entry]');if(!accountUser){existing?.remove();return;}if(existing)return;const section=document.createElement('section');section.className='austa-business-entry';section.dataset.svAccountEntry='';section.innerHTML='<h3>Biznes profilləri</h3><p>Biznes müraciətlərinizi və təsdiq vəziyyətini idarə edin.</p><button type="button" data-sv-open="create">Biznes profili yarat</button><button type="button" data-sv-open="list">Biznes profillərim</button><p data-sv-entry-status role="status"></p>';main.append(section);}
function bindAuth(){const sb=window.AUSTA_SUPABASE;if(!sb?.auth){setTimeout(bindAuth,250);return;}if(bound===sb)return;subscription?.unsubscribe();bound=sb;let revision=0;const setUser=id=>{if(accountUser!==id){accountUser=id;close(true);}mountAccount();};const result=sb.auth.onAuthStateChange((_event,value)=>{revision++;setUser(value?.user?.id||null);});subscription=result?.data?.subscription;const before=revision;void session().then(value=>{if(bound===sb&&revision===before)setUser(value?.user?.id||null);}).catch(()=>{if(bound===sb&&revision===before)setUser(null);});}
function start(){const style=document.createElement('style');style.id='austaSellerVerificationStyles';style.textContent=`
#austaSellerVerification{position:fixed;inset:0;z-index:2147483201;overflow:auto;background:#f3f6f4;color:#20392b;font-family:inherit;overscroll-behavior:contain}#austaSellerVerification .sv-shell{max-width:960px;margin:auto;padding:24px;box-sizing:border-box}#austaSellerVerification header{display:flex;justify-content:space-between;align-items:center;gap:16px}#austaSellerVerification h1{font-size:24px}#austaSellerVerification h2{font-size:19px;overflow-wrap:anywhere}#austaSellerVerification .sv-fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}#austaSellerVerification label{display:flex;flex-direction:column;gap:7px;font-size:14px}#austaSellerVerification input,#austaSellerVerification select{width:100%;box-sizing:border-box;border:1px solid #ccd9d0;border-radius:7px;padding:11px;background:#fff;color:#20392b;font:inherit;min-width:0}#austaSellerVerification button,#austaAccountModal .austa-business-entry button{border:1px solid #cbdcd0;background:#fff;color:#176244;border-radius:7px;padding:10px 13px;cursor:pointer;font:inherit}#austaSellerVerification button:disabled{opacity:.6;cursor:wait}#austaSellerVerification button:focus-visible,#austaSellerVerification input:focus-visible,#austaSellerVerification select:focus-visible{outline:2px solid #16845c;outline-offset:2px}#austaSellerVerification .sv-actions{display:flex;flex-wrap:wrap;gap:9px;margin:18px 0}#austaSellerVerification .sv-steps{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px;color:#718076;font-size:13px}#austaSellerVerification .sv-steps li{padding:7px}#austaSellerVerification [aria-current="step"]{background:#dcefe3;color:#176244;border-radius:6px;font-weight:700}#austaSellerVerification .sv-identity{padding:18px 0;border-bottom:1px solid #d5e0d8}#austaSellerVerification .sv-summary>div{display:grid;grid-template-columns:1fr 2fr;gap:12px;padding:7px 0}#austaSellerVerification dt{color:#6d7b71}#austaSellerVerification dd{margin:0;overflow-wrap:anywhere}#austaSellerVerification .sv-warning{padding:12px;background:#fff3d8;color:#70520e;border-radius:7px;overflow-wrap:anywhere}#austaSellerVerification .sv-documents{padding:0;list-style:none}#austaSellerVerification .sv-documents li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 0}#austaSellerVerification .sv-documents span{overflow-wrap:anywhere;min-width:0}#austaSellerVerification .sv-danger{color:#b83243}#austaSellerVerification [data-sv-message]{white-space:pre-wrap;overflow-wrap:anywhere}#austaAccountModal .austa-business-entry{padding:16px;border:1px solid #416350;border-radius:10px;margin:20px 0}#austaAccountModal .austa-business-entry button{margin:4px}#austaSellerVerification progress{width:100%;margin-bottom:15px}@media(max-width:600px){#austaSellerVerification .sv-shell{padding:14px}#austaSellerVerification h1{font-size:20px}#austaSellerVerification .sv-fields{grid-template-columns:1fr}#austaSellerVerification .sv-summary>div{grid-template-columns:1fr;gap:3px}}
`;document.head.append(style);new MutationObserver(mountAccount).observe(document.body,{childList:true,subtree:true});document.addEventListener('click',event=>{const control=event.target.closest?.('[data-sv-open]');if(!control)return;event.preventDefault();event.stopPropagation();void open({create:control.dataset.svOpen==='create'});});bindAuth();}
window.AUSTA_SELLER_VERIFICATION=Object.freeze({open,close,refresh});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
