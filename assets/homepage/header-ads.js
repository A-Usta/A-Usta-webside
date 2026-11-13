/* V3.5.1 header/ad composition. Original controls, category cards and their listeners remain authoritative. */
(function(){
'use strict';
const script=document.currentScript,info=key=>new URL('../../info/index.html#'+key,script.src).href;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
function mount(){
 const header=document.getElementById('austaMainHeader'),row=header?.querySelector('.austa-main-header-row');if(!row||header.dataset.v351)return;
 header.dataset.v351='1';
 const utility=el('div','v351-utility'),inner=el('div','v351-utility-inner'),links=el('div','v351-support'),support=el('a','','Dəstək');support.href=info('contact');links.append(support);
 const help=document.getElementById('austaHeaderHelp');if(help)links.append(help);
 const actions=header.querySelector('.austa-header-actions'),search=header.querySelector('.austa-header-search'),location=document.getElementById('locationPicker'),account=document.getElementById('headerAccountLink'),tools=el('div','v351-tools');
 if(location)tools.append(location);if(actions)tools.append(actions);if(account)tools.append(account);
 inner.append(links);if(search)inner.append(search);inner.append(tools);utility.append(inner);header.prepend(utility);row.classList.add('v351-main-row');
 for(const [id,fallback]of [['austaHeaderCart','Səbət'],['austaHeaderMessages','Mesajlar'],['austaHeaderNotifications','Bildirişlər'],['austaHeaderHelp','Yardım']]){
  const button=document.getElementById(id);if(!button)continue;const label=el('span','v351-control-label');button.append(label);
  const sync=()=>{const title=button.getAttribute('title')||fallback;label.textContent=id==='austaHeaderHelp'&&title==='Kömək'?'Yardım':title;};sync();new MutationObserver(sync).observe(button,{attributes:true,attributeFilter:['title']});
 }
 const nav=el('nav','v351-category-nav');nav.setAttribute('aria-label','Elan kateqoriyaları');const primary=el('div','v351-primary'),more=el('details','v351-more'),summary=el('summary','','Digər kateqoriyalar'),menu=el('div','v351-category-menu');more.append(summary,menu);nav.append(primary,more);
 const add=document.getElementById('austaHeaderAddListing');if(add)row.insertBefore(nav,add);else row.append(nav);
 const entries=[...document.querySelectorAll('#austaV107ListingCategories [data-austa-v107-category]')].map(original=>{const button=el('button','',original.querySelector('.austa-v107-category-name')?.textContent.trim()||original.textContent.trim());button.type='button';button.dataset.v351Category=original.dataset.austaV107Category;button.addEventListener('click',()=>{more.open=false;original.click();});return button;});
 const compact=matchMedia('(max-width:1100px)'),mobile=matchMedia('(max-width:720px)');
 function arrange(){const keys=mobile.matches?[]:compact.matches?['cars','rent','parts']:['cars','rent','parts','accessories','service'];for(const button of entries)(keys.includes(button.dataset.v351Category)?primary:menu).append(button);summary.textContent=mobile.matches?'Kateqoriyalar':'Digər kateqoriyalar';more.open=false;}
 arrange();compact.addEventListener('change',arrange);mobile.addEventListener('change',arrange);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&more.open){const focused=more.contains(document.activeElement);more.open=false;if(focused)summary.focus();}});document.addEventListener('click',event=>{if(more.open&&!more.contains(event.target))more.open=false;});
 const top=el('div','v351-ad-host open');top.id='austaV351TopAd';top.setAttribute('aria-label','Yuxarı reklam yerləşimi');header.before(top);
 const sides=el('div','v351-ad-host open');sides.id='austaV351SideAds';sides.setAttribute('aria-label','Yan reklam yerləşimləri');header.after(sides);
 const campaigns=window.AUSTA_CATEGORY_CAMPAIGNS;if(campaigns){campaigns.mount(top,{placements:['marketplace_top'],onAction:()=>document.querySelector('#austaV107ListingCategories [data-austa-v107-category="cars"]')?.click()});campaigns.mount(sides);}
 function visibility(){const active=document.documentElement.dataset.v35Home!=='false';for(const host of [top,sides]){host.hidden=!active;host.classList.toggle('open',active);}}
 visibility();new MutationObserver(visibility).observe(document.documentElement,{attributes:true,attributeFilter:['data-v35-home']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
