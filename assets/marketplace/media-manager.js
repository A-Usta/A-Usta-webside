/* P1.3B: edit-only media UI. Canonical paths/ownership stay inside the media API. */
(function(){
'use strict';
let active=null;
const api=()=>window.AUSTA_LISTING_MEDIA;
function current(s,revision=s.revision){
    return active===s && !s.closed && s.revision===revision && s.root.isConnected!==false &&
        document.getElementById('austaV153CFields')===s.root && window.AUSTA_SUPABASE===s.client;
}
function el(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
function button(label,run,disabled){const node=el('button',label);node.type='button';node.disabled=Boolean(disabled);node.addEventListener('click',run);return node;}
function dispose(){
    const s=active;if(!s)return;
    active=null;s.closed=true;s.revision++;
    if(s.handle)api()?.close(s.handle);
    s.subscription?.unsubscribe();s.observer?.disconnect();
    for(const url of s.localUrls.values())URL.revokeObjectURL(url);
    s.localUrls.clear();
}
function files(root){
    const s=active;if(!s || s.root!==root)return null;
    if(!current(s) || s.busy || !s.handle || s.rows===null)throw new Error('Media hazır deyil. Yüklənməni gözləyin və ya yenidən yoxlayın.');
    return {images:[...s.pending.images],videos:[...s.pending.videos],managerToken:s.token};
}
function assertContext(token){if(!active || active.token!==token || !current(active))throw new Error('Media forması dəyişib.');}
function persisted(file,id,token){
    const s=active;if(!s || s.id!==id || s.token!==token || !current(s))return;
    for(const kind of ['images','videos'])s.pending[kind]=s.pending[kind].filter(value=>value!==file);
    const url=s.localUrls.get(file);if(url){URL.revokeObjectURL(url);s.localUrls.delete(file);}
}
async function operate(s,action){
    if(!current(s) || s.busy || !s.handle)return;
    s.busy=true;s.message='Media əməliyyatı davam edir…';const revision=++s.revision;render(s);
    try{
        const rows=await action();if(!current(s,revision))return;
        s.rows=rows;s.message='Media dəyişiklikləri saxlanıldı.';
    }catch(error){
        if(!current(s,revision))return;
        // Never keep an optimistic cover/order after a failed multi-row operation.
        s.rows=Array.isArray(error.mediaState)?error.mediaState:null;
        s.message=error.code==='MEDIA_OPERATION_FAILED'?error.message:'Media yenilənmədi. Hesabı və bağlantını yoxlayın.';
    }finally{if(current(s,revision)){s.busy=false;render(s);}}
}
function localPreview(s,file){
    if(!s.localUrls.has(file))s.localUrls.set(file,URL.createObjectURL(file));
    return s.localUrls.get(file);
}
function render(s){
    if(!current(s))return;
    s.box.replaceChildren();s.box.appendChild(el('h3','Şəkillər və videolar'));
    const status=el('p',s.message);status.setAttribute('role','status');status.setAttribute('aria-live','polite');s.box.appendChild(status);
    const unavailable=s.busy || !s.handle || s.rows===null;
    if(s.handle)s.box.appendChild(button('Önizləmələri yenilə',()=>operate(s,()=>api().refresh(s.handle)),s.busy));
    const grid=el('div');grid.className='austa-media-manager-grid';s.box.appendChild(grid);
    for(const [i,row] of (s.rows || []).entries()){
        const card=el('div');card.className='austa-media-manager-card';grid.appendChild(card);
        card.appendChild(el('strong',row.media_type==='video'?'Video':row.is_cover?'Əsas şəkil':'Şəkil'));
        if(row.previewUrl){
            const preview=el(row.media_type==='video'?'video':'img');preview.src=row.previewUrl;
            if(row.media_type==='video'){preview.controls=true;preview.preload='metadata';}else preview.alt='Elan şəkli';
            preview.addEventListener('error',()=>{if(current(s)){s.message='Önizləmə açılmadı. Önizləmələri yeniləyin.';status.textContent=s.message;}});
            card.appendChild(preview);
        }else card.appendChild(el('p','Faylın önizləməsi alınmadı; media vəziyyətini yeniləyin.'));
        const controls=el('div');card.appendChild(controls);
        controls.appendChild(button('Sil',()=>{
            if(window.confirm('Bu medianı silmək istəyirsiniz?'))void operate(s,()=>api().remove(s.handle,row.id));
        },unavailable));
        if(row.media_type==='image')controls.appendChild(button('Əsas şəkil et',()=>operate(s,()=>api().cover(s.handle,row.id)),unavailable || row.is_cover));
        for(const [step,label] of [[-1,'← Əvvələ'],[1,'Sonraya →']])controls.appendChild(button(label,()=>{
            const ids=s.rows.map(item=>item.id),other=i+step;[ids[i],ids[other]]=[ids[other],ids[i]];
            return operate(s,()=>api().reorder(s.handle,ids));
        },unavailable || i+step<0 || i+step>=s.rows.length));
    }
    s.box.appendChild(el('h4','Yeni media əlavə et'));
    for(const kind of ['images','videos']){
        if(kind==='videos' && s.type==='plate')continue;
        const label=el('label',kind==='images'?'Şəkillər':'Video');const input=el('input');
        input.type='file';input.accept=kind==='images'?'image/*':'video/*';input.multiple=kind==='images';input.disabled=unavailable;
        input.id=kind==='images'?'austaV153DImages':'austaV153DVideo';
        input.addEventListener('change',()=>{
            if(!current(s) || s.busy)return;
            s.pending[kind].push(...Array.from(input.files || []));input.value='';render(s);
        });label.appendChild(input);s.box.appendChild(label);
    }
    for(const kind of ['images','videos'])for(const file of s.pending[kind]){
        const pending=el('div');pending.className='austa-media-manager-card';pending.appendChild(el('span','Yeni: '+file.name));
        if(String(file.type).startsWith('image/') || String(file.type).startsWith('video/')){
            const preview=el(kind==='images'?'img':'video');preview.src=localPreview(s,file);if(kind==='videos'){preview.controls=true;preview.preload='metadata';}else preview.alt='Yeni şəkil';pending.appendChild(preview);
        }
        pending.appendChild(button('Sil',()=>{
            s.pending[kind]=s.pending[kind].filter(item=>item!==file);const url=s.localUrls.get(file);
            if(url){URL.revokeObjectURL(url);s.localUrls.delete(file);}render(s);
        },unavailable));s.box.appendChild(pending);
    }
    s.box.appendChild(button('Yeni medianı yüklə',()=>{
        // Copy pending files before any async call, just as a normal form save does.
        const snapshot={images:[...s.pending.images],videos:[...s.pending.videos],managerToken:s.token};
        return operate(s,()=>api().append(s.handle,snapshot));
    },unavailable || !s.pending.images.length && !s.pending.videos.length));
    const help=el('p','Mövcud media ayrıca saxlanılır. Silmə, əsas şəkil və sıra dəyişiklikləri dərhal tətbiq olunur.');s.box.appendChild(help);
}
async function mount(root,type,id){
    dispose();if(!root || !id || !api())return;
    if(!document.getElementById('austaMediaManagerStyle')){
        const style=el('style');style.id='austaMediaManagerStyle';style.textContent='.austa-media-manager-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.austa-media-manager-card{border:1px solid #ddd;border-radius:10px;padding:10px;min-width:0;margin:8px 0}.austa-media-manager-card img,.austa-media-manager-card video{width:100%;max-height:170px;object-fit:contain;background:#f7f7f7}.austa-media-manager-card button{min-height:40px;margin:4px;padding:6px 10px}.austa-media-manager-card strong{display:block;margin-bottom:6px}';document.head.appendChild(style);
    }
    let box=document.getElementById('austaV153CMediaBox');if(!box || !root.contains(box)){box=el('section');box.id='austaV153CMediaBox';root.appendChild(box);}
    const s={root,box,type,id,token:Object.freeze({}),client:window.AUSTA_SUPABASE,handle:null,rows:null,pending:{images:[],videos:[]},localUrls:new Map(),busy:true,closed:false,revision:0,message:'Media yüklənir…'};
    active=s;render(s);
    const auth=s.client?.auth;
    if(auth?.onAuthStateChange)s.subscription=auth.onAuthStateChange(event=>{
        if(event==='INITIAL_SESSION' || active!==s)return;
        s.message='Hesab sessiyası dəyişdi. Redaktə formasını yenidən açın.';s.rows=null;s.busy=true;
        if(s.handle)api().close(s.handle);render(s);dispose();
    })?.data?.subscription;
    if(typeof MutationObserver!=='undefined'){
        s.observer=new MutationObserver(()=>{if(active===s && !current(s))dispose();});s.observer.observe(document.body,{childList:true,subtree:true});
    }
    const revision=s.revision;
    try{
        const result=await api().open(type,id);
        if(!current(s,revision)){api().close(result.handle);return;}
        s.handle=result.handle;s.rows=result.rows;s.message=result.rows.length?'Mövcud media':'Bu elanda hələ media yoxdur.';
    }catch{if(current(s,revision)){s.message='Media yüklənmədi. Formanı yenidən açaraq təkrar yoxlayın.';s.rows=null;}}
    finally{if(current(s,revision)){s.busy=false;render(s);}}
}
window.AUSTA_MEDIA_MANAGER=Object.freeze({mount,dispose,files,persisted,assert:assertContext});
})();
