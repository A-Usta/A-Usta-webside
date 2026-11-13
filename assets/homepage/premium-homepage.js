/* V3.5 composition only: retain existing nodes, listeners, data loaders and identifiers. */
(function(){
'use strict';
function mount(){
 const home=document.getElementById('home'),search=document.getElementById('austaHomeSearch');
 if(!home||!search)return;
 const promotion=document.getElementById('austaMobilePromotion');
 if(promotion){promotion.querySelector('h2').textContent='Hər şey bir tətbiqdə!';promotion.querySelector('.v34-mobile-copy>p:not(.v34-kicker)').textContent='A-USTA ilə elanları, avtomobillərinizi və servis tarixçənizi bir yerdən idarə edin.';}
 function arrange(){
  const market=document.getElementById('austaV151Marketplace');if(!market)return false;
  search.after(market);market.setAttribute('aria-labelledby','v35PremiumTitle');
  if(!document.getElementById('v35PremiumTitle')){const h=document.createElement('h2');h.id='v35PremiumTitle';h.textContent='Premium elanlar';market.prepend(h);const state=document.createElement('p');state.className='v35-premium-state';state.setAttribute('role','status');h.after(state);
   const update=()=>{const grid=document.getElementById('austaV151PremiumGrid'),loader=document.getElementById('austaV151Loader'),retry=document.getElementById('austaV169ERetry'),end=document.getElementById('austaV151End');const loading=loader?.classList.contains('show'),failed=retry&&!retry.hidden,finished=end?.classList.contains('show');const text=grid?.children.length||loading?'':failed?'Premium elanlar yüklənə bilmədi. Yenidən cəhd edin.':finished?'Hazırda göstəriləcək Premium elan yoxdur.':'';if(state.textContent!==text)state.textContent=text;if(state.hidden!==!text)state.hidden=!text;};
   new MutationObserver(update).observe(market,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden']});update();
  }return true;
 }
 if(!arrange()){const wait=new MutationObserver(()=>{if(arrange())wait.disconnect();});wait.observe(document.body,{childList:true,subtree:true});}
 function scope(){const category=document.getElementById('austaV151CategoryPage');document.documentElement.dataset.v35Home=category?.classList.contains('open')?'false':'true';}
 scope();const category=document.getElementById('austaV151CategoryPage');if(category)new MutationObserver(scope).observe(category,{attributes:true,attributeFilter:['class']});
 document.addEventListener('click',()=>requestAnimationFrame(scope));window.addEventListener('hashchange',scope);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
