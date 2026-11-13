/* Shared presentation for footer and information pages; no messaging, network or persistence. */
(function(){
'use strict';
const config=window.AUSTA_SITE_CONFIG;
if(!config)return;
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
function mount(root=document){
 for(const n of root.querySelectorAll('[data-company-name]'))n.textContent=config.company.name;
 for(const host of root.querySelectorAll('[data-company-contact]')){
  if(host.dataset.contactBound==='1')continue;host.dataset.contactBound='1';
  const copy=node('div','austa-contact-copy');copy.append(node('strong','',config.company.name),node('p','',config.company.supportMessage));
  const links=node('div','austa-contact-links'),wa=node('a','austa-contact-whatsapp','WhatsApp · '+config.company.whatsapp),email=node('a','austa-contact-email',config.company.email);
  wa.href=config.company.whatsappHref;email.href=config.company.emailHref;
  const emailNote=node('small','austa-contact-email-note',config.company.emailVerified?'':'Email kanalı aktivləşdirmə gözləyir. Dəstək üçün WhatsApp-a yazın.');
  links.append(wa,email,emailNote);host.replaceChildren(copy,links);
 }
}
window.AUSTA_COMPANY_CONTACT=Object.freeze({mount});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>mount(),{once:true});else mount();
})();
