/* V169D: canonical Home brand discovery and public active-sale RPC counts. */
(function(){
'use strict';
const catalog=window.AUSTA_VEHICLE_CATALOG;
let root,counts=null,cachedAt=0,pending=null,generation=0,authClient;
function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
function render(){
  if(!root)return;
  const grid=root.querySelector('.austa-v169d-grid');grid.replaceChildren();
  for(const brand of catalog.brands){
    const button=node('button');button.type='button';button.className='austa-v169d-brand';
    button.append(node('span',brand),node('b',counts ? '('+String(counts.get(brand) ?? 0)+')' : '(—)'));
    button.addEventListener('click',()=>window.AUSTA_V151_MARKETPLACE?.openCategory('cars',{brand}));grid.append(button);
  }
}
function bindAuth(client){
  if(authClient===client)return;authClient=client;
  client.auth?.onAuthStateChange?.(()=>{invalidate();});
}
function load(force=false){
  if(pending)return pending;
  const client=window.AUSTA_SUPABASE;
  if(!client)return Promise.resolve();
  bindAuth(client);
  if(!force && counts && Date.now()-cachedAt<60000){render();return Promise.resolve();}
  const version=generation;
  const status=root?.querySelector('[role="status"]');
  if(status)status.textContent='Elan sayı yüklənir...';
  if(root)root.querySelector('.austa-v169d-retry').hidden=true;
  pending=(async()=>{
    try{
      const {data,error}=await client.rpc('vehicle_sale_brand_counts');
      if(version!==generation)return;
      if(error)throw error;
      if(!Array.isArray(data))throw new Error('Invalid count response');
      const next=new Map();
      for(const row of data){
        if(!catalog.brands.includes(row.brand))continue;
        const value=Number(row.count);
        if(!Number.isSafeInteger(value)||value<0)throw new Error('Invalid brand count');
        next.set(row.brand,value);
      }
      counts=next;cachedAt=Date.now();if(status)status.textContent='';render();
    }catch(error){
      if(version!==generation)return;
      counts=null;cachedAt=0;render();
      if(status)status.textContent='Elan sayını yükləmək mümkün olmadı.';
      if(root)root.querySelector('.austa-v169d-retry').hidden=false;
    }
  })().finally(()=>{pending=null;if(version!==generation && root && !root.hidden)load();});
  return pending;
}
function invalidate(){generation++;counts=null;cachedAt=0;render();if(root && !root.hidden && !pending)load();}
function mount(){
  const feed=document.getElementById('austaV151Marketplace');if(!feed || !catalog)return;
  if(!root){
    root=node('section');root.id='austaV169DBrandCatalog';root.setAttribute('aria-labelledby','austaV169DBrandHeading');
    const heading=node('h2','Avtomobil markaları');heading.id='austaV169DBrandHeading';
    const status=node('p');status.setAttribute('role','status');
    const grid=node('div');grid.className='austa-v169d-grid';
    const retry=node('button','Yenidən cəhd et');retry.type='button';retry.className='austa-v169d-retry';retry.hidden=true;retry.addEventListener('click',()=>load(true));
    root.append(heading,status,retry,grid);
    // Existing support/main-sections area is the single footer.footer.
    const support=document.querySelector('footer.footer');
    if(support){
      support.after(root);
    }else{
      feed.after(root);
    }
    root.hidden=false;
  }
  render();load();
}
window.AUSTA_V169D=Object.freeze({mount,invalidate,refresh:()=>load(true),setHomeVisible(){if(!root)mount();if(root){root.hidden=false;load();}}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
