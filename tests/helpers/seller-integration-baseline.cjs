// Remove only the reviewed additive P1.2B presentation wiring for older byte baselines.
// Original detail logic (including public status guards/contact handling) stays compared.
exports.withoutSellerPresentation=html=>html
 .replace('<script src="assets/marketplace/seller-intent.js"></script>\n','')
 .replace('const sellerIdentityReady=Promise.resolve(window.AUSTA_SELLER_IDENTITY?.hydrate([item]));','void window.AUSTA_SELLER_IDENTITY?.hydrate([item]);')
 .replace('              <div data-professional-seller></div>\n','')
 .replace(`  void sellerIdentityReady.then(()=>{
    if(!page.isConnected)return;
    const target=page.querySelector('[data-professional-seller]');
    if(target)target.innerHTML=window.AUSTA_SELLER_INTENT?.detail(item)||'';
  }).catch(()=>{});\n`,'');
