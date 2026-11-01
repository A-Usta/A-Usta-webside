// Remove only the reviewed additive P1.2B presentation wiring for older byte baselines.
// Original detail logic (including public status guards/contact handling) stays compared.
exports.withoutSellerPresentation=html=>html
 .replace('<script src="assets/marketplace/seller-intent.js"></script>\n','')
 .replace('<script src="assets/marketplace/media-manager.js"></script>\n','')
 .replace('const sellerIdentityReady=Promise.resolve(window.AUSTA_SELLER_IDENTITY?.hydrate([item]));','void window.AUSTA_SELLER_IDENTITY?.hydrate([item]);')
 .replace('              <div data-professional-seller></div>\n','')
 .replace(`  void sellerIdentityReady.then(()=>{
    if(!page.isConnected)return;
    const target=page.querySelector('[data-professional-seller]');
    if(target)target.innerHTML=window.AUSTA_SELLER_INTENT?.detail(item)||'';
  }).catch(()=>{});\n`,'');

// P1.3A changes only this owner-delete function in the older account script.
// Its real runtime wiring/security is exercised by media-contract.test.cjs.
exports.withBaselineOwnerDelete=(html,base)=>{
 const start='async function austaMyDelete(item) {';
 const section=text=>{const a=text.indexOf(start);const b=text.indexOf('/* ============================================================',a);if(a<0||b<0)throw new Error('owner delete baseline boundary missing');return text.slice(a,b);};
 return exports.withBaselineMediaHydration(html.replace(section(html),()=>section(base)),base);
};

// P1.3B's narrow cover-aware hydration correction is runtime-tested separately.
exports.withBaselineMediaHydration=(html,base)=>{
 const section=text=>{const a=text.indexOf('async function hydrateSupabaseListingMedia(item)');const b=text.indexOf('\nfunction imagePaths(item)',a);if(a<0||b<0)throw new Error('media hydration baseline boundary missing');return text.slice(a,b);};
 return html.replace(section(html),()=>section(base));
};
