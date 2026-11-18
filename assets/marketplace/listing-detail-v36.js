/* V3.6 universal detail enhancements. Existing RLS, listing, lifecycle, media,
 * favorites and promotion controllers remain authoritative. */
(function(){
'use strict';
const api=window.AUSTA_LISTING_DETAIL;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const sourceSet=new Set(['vehicle','marketplace','service_provider','auto_dealer']);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const activePages=new WeakSet();
function context(page){
 const u=new URL(location.href),h=new URLSearchParams(u.hash.replace(/^#/,''));
 const id=u.searchParams.get('listing')||h.get('listing');
 const source=u.searchParams.get('source')||h.get('source')||'vehicle';
 return id&&sourceSet.has(source)?{id,source,page,valid:()=>{const current=new URL(location.href),hash=new URLSearchParams(current.hash.replace(/^#/,''));return page.isConnected&&document.getElementById('austaFinalListingPage')===page&&(current.searchParams.get('listing')||hash.get('listing'))===id&&(current.searchParams.get('source')||hash.get('source')||'vehicle')===source;}}:null;
}
function date(value){const d=new Date(value);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('az-AZ',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);}
function visitorId(){
 const key='austa-listing-viewer-v1';
 try{let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}return id;}catch{return crypto.randomUUID();}
}
function actionButton(text,attrs){const b=document.createElement('button');b.type='button';b.textContent=text;Object.entries(attrs).forEach(([k,v])=>b.setAttribute(k,v));return b;}
function installTitleActions(page,c,item){
 const title=page.querySelector('.austa-final-title');if(!title||page.querySelector('.austa-v36-title-actions'))return;
 const group=document.createElement('div');group.className='austa-v36-title-actions';group.setAttribute('role','group');group.setAttribute('aria-label','Elan əməliyyatları');
 group.append(actionButton('♡ Seçilmişlərdə saxla',{'class':'austa-v36-favorite','data-favorite-source':c.source,'data-favorite-id':c.id,'aria-label':'Elanı yadda saxla','aria-pressed':'false','aria-busy':'true',disabled:'disabled'}),actionButton('⚑ Şikayət et',{'data-v36-report':''}),actionButton('↗ Paylaş',{'data-v36-share':''}));
 title.insertAdjacentElement('afterend',group);
 page.querySelector('.austa-final-id')?.remove();
}
function installMetadata(page,c){
 const gallery=page.querySelector('.austa-final-gallery');if(!gallery||page.querySelector('[data-v36-listing-metadata]'))return null;
 const box=document.createElement('div');box.className='austa-v36-metadata';box.dataset.v36ListingMetadata='';box.setAttribute('aria-live','polite');box.textContent='Elan statistikası yüklənir';gallery.insertAdjacentElement('afterend',box);return box;
}
function compactSpecs(page){
 const grids=[...page.querySelectorAll('.austa-compact-spec-columns,.austa-final-spec-grid')];
 for(const old of grids){
  const section=old.closest('.austa-final-info-section');if(!section)continue;
  const readColumn=column=>[...column.querySelectorAll('.austa-final-spec')].map(cell=>[cell.querySelector('dt,small')?.textContent?.trim(),cell.querySelector('dd,strong')?.textContent?.trim()]).filter(pair=>pair[0]&&pair[1]);
  const columns=old.classList.contains('austa-compact-spec-columns')?[...old.querySelectorAll('.austa-compact-spec-column')].map(readColumn):[readColumn(old)];
  if(!columns.some(column=>column.length))continue;
  const rows=[];
  if(columns.length===2){for(let i=0;i<Math.max(columns[0].length,columns[1].length);i++)rows.push([columns[0][i],columns[1][i]].filter(Boolean));}
  else for(let i=0;i<columns[0].length;i+=2)rows.push(columns[0].slice(i,i+2));
  const grid=document.createElement('div');grid.className='austa-v36-spec-table';grid.setAttribute('role','table');
  for(const values of rows){const row=document.createElement('div');row.className='austa-v36-spec-row';row.setAttribute('role','row');for(const [label,value] of values){const dl=document.createElement('dl');dl.className='austa-v36-spec';dl.setAttribute('role','cell');const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);row.append(dl);}grid.append(row);}
  old.replaceWith(grid);
  const heading=section.querySelector('.austa-final-section-title');if(heading&&/elan haqqında məlumat/i.test(heading.textContent))heading.textContent='ELAN XÜSUSİYYƏTLƏRİ';
 }
}
function installContactAndPromotions(page,item){
 const side=page.querySelector('.austa-final-side-card');if(!side)return;
 const price=side.querySelector('.austa-final-price');
 if(price&&!side.querySelector('[data-v36-price-history]'))price.insertAdjacentElement('afterend',actionButton('Qiymət tarixçəsi',{'class':'austa-v36-price-history','data-v36-price-history':''}));
 if(!price&&!side.querySelector('.austa-v36-no-price')){const note=document.createElement('div');note.className='austa-v36-no-price';note.textContent='Qiymət məlumatı əlavə edilməyib';side.prepend(note);}
 const place=[item.region,item.district].filter(Boolean).join(' / ');if(place&&!side.querySelector('.austa-v36-seller-place')){const p=document.createElement('div');p.className='austa-v36-seller-place';p.textContent=place;side.querySelector('[data-professional-seller]')?.insertAdjacentElement('afterend',p);}
 page.querySelectorAll('[data-owner-boost],[data-owner-vip],[data-owner-premium]').forEach(el=>el.remove());
 if(!page.querySelector('.austa-v36-promotion-card')){
  const card=document.createElement('section');card.className='austa-final-side-card austa-v36-promotion-card';card.innerHTML='<h2 class="austa-final-section-title">Elanı irəli çəkin</h2><p>Tariflərə baxın. Aktivləşdirmə yalnız elan sahibinin hesabı və mövcud tanıtım icazəsi ilə mümkündür.</p><button type="button" data-v36-promotion="boost"><strong>↑ İrəli çək</strong><small>Elan siyahıda yenilənsin</small><span>Tariflərə bax</span></button><button type="button" data-v36-promotion="vip"><strong>★ VIP</strong><small>VIP yerləşdirmə</small><span>Tariflərə bax</span></button><button type="button" data-v36-promotion="premium"><strong>◆ Premium</strong><small>Üstün görünürlük</small><span>Tariflərə bax</span></button>';
  side.insertAdjacentElement('afterend',card);
 }
}
function installFullscreen(page){
 const root=page.querySelector('[data-austa-final-main-media]');if(!root)return;
 const add=()=>{const stage=root.querySelector('.austa-v147-main-stage');if(stage&&!stage.querySelector('[data-v36-fullscreen]'))stage.append(actionButton('⛶ Tam ekran',{'class':'austa-v36-fullscreen','data-v36-fullscreen':'','aria-label':'Tam ekran aç'}));};
 add();new MutationObserver(add).observe(root,{childList:true,subtree:true});
}
async function loadMetadata(page,c){
 const box=page.querySelector('[data-v36-listing-metadata]'),db=window.AUSTA_SUPABASE;if(!box)return;
 if(!db?.rpc){box.textContent='Elan statistikası hazırda əlçatan deyil.';return;}
 try{
  await db.rpc('austa_record_listing_detail_view',{p_source:c.source,p_listing_id:c.id,p_visitor_id:visitorId()});if(!c.valid())return;
  const result=await db.rpc('austa_get_listing_detail_metadata',{p_source:c.source,p_listing_id:c.id});if(!c.valid())return;
  if(result.error){box.textContent='Elan statistikası hazırda əlçatan deyil.';return;}
  const row=Array.isArray(result.data)?result.data[0]:result.data;if(!row){box.textContent='Elan nömrəsi və baxış məlumatı mövcud deyil.';return;}
  box.replaceChildren();for(const [label,value] of [['№ ',row.public_number],['Baxışların sayı: ',Number(row.view_count).toLocaleString('az-AZ')],['Yeniləndi: ',date(row.updated_at)]]){if(value===null||value===undefined||value==='')continue;const span=document.createElement('span');span.textContent=label+value;box.append(span);}
 }catch{if(c.valid())box.textContent='Elan statistikası hazırda əlçatan deyil.';}
}
function dialog(page,title,body){const d=document.createElement('dialog');d.className='austa-v36-dialog';d.innerHTML=`<h2>${escape(title)}</h2>${body}`;page.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return d;}
function report(page,c){
 const d=dialog(page,'Elan barədə şikayət','<form data-v36-report-form><p>Müraciət bu elan üzrə moderator baxışına göndəriləcək.</p><label>Səbəb<select name="reason" required><option value="">Seçin</option><option value="incorrect_information">Yanlış məlumat</option><option value="misleading_price">Qiymət barədə yanıltma</option><option value="inappropriate_content">Uyğunsuz məzmun</option><option value="suspected_fraud">Dələduzluq şübhəsi</option><option value="other">Digər</option></select></label><label>Əlavə məlumat (istəyə bağlı)<textarea name="details" maxlength="2000"></textarea></label><div class="austa-v36-dialog-actions"><button type="button" data-v36-close>Bağla</button><button type="submit">Şikayəti göndər</button></div><p data-v36-status role="status"></p></form>');
 const form=d.querySelector('form'),status=d.querySelector('[data-v36-status]');d.querySelector('[data-v36-close]').onclick=()=>d.close();
 form.onsubmit=async e=>{e.preventDefault();const db=window.AUSTA_SUPABASE;if(!db?.auth||!db?.rpc){status.textContent='Şikayət xidməti hazırda əlçatan deyil.';return;}const submit=form.querySelector('[type=submit]');submit.disabled=true;status.textContent='Göndərilir…';try{const s=await db.auth.getSession();if(!c.valid())return;if(!s.data?.session?.user?.id){d.close();document.getElementById('headerAccountLink')?.click();return;}const r=await db.rpc('austa_report_listing',{p_source:c.source,p_listing_id:c.id,p_reason:form.elements.reason.value,p_details:form.elements.details.value.trim()});if(!c.valid())return;submit.disabled=false;status.textContent=r.error?'Şikayəti göndərmək mümkün olmadı. Yenidən cəhd edin.':'Şikayət qəbul edildi.';if(!r.error)setTimeout(()=>d.close(),900);}catch{if(c.valid()){submit.disabled=false;status.textContent='Şikayəti göndərmək mümkün olmadı. Yenidən cəhd edin.';}}};
}
async function priceHistory(page,c){
 const db=window.AUSTA_SUPABASE;if(!db?.rpc)return;const d=dialog(page,'Qiymət tarixçəsi','<div data-v36-history>Yüklənir…</div><div class="austa-v36-dialog-actions"><button type="button" data-v36-close>Bağla</button></div>');d.querySelector('[data-v36-close]').onclick=()=>d.close();const out=d.querySelector('[data-v36-history]');
 try{const r=await db.rpc('austa_get_listing_price_history',{p_source:c.source,p_listing_id:c.id});if(!c.valid()||!d.isConnected)return;out.textContent='';const rows=Array.isArray(r.data)?r.data:[];if(r.error||!rows.length){out.textContent='Bu elanın qiymət məlumatı mövcud deyil.';return;}rows.forEach((row,i)=>{const el=document.createElement('p'),delta=i?Number(row.price)-Number(rows[i-1].price):0,label=i?(delta>0?'Qiymət artıb':delta<0?'Qiymət azalıb':'Qiymət dəyişməyib'):'İlkin qeydə alınan qiymət';el.textContent=`${label} · ${Number(row.price).toLocaleString('az-AZ')} ${row.currency||'AZN'} · ${date(row.changed_at)}`;out.append(el);});}catch{if(c.valid()&&d.isConnected)out.textContent='Qiymət tarixçəsini yükləmək mümkün olmadı.';}
}
async function enhance(page){
 if(activePages.has(page))return;const c=context(page);if(!c)return;activePages.add(page);
 const result=await api.lookup(c.id,c.source);if(!c.valid())return;if(!result?.listing)return;const item=result.listing;
 installTitleActions(page,c,item);const metadata=installMetadata(page,c);compactSpecs(page);installContactAndPromotions(page,item);installFullscreen(page);if(metadata)void loadMetadata(page,c);
}
document.addEventListener('click',async event=>{
 const page=event.target.closest?.('#austaFinalListingPage');if(!page)return;const c=context(page);if(!c)return;
 const share=event.target.closest('[data-v36-share]');if(share){event.preventDefault();event.stopImmediatePropagation();return api.share(c.id,c.source,page.querySelector('.austa-final-title')?.textContent||'A-USTA elan');}
 const complaint=event.target.closest('[data-v36-report]');if(complaint){event.preventDefault();event.stopImmediatePropagation();return report(page,c);}
 const history=event.target.closest('[data-v36-price-history]');if(history){event.preventDefault();event.stopImmediatePropagation();return priceHistory(page,c);}
 const promotion=event.target.closest('[data-v36-promotion]');if(promotion){event.preventDefault();event.stopImmediatePropagation();try{const session=await window.AUSTA_SUPABASE?.auth?.getSession?.();if(!c.valid())return;if(!session?.data?.session?.user?.id){document.getElementById('headerAccountLink')?.click();return;}return api.promote(c.id,c.source,promotion.dataset.v36Promotion);}catch{if(c.valid())window.alert('Elan sahibi hesabını təsdiqləmək mümkün olmadı. Yenidən daxil olun.');return;}}
 const fullscreen=event.target.closest('[data-v36-fullscreen]');if(fullscreen){event.preventDefault();event.stopImmediatePropagation();const stage=fullscreen.closest('.austa-v147-main-stage');if(stage?.requestFullscreen)void stage.requestFullscreen().catch(()=>{});}
},true);
new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1){if(n.id==='austaFinalListingPage')void enhance(n);n.querySelectorAll?.('#austaFinalListingPage').forEach(page=>void enhance(page));}}).observe(document.body,{childList:true,subtree:true});
})();
