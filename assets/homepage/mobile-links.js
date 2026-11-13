/* Single public configuration: owner-approved identity, contacts and inactive future destinations. */
(function(){
'use strict';
const email='austa@a-usta.az',whatsapp='+994 99 234 27 62';
const website='https://a-usta.github.io/A-Usta-webside/',futureDomain='a-usta.az';
window.AUSTA_SITE_CONFIG=Object.freeze({
 company:Object.freeze({name:'A-USTA MMC',email,emailHref:'mailto:'+email,whatsapp,whatsappHref:'https://wa.me/'+whatsapp.replace(/\D/g,''),supportMessage:'Yalnız WhatsApp vasitəsilə — bizə yazın, sizə köməklik göstərək!',emailVerified:false}),
 website,currentWebsite:website,futureDomain,futureWebsite:'https://'+futureDomain+'/',domainOwned:false,customDomainActive:false,
 footerDisclaimer:'Saytın administrasiyası reklam bannerlərinin və yerləşdirilmiş elanların məzmununa görə məsuliyyət daşımır.'
});
window.AUSTA_MOBILE_LINKS=Object.freeze({
 website:window.AUSTA_SITE_CONFIG.website,
 universalLink:'',androidAppLink:'', // Reserved only: no app routing or domain activation.
 stores:Object.freeze([
  Object.freeze({name:'App Store',platform:'iOS üçün',host:'apps.apple.com',published:false,url:'',badge:'',artworkApproved:false}),
  Object.freeze({name:'Google Play',platform:'Android üçün',host:'play.google.com',published:false,url:'',badge:'',artworkApproved:false}),
  Object.freeze({name:'AppGallery',platform:'HarmonyOS üçün',host:'appgallery.huawei.com',published:false,url:'',badge:'',artworkApproved:false})
 ])
});
})();
