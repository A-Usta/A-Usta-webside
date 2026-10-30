/* Category advertising presentation only: no tracking, billing, remote configuration or backend writes. */
(function(){
'use strict';
const slots=['marketplace_top','marketplace_left','marketplace_right'];
const defaults=Object.freeze({rotationIntervalMs:10000,minIntervalMs:5000,maxIntervalMs:60000});
const house={
 marketplace_top:[
  {id:'austa-discover',active:true,headline:'Növbəti avtomobilini A-USTA-da tap.',description:'Real elanları araşdır, seçimlərini daralt, uyğun avtomobili tap.',action:'cars',actionLabel:'Avtomobil elanlarına bax'},
  {id:'austa-search',active:true,headline:'Seçimini dəqiqləşdir.',description:'Marka, model və büdcəyə uyğun avtomobil elanlarını bir yerdə araşdır.',action:'cars',actionLabel:'Avtomobil elanlarına bax'}
 ],
 marketplace_left:[
  {id:'austa-left-space',active:true,headline:'Burada sizin reklamınız ola bilər',description:'Brendinizi avtomobil auditoriyasına göstərin.'},
  {id:'austa-left-brand',active:true,headline:'Brendiniz üçün görünən yer',description:'A-USTA reklam sahəsi — gələcək kampaniyalar üçün.'}
 ],
 marketplace_right:[
  {id:'austa-right-space',active:true,headline:'Burada sizin reklamınız ola bilər',description:'Avtomobil dünyasına maraq göstərən auditoriyaya çatın.'},
  {id:'austa-right-brand',active:true,headline:'Yeni auditoriyaya yol açın',description:'A-USTA reklam sahəsi — gələcək kampaniyalar üçün.'}
 ]
};
let configuration={rotationIntervalMs:defaults.rotationIntervalMs,slotIntervals:{}};
const campaigns=new Map(),instances=new Set();
const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
const interval=value=>Number.isFinite(Number(value))?Math.min(defaults.maxIntervalMs,Math.max(defaults.minIntervalMs,Number(value))):defaults.rotationIntervalMs;
const safeUrl=value=>{if(typeof value!=='string'||!value.trim())return '';try{const url=new URL(value,location.href);return url.protocol==='https:'||(url.origin===location.origin&&url.protocol==='http:')?url.href:'';}catch{return '';}};
function normalize(item,index){
 if(!item||item.active!==true||typeof item.id!=='string'||!item.id||!String(item.headline||'').trim())return null;
 const start=item.startAt==null?null:Date.parse(item.startAt),end=item.endAt==null?null:Date.parse(item.endAt);
 if((start!==null&&!Number.isFinite(start))||(end!==null&&!Number.isFinite(end))||(start!==null&&end!==null&&start>=end))return null;
 return Object.freeze({id:item.id,advertiser:String(item.advertiser||'').slice(0,120),headline:String(item.headline).slice(0,160),description:String(item.description||'').slice(0,300),accessibilityLabel:String(item.accessibilityLabel||item.headline).slice(0,200),mediaType:['image','video'].includes(item.mediaType)?item.mediaType:'none',mediaUrl:safeUrl(item.mediaUrl),posterUrl:safeUrl(item.posterUrl),destinationUrl:safeUrl(item.destinationUrl),action:item.action==='cars'?'cars':'',actionLabel:String(item.actionLabel||'Ətraflı bax').slice(0,60),priority:Number.isFinite(item.priority)?item.priority:0,durationMs:item.durationMs==null?null:interval(item.durationMs),start,end,index});
}
function eligible(slot){const now=Date.now();const custom=(campaigns.get(slot)||[]).filter(c=>(c.start===null||c.start<=now)&&(c.end===null||c.end>now));return custom.length?custom:house[slot].map(normalize);}
const element=(tag,klass,text)=>{const node=document.createElement(tag);if(klass)node.className=klass;if(text)node.textContent=text;return node;};
function visible(state){return state.root.isConnected&&state.page.classList.contains('open')&&!document.hidden&&state.inView&&state.root.getClientRects().length>0;}
function clearTimer(state){clearTimeout(state.timer);clearTimeout(state.lifecycle);state.timer=null;state.lifecycle=null;}
function playback(state){const video=state.root.querySelector('video');if(!video)return;if(visible(state)&&!motion.matches&&!state.paused&&!state.hover&&!state.focus){void video.play().catch(()=>{});}else video.pause();}
function schedule(state){
 clearTimer(state);playback(state);
 if(!visible(state))return;
 const list=eligible(state.slot);const current=list.find(c=>c.id===state.id);
 if(!current){render(state,0);return;}
 const now=Date.now(),boundaries=(campaigns.get(state.slot)||[]).flatMap(c=>[c.start,c.end]).filter(t=>t!==null&&t>now);
 if(boundaries.length)state.lifecycle=setTimeout(()=>schedule(state),Math.min(2147483647,Math.max(1,Math.min(...boundaries)-now)));
 if(motion.matches||state.paused||state.hover||state.focus||list.length<2)return;
 const delay=current.durationMs||configuration.slotIntervals[state.slot]||configuration.rotationIntervalMs;
 state.timer=setTimeout(()=>{state.timer=null;if(!visible(state)||motion.matches||state.paused||state.hover||state.focus){schedule(state);return;}const next=eligible(state.slot);const index=next.findIndex(c=>c.id===state.id);render(state,next.length>1?(index+1)%next.length:Math.max(0,index));},delay);
}
function render(state,index=0){
 clearTimer(state);const old=state.root.querySelector('video');if(old){old.pause();old.removeAttribute('src');old.load();}
 const list=eligible(state.slot),campaign=list[index%list.length];state.id=campaign.id;
 const hadFocus=state.root.contains(document.activeElement),oldAction=hadFocus?document.activeElement.dataset.adControl:null;
 const label=element('div','aca-label','Reklam');
 if(campaign.advertiser)label.append(element('span','aca-advertiser',campaign.advertiser));
 const body=element('div','aca-body');const copy=element('div','aca-copy');copy.append(element('p','aca-eyebrow',state.slot==='marketplace_top'?'A-USTA · AVTOMOBİL BAZARI':'A-USTA'),element('h2','aca-headline',campaign.headline),element('p','aca-description',campaign.description));
 if(campaign.destinationUrl){const link=element('a','aca-cta',campaign.actionLabel);link.href=campaign.destinationUrl;link.target='_blank';link.rel='noopener noreferrer sponsored';link.dataset.adControl='cta';copy.append(link);}
 else if(campaign.action==='cars'){const button=element('button','aca-cta',campaign.actionLabel);button.type='button';button.dataset.adControl='cta';button.addEventListener('click',()=>state.onAction?.('cars'));copy.append(button);}
 body.append(copy);
 if(campaign.mediaUrl&&campaign.mediaType!=='none'){
  const media=element('div','aca-media');const node=document.createElement(campaign.mediaType==='video'?'video':'img');
  if(campaign.mediaType==='video'){node.muted=true;node.defaultMuted=true;node.playsInline=true;node.loop=true;node.preload='none';if(campaign.posterUrl)node.poster=campaign.posterUrl;node.setAttribute('aria-label',campaign.accessibilityLabel);}
  else{node.loading='lazy';node.decoding='async';node.alt=campaign.accessibilityLabel;}
  node.addEventListener('error',()=>{media.replaceChildren(element('span','aca-media-fallback','A-USTA'));});node.src=campaign.mediaUrl;media.append(node);body.append(media);
 }else if(state.slot==='marketplace_top'){
  const art=element('div','aca-art');art.setAttribute('aria-hidden','true');art.innerHTML='<span class="aca-road"></span><span class="aca-car"><i></i><b></b></span><span class="aca-art-name">A-USTA</span>';body.append(art);
 }
 const controls=element('div','aca-controls');const previous=element('button','','Əvvəlki reklam');previous.type='button';previous.dataset.adControl='previous';previous.addEventListener('click',()=>{const current=eligible(state.slot);render(state,(current.findIndex(c=>c.id===state.id)-1+current.length)%current.length);});
 const next=element('button','','Növbəti reklam');next.type='button';next.dataset.adControl='next';next.addEventListener('click',()=>{const current=eligible(state.slot);render(state,(current.findIndex(c=>c.id===state.id)+1)%current.length);});
 const pause=element('button','',state.paused?'Davam et':'Fasilə');pause.type='button';pause.dataset.adControl='pause';pause.setAttribute('aria-pressed',String(state.paused));pause.addEventListener('click',()=>{state.paused=!state.paused;pause.textContent=state.paused?'Davam et':'Fasilə';pause.setAttribute('aria-pressed',String(state.paused));schedule(state);});
 if(list.length>1)controls.append(previous,pause,next);
 state.root.replaceChildren(label,body,controls);state.root.dataset.campaignId=campaign.id;
 if(hadFocus&&oldAction)state.root.querySelector(`[data-ad-control="${oldAction}"]`)?.focus({preventScroll:true});
 schedule(state);
}
function mount(page,options={}){
 let existing=[...instances].find(s=>s.page===page);if(existing){for(const state of instances)if(state.page===page)state.onAction=options.onAction;return;}
 for(const slot of slots){
  const root=element('section','aca-slot '+(slot==='marketplace_top'?'aca-top':'aca-side '+(slot==='marketplace_left'?'aca-left':'aca-right')));root.dataset.adSlot=slot;root.setAttribute('aria-label',slot==='marketplace_top'?'Yuxarı reklam sahəsi':slot==='marketplace_left'?'Sol reklam sahəsi':'Sağ reklam sahəsi');
  if(slot==='marketplace_top')page.prepend(root);else page.append(root);
  const state={page,root,slot,id:null,inView:typeof IntersectionObserver!=='function',paused:false,hover:false,focus:false,onAction:options.onAction};instances.add(state);
  root.addEventListener('mouseenter',()=>{state.hover=true;schedule(state);});root.addEventListener('mouseleave',()=>{state.hover=false;schedule(state);});
  root.addEventListener('focusin',()=>{state.focus=true;schedule(state);});root.addEventListener('focusout',()=>{queueMicrotask(()=>{state.focus=root.contains(document.activeElement);schedule(state);});});
  if(typeof IntersectionObserver==='function'){state.observer=new IntersectionObserver(entries=>{state.inView=entries[0]?.isIntersecting===true;schedule(state);});state.observer.observe(root);}
  render(state);
 }
 const observer=new MutationObserver(()=>{for(const state of instances)if(state.page===page)schedule(state);});observer.observe(page,{attributes:true,attributeFilter:['class']});for(const state of instances)if(state.page===page)state.pageObserver=observer;
}
function setCampaigns(slot,items){if(!slots.includes(slot)||!Array.isArray(items))throw new Error('Reklam sahəsi və kampaniya siyahısı düzgün deyil.');const ids=new Set();const clean=items.map(normalize).filter(c=>c&&!ids.has(c.id)&&ids.add(c.id)).sort((a,b)=>b.priority-a.priority||a.index-b.index);campaigns.set(slot,clean);for(const state of instances)if(state.slot===slot)render(state);}
function configure(options={}){configuration={rotationIntervalMs:interval(options.rotationIntervalMs??configuration.rotationIntervalMs),slotIntervals:{...configuration.slotIntervals}};for(const slot of slots)if(options.slotIntervals?.[slot]!=null)configuration.slotIntervals[slot]=interval(options.slotIntervals[slot]);for(const state of instances)schedule(state);}
function dispose(page){for(const state of [...instances])if(state.page===page){clearTimer(state);state.observer?.disconnect();state.pageObserver?.disconnect();state.root.querySelector('video')?.pause();state.root.remove();instances.delete(state);}}
function refresh(){for(const state of [...instances]){if(!state.root.isConnected){dispose(state.page);continue;}schedule(state);}}
document.addEventListener('visibilitychange',refresh);window.addEventListener('resize',refresh,{passive:true});window.addEventListener('pagehide',()=>{for(const state of instances){clearTimer(state);state.root.querySelector('video')?.pause();}});window.addEventListener('pageshow',refresh);motion.addEventListener('change',refresh);
window.AUSTA_CATEGORY_CAMPAIGNS=Object.freeze({mount,setCampaigns,configure,dispose,defaults});
})();
