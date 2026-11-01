/* P1.4: local CREATE review. Persistence stays in the existing publish pipeline. */
(function(){
'use strict';
let active=null,epoch=0;
const approvals=new WeakMap();
const blank=value=>value==null || typeof value==='string'&&(!value.trim()||['undefined','null','N/A'].includes(value.trim()));
function copy(value){
    if(Array.isArray(value))return Object.freeze(value.map(copy));
    if(value&&typeof value==='object')return Object.freeze(Object.fromEntries(Object.entries(value).map(([key,v])=>[key,copy(v)])));
    return value;
}
function sameFiles(a,b){return ['images','videos'].every(kind=>a[kind].length===b[kind].length&&a[kind].every((file,i)=>file===b[kind][i]));}
function current(s){
    try{return active===s && !s.closed && s.epoch===epoch && s.client===window.AUSTA_SUPABASE &&
        s.root?.isConnected!==false && document.getElementById('austaV153CFields')===s.root &&
        s.isCurrent() && sameFiles(s.files,{images:[...(document.getElementById('austaV153DImages')?.files||[])],videos:[...(document.getElementById('austaV153DVideo')?.files||[])]});}
    catch{return false;}
}
async function actor(client){
    const user=await client?.auth?.getUser(),session=await client?.auth?.getSession?.();
    if(user?.error || session?.error || !user?.data?.user?.id)throw new Error('Elanı yayımlamaq üçün hesabınıza daxil olun.');
    return user.data.user.id+':'+(session?.data?.session?.access_token||'');
}
function close(s){
    if(s.closed)return;s.closed=true;
    if(active===s)active=null;
    s.subscription?.unsubscribe();s.observer?.disconnect();
    for(const [node,event,handler] of s.listeners)node.removeEventListener(event,handler,true);
    for(const url of s.urls)URL.revokeObjectURL(url);
    for(const [node,inert] of s.background)node.inert=inert;
    if(s.dialog.open && s.dialog.close)s.dialog.close();s.dialog.remove();
    document.body.style.overflow=s.previousOverflow;
    s.focus?.focus?.();s.resolve(null);
}
function cancel(){const s=active;if(!s){epoch++;return;}if(!s.publishing){epoch++;close(s);}}
function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
function action(label,callback){const el=node('button',label);el.type='button';el.addEventListener('click',callback);return el;}
function display(s){
    const title=['cars','rent'].includes(s.type)?[s.input.brand,s.input.model,s.input.year].filter(v=>!blank(v)).join(' ')
        :s.type==='dealer'?s.values.dealer_name:s.input.title||s.input.name||s.label;
    const amount=s.type==='rent'?s.input.daily_price:s.input.price;
    const price=typeof amount==='number'&&Number.isFinite(amount)?new Intl.NumberFormat('az-AZ',{maximumFractionDigits:2}).format(amount)+' AZN'+(s.type==='rent'?' / gün':''):'';
    const omitted=new Set(['price','daily_price','description','about','region_address','region','district','address','name','contact_name','phone','message_contact']);
    const rows=[];
    for(const field of s.fields){
        const [key,label,kind,options=[]]=field;
        if(omitted.has(key))continue;
        let value=s.values[key];
        // Technical damage inputs are represented canonically after readFields().
        if(key.startsWith('damage_'))value=s.input.damage_condition?.[key.slice(7)];
        if(blank(value)||typeof value==='object')continue;
        if(typeof value==='boolean')value=value?'Bəli':'Xeyr';
        if(kind==='select'){
            const option=options.find(option=>String(Array.isArray(option)?option[0]:option)===String(value));
            if(option===undefined)continue;
            value=Array.isArray(option)?option[1]:option;
        }
        if(typeof value==='boolean')value=value?'Bəli':'Xeyr';
        if(key==='deposit')value=String(value)+' AZN';
        rows.push([label,String(value)]);
    }
    const mapper=window.AUSTA_LISTING_PRESENTATION;
    const mapped=['cars','rent'].includes(s.type)?mapper?.vehicleSpecs({...s.input,listing_type:s.type==='rent'?'rent':'sale'})
        :!['dealer','service','usta'].includes(s.type)?mapper?.marketplaceSpecs({...s.input,category:s.type}):null;
    const presented=mapped ? [...mapped] : rows;
    if(['cars','rent'].includes(s.type)&&!blank(s.input.vin))presented.push(['VIN-kod',String(s.input.vin)]);
    if(s.type==='rent'&&!blank(s.input.deposit))presented.push(['Depozit',new Intl.NumberFormat('az-AZ',{maximumFractionDigits:2}).format(s.input.deposit)+' AZN']);
    const location=[s.input.region||s.values.region,s.input.district||s.values.district,s.input.address||s.values.address].filter(v=>!blank(v)).join(' / ');
    const contact=[s.input.contact_name||s.values.contact_name||s.values.name,s.input.phone||s.values.phone,s.values.message_contact].filter(v=>!blank(v)).join(' · ');
    return {title,price,rows:presented,location,contact,description:s.input.description||s.input.about||s.values.description||s.values.about||''};
}
function render(s){
    const view=display(s);s.dialog.appendChild(node('h2','Elana ön baxış'));s.dialog.appendChild(node('p',s.label));
    const media=node('div');media.className='austa-preview-media';s.dialog.appendChild(media);
    for(const [kind,files] of [['image',s.files.images],['video',s.files.videos]])for(const [i,file] of files.entries()){
        const figure=node('figure'),preview=node(kind==='image'?'img':'video'),url=URL.createObjectURL(file);s.urls.push(url);preview.src=url;
        if(kind==='image')preview.alt='Elan şəkli';else{preview.controls=true;preview.preload='metadata';}
        figure.appendChild(preview);figure.appendChild(node('figcaption',kind==='image'?(i===0?'Əsas şəkil':'Şəkil'):'Video'));media.appendChild(figure);
    }
    s.dialog.appendChild(node('h3',view.title));if(view.price)s.dialog.appendChild(node('strong',view.price));
    const specs=node('dl');for(const [label,value] of view.rows){specs.appendChild(node('dt',label));specs.appendChild(node('dd',value));}s.dialog.appendChild(specs);
    for(const [heading,value] of [['Təsvir',view.description],['Yerləşmə',view.location],['Əlaqə',view.contact]])if(!blank(value)){s.dialog.appendChild(node('h3',heading));s.dialog.appendChild(node('p',value));}
    s.dialog.appendChild(node('h3','Satıcı'));
    if(s.seller){s.dialog.appendChild(node('strong',s.seller.display_name));s.dialog.appendChild(node('p',[s.seller.business_label,'Təsdiqlənmiş',s.seller.official?'Rəsmi':''].filter(Boolean).join(' · ')));}
    else s.dialog.appendChild(node('p','Şəxsi elan'));
    s.status=node('p','Məlumatları yoxlayıb elanı yayımlayın.');s.status.setAttribute('role','status');s.status.setAttribute('aria-live','polite');s.dialog.appendChild(s.status);
    const controls=node('div');controls.className='austa-preview-actions';
    s.back=action('Redaktə et',()=>{if(!s.publishing){epoch++;close(s);}});
    s.publish=action('Elanı yayımla',()=>{
        if(s.publishing || s.confirmed || s.closed)return;
        if(!current(s)){s.status.textContent='Forma dəyişib. Yenidən ön baxış açın.';s.publish.disabled=true;return;}
        s.publishing=true;s.confirmed=true;s.back.disabled=true;s.publish.disabled=true;
        s.status.textContent='Elan yayımlanır…';s.resolve(s.approval);
    });
    controls.appendChild(s.back);controls.appendChild(s.publish);s.dialog.appendChild(controls);
}
async function review(options){
    cancel();if(active)throw new Error('Əvvəlki yayımlama davam edir.');
    const start=++epoch,client=window.AUSTA_SUPABASE,key=await actor(client);
    if(start!==epoch || client!==window.AUSTA_SUPABASE || !options.isCurrent())throw new Error('Forma dəyişib. Yenidən ön baxış açın.');
    if(!document.getElementById('austaListingPreviewStyle')){
        const style=node('style');style.id='austaListingPreviewStyle';style.textContent='.austa-listing-preview{box-sizing:border-box;width:min(760px,calc(100vw - 24px));max-height:90dvh;overflow:auto;border:0;border-radius:16px;padding:24px;background:white;color:#18251e}.austa-listing-preview::backdrop{background:#0009}.austa-listing-preview dl{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}.austa-listing-preview dd{margin:0}.austa-preview-media{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}.austa-preview-media figure{margin:0}.austa-preview-media img,.austa-preview-media video{width:100%;max-height:240px;object-fit:contain}.austa-preview-actions{display:flex;flex-wrap:wrap;gap:12px;position:sticky;bottom:0;background:white;padding-top:14px}.austa-preview-actions button{min-height:44px;padding:10px 18px;border-radius:9px;border:1px solid #087d3b;cursor:pointer}.austa-preview-actions button:last-child{background:#087d3b;color:white}.austa-listing-preview p,.austa-listing-preview dd{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:500px){.austa-listing-preview{padding:16px}.austa-listing-preview dl{grid-template-columns:1fr}.austa-preview-actions button{flex:1}}';document.head.appendChild(style);
    }
    const dialog=node('dialog');dialog.className='austa-listing-preview';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','Elana ön baxış');dialog.setAttribute('aria-modal','true');
    const s={type:options.type,input:copy(options.input),values:copy(options.values),fields:copy(options.fields),label:options.label,
        files:Object.freeze({images:Object.freeze([...options.files.images]),videos:Object.freeze([...options.files.videos])}),seller:copy(options.seller),sellerIntent:options.sellerIntent,
        root:options.root,isCurrent:options.isCurrent,client,key,epoch:start,dialog,urls:[],listeners:[],background:[],closed:false,publishing:false,confirmed:false,used:false,focus:document.activeElement,previousOverflow:document.body.style.overflow,approval:Object.freeze({})};
    const promise=new Promise(resolve=>s.resolve=resolve);approvals.set(s.approval,s);active=s;if(!current(s)){active=null;throw new Error('Forma və ya media dəyişib. Yenidən ön baxış açın.');}render(s);document.body.appendChild(dialog);
    for(const child of document.body.children)if(child!==dialog){s.background.push([child,Boolean(child.inert)]);child.inert=true;}
    document.body.style.overflow='hidden';if(dialog.showModal)dialog.showModal();else{dialog.setAttribute('open','');dialog.style.cssText='position:fixed;inset:5vh auto auto 50%;transform:translateX(-50%);z-index:2147483647';}
    const invalidate=()=>{if(!s.publishing){epoch++;close(s);}};
    for(const [el,event] of [[s.root,'input'],[s.root,'change'],[document.getElementById('austaV153CCategory'),'change']])if(el){el.addEventListener(event,invalidate,true);s.listeners.push([el,event,invalidate]);}
    dialog.addEventListener('cancel',event=>{event.preventDefault();invalidate();});
    dialog.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();invalidate();}
        if(event.key==='Tab'){
            const buttons=Array.from(s.dialog.querySelectorAll('button,video')).filter(button=>!button.disabled);if(!buttons.length){event.preventDefault();return;}
            if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}
            else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}
        }
    });
    const subscription=client.auth.onAuthStateChange?.((_event,session)=>{const next=(session?.user?.id||'')+':'+(session?.access_token||'');if(next!==s.key&&!s.publishing){epoch++;close(s);}});s.subscription=subscription?.data?.subscription;
    if(typeof MutationObserver!=='undefined'){s.observer=new MutationObserver(()=>{if(!s.publishing&&!current(s)){epoch++;close(s);}});s.observer.observe(document.body,{childList:true,subtree:true});}
    s.back.focus?.();return promise;
}
async function consume(token,type){
    const s=approvals.get(token);
    if(!s || s.used || !s.confirmed || s.type!==type || !current(s))throw new Error('Ön baxış artıq aktual deyil. Formanı yenidən yoxlayın.');
    s.used=true;
    if(await actor(s.client)!==s.key || !current(s))throw new Error('Hesab və ya forma dəyişib. Yenidən yoxlayın.');
    return {input:s.input,values:s.values,files:s.files,sellerIntent:s.sellerIntent};
}
function failure(token,error){const s=approvals.get(token);if(!s||active!==s||s.closed)return;if(!current(s)){close(s);return;}s.publishing=false;s.back.disabled=false;s.publish.disabled=true;s.status.textContent=error?.message||'Elan yayımlanmadı. Redaktəyə qayıdıb yenidən yoxlayın.';}
function success(token,result){const s=approvals.get(token);if(!s||active!==s||s.closed)return;if(!current(s)){close(s);return;}const listing=result?.listing||result?.data||result;if(!listing?.id)return;s.publishing=false;s.publish.disabled=true;s.back.disabled=false;s.back.textContent='Bağla';s.status.textContent='✓ Elan uğurla yerləşdirildi. Elan № '+listing.id;}
window.AUSTA_LISTING_PREVIEW=Object.freeze({review,consume,cancel,failure,success});
})();
