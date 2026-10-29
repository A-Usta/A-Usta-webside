/* A-USTA V169A — one Vehicle/Rent create/edit selector. */
(function(){
'use strict';
const catalog=window.AUSTA_VEHICLE_CATALOG;
const norm=value=>String(value || '').normalize('NFKC').toLocaleLowerCase('az-AZ');
let closeActive=()=>{};
function element(tag,className,text){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
}
function visual(brand,model){
  const box=element('span','austa-v169-visual',model ? 'M' : brand.split(/[\s-]+/).map(word=>word[0]).slice(0,2).join('').toUpperCase());
  box.setAttribute('aria-hidden','true');
  const assets=window.AUSTA_VEHICLE_ASSETS;
  const path=model ? assets.models[brand]?.[model] : assets.brands[brand];
  // Explicit local manifest only. Reject traversal, protocol URLs and unapproved roots.
  if(typeof path==='string' && /^assets\/vehicle\/[a-z0-9_./-]+\.(svg|png|webp|jpg|jpeg)$/i.test(path)
      && !path.includes('..') && !path.includes('//')){
    const img=document.createElement('img');
    img.alt='';
    img.onload=()=>{box.replaceChildren(img);};
    img.onerror=()=>{img.remove();};
    img.src=path;
  }
  return box;
}
function mount(container){
  const brand=container.querySelector('[data-v153c-key="brand"]');
  const model=container.querySelector('[data-v153c-key="model"]');
  if(!brand || !model || brand.dataset.v169Bound)return;
  function change(input,value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
  function open(kind,trigger){
    closeActive(false);
    if(kind==='model' && !brand.value){open('brand',trigger);return;}
    const selectedBrand=catalog.resolveBrand(brand.value) || brand.value;
    const root=element('div','austa-v169-overlay');
    const dialog=element('div','austa-v169-dialog');
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','austaV169Title');
    const head=element('div','austa-v169-head');
    const title=element('h2','',kind==='brand' ? 'Marka seçin' : selectedBrand+' — Model seçin');title.id='austaV169Title';
    const close=element('button','austa-v169-close','×');close.type='button';close.setAttribute('aria-label','Seçim panelini bağla');
    head.append(title,close);
    const search=element('input','austa-v169-search');search.type='search';search.placeholder='Axtarış';search.setAttribute('aria-label',kind==='brand'?'Marka axtarışı':'Model axtarışı');
    const status=element('div','austa-v169-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const list=element('div','austa-v169-results');
    dialog.append(head,search,status,list);root.append(dialog);document.body.append(root);
    let closed=false;
    const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    function dismiss(restore=true){
      if(closed)return;closed=true;root.remove();document.body.style.overflow=oldOverflow;
      trigger.setAttribute('aria-expanded','false');
      if(restore && trigger.isConnected)trigger.focus();
      if(closeActive===dismiss)closeActive=()=>{};
    }
    closeActive=dismiss;trigger.setAttribute('aria-expanded','true');
    function choose(value){
      if(kind==='brand'){
        if(brand.value!==value){change(brand,value);change(model,'');}
        dismiss(false);open('model',model);
      }else{change(model,value);dismiss();}
    }
    function section(label,values){
      if(!values.length)return;
      const heading=element('h3','',label);const grid=element('div','austa-v169-grid');
      values.forEach(value=>{
        const button=element('button','austa-v169-option');button.type='button';
        const selected=kind==='brand' ? norm(brand.value)===norm(value) : model.value===value;
        button.setAttribute('aria-pressed',String(selected));
        button.append(visual(kind==='brand'?value:selectedBrand,kind==='model'?value:null),element('span','austa-v169-name',value));
        if(selected)button.append(element('span','austa-v169-check','✓'));
        button.onclick=()=>choose(value);grid.append(button);
      });list.append(heading,grid);
    }
    function draw(){
      const query=norm(search.value.trim());list.replaceChildren();
      let values=kind==='brand' ? [...catalog.brands] : [...(catalog.models[selectedBrand] || [])];
      // Keep existing out-of-catalog edit values without inventing a new model list.
      const current=kind==='brand'?brand.value:model.value;
      if(current && !values.includes(current))values.push(current);
      values=values.filter(value=>norm(value).includes(query)).sort((a,b)=>a.localeCompare(b,'az'));
      status.textContent=values.length+' nəticə';
      if(kind==='brand' && !query)section('Populyar markalar',catalog.popular);
      section(kind==='brand'?'Bütün markalar':'Modellər',values);
      if(!values.length)list.append(element('p','austa-v169-empty','Nəticə tapılmadı.'));
    }
    search.oninput=draw;
    close.onclick=()=>dismiss();root.onclick=event=>{if(event.target===root)dismiss();};
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss();return;}
      const buttons=[...list.querySelectorAll('button')];const index=buttons.indexOf(document.activeElement);
      if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key) && (index>=0 || document.activeElement===search)){
        if(document.activeElement===search && !['ArrowDown','ArrowUp'].includes(event.key))return;
        event.preventDefault();
        let step=event.key==='ArrowLeft' || event.key==='ArrowUp' ? -1 : 1;
        if(index>=0 && ['ArrowDown','ArrowUp'].includes(event.key))step*=getComputedStyle(buttons[index].parentElement).gridTemplateColumns.split(' ').length;
        const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:index<0?(step>0?0:buttons.length-1):Math.max(0,Math.min(buttons.length-1,index+step));
        buttons[next]?.focus();
      }
      if(event.key==='Enter' && document.activeElement===search){event.preventDefault();buttons[0]?.click();}
      if(event.key==='Tab'){
        const focusable=[close,search,...buttons];const first=focusable[0],last=focusable.at(-1);
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    draw();search.focus();
  }
  for(const [input,kind] of [[brand,'brand'],[model,'model']]){
    input.dataset.v169Bound='1';input.readOnly=true;
    input.classList.add('austa-v169-trigger');
    input.placeholder=kind==='brand'?'Markanı seçin':'Modeli seçin';
    input.setAttribute('role','button');input.setAttribute('aria-label',kind==='brand'?'Marka seçin':'Model seçin');
    input.setAttribute('aria-haspopup','dialog');input.setAttribute('aria-expanded','false');
    input.onclick=()=>open(kind,input);
    input.onkeydown=event=>{if(['Enter',' ','ArrowDown'].includes(event.key)){event.preventDefault();open(kind,input);}};
  }
}
window.AUSTA_VEHICLE_SELECTOR=Object.freeze({mount,close:()=>closeActive()});
})();
