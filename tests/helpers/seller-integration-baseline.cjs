// Remove only the reviewed additive P1.2B presentation wiring for older byte baselines.
// Original detail logic (including public status guards/contact handling) stays compared.
exports.withoutSellerPresentation=html=>html
 .replace('<script src="assets/marketplace/seller-intent.js"></script>\n','')
 .replace('<script src="assets/marketplace/media-manager.js"></script>\n','')
 .replace('<script src="assets/marketplace/listing-preview.js"></script>\n','')
 .replace('<script src="assets/marketplace/listing-lifecycle.js"></script>\n','')
 .replace(/\n\/\* P1\.5A My Listings \*\/[\s\S]*?\/\* \/P1\.5A My Listings \*\//,'')
 .replace('window.AUSTA_LISTING_PRESENTATION=Object.freeze({vehicleSpecs:carSpecs,marketplaceSpecs});\n','')
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
 html=exports.withBaselineLifecycle(html,base);
 const start='async function austaMyDelete(item) {';
 const section=text=>{const a=text.indexOf(start);const b=text.indexOf('/* ============================================================',a);if(a<0||b<0)throw new Error('owner delete baseline boundary missing');return text.slice(a,b);};
 return exports.withBaselineMediaHydration(html.replace(section(html),()=>section(base)),base);
};

// P1.3B's narrow cover-aware hydration correction is runtime-tested separately.
exports.withBaselineMediaHydration=(html,base)=>{
 const section=text=>{const a=text.indexOf('async function hydrateSupabaseListingMedia(item)');const b=text.indexOf('\nfunction imagePaths(item)',a);if(a<0||b<0)throw new Error('media hydration baseline boundary missing');return text.slice(a,b);};
 return html.replace(section(html),()=>section(base)).replace('window.AUSTA_LISTING_PRESENTATION=Object.freeze({vehicleSpecs:carSpecs,marketplaceSpecs});\n','');
};

// P1.5A changes only owner lifecycle/list rendering and its account-page wiring.
// Restore these exact seams for older byte baselines; listing-lifecycle.test.cjs executes
// their real implementation. Delete, canonical EDIT routing and detail stay compared.
exports.withBaselineLifecycle=(html,base)=>{
 const restore=(start,end,oldStart=start)=>{
  const a=html.indexOf(start),b=html.indexOf(end,a),c=base.indexOf(oldStart),d=base.indexOf(end,c);
  if(a<0||b<0||c<0||d<0)throw new Error('P1.5 baseline boundary missing: '+start);
  html=html.slice(0,a)+base.slice(c,d)+html.slice(b);
 };
 restore('function austaMyStatusLabel(status) {','function austaMyPromotionLabel(item) {');
 restore('async function austaMyLoadListings(', '/* ------------------------------------------------------------\n   Render');
 restore('function austaMyRenderListings(listings) {','/* ------------------------------------------------------------\n   Find current listing');
 if(html.includes('async function austaMyTransition('))restore('async function austaMyTransition(', '/* ------------------------------------------------------------\n   DELETE','async function austaMyToggle(');
 restore("   if (page === 'listings') {"," if (page === 'orders') {");
 const authStart='if (\n  window.AUSTA_SUPABASE?.auth\n)';
 if(html.includes('window.AUSTA_MY_LIFECYCLE?.bindAuth();'))restore('window.AUSTA_MY_LIFECYCLE?.bindAuth();','/* Initial real load */',authStart);
 html=html.replace("    try{window.AUSTA_LISTING_MEDIA?.assertLifecycleIdle(item?.__austa_table,item?.id);}"+'\n'+"    catch(error){alert(error.message);return;}"+'\n','');
 html=html.replace("\n    if(event.target.closest('[data-austa-my-retry]')){await austaMyLoadListings();return;}\n",'');
 html=html.replaceAll('[data-austa-my-transition]','[data-austa-my-toggle]');
 html=html.replace("await austaMyTransition(item, event.target.closest('[data-austa-my-toggle]').dataset.austaMyTransition);",'await austaMyToggle(item);');
 html=html.replace('  transition(item, action) {\n    return austaMyTransition(item, action);\n  },','  toggle(item) {\n    return austaMyToggle(item);\n  },');
 html=html.replace('  state: () => window.AUSTA_MY_LIFECYCLE?.state(),\n','');
 const guard=`async function austaV157Open(item, initialPackageType = 'boost') {
  try{
    if(!window.AUSTA_MY_LIFECYCLE)throw new Error('Elan statusu yoxlanıla bilmədi.');
    item=await window.AUSTA_MY_LIFECYCLE.authorizePromotion(item);
  }catch(error){if(error.code!=='LIFECYCLE_STALE')alert(error.message);return;}
`;
 html=html.replace(guard,"function austaV157Open(item, initialPackageType = 'boost') {");
 return html;
};
