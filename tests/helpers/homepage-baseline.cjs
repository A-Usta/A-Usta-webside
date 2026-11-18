// Exact V3.4 additions only. All older regression boundaries remain authoritative.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),digest=s=>createHash('sha256').update(s).digest('hex');
const suffix="\n<!-- V3.4 Home presentation; existing application contracts remain authoritative. -->\n<link rel=\"stylesheet\" href=\"assets/homepage/homepage.css\">\n<script src=\"assets/homepage/mobile-links.js\"></script>\n<script src=\"assets/homepage/company-contact.js\"></script>\n<script src=\"assets/homepage/homepage.js\"></script>\n";
const footer="<footer class=\"footer\" id=\"austaProfessionalFooter\"><div class=\"v34-footer-inner\"><strong>A-USTA</strong><p>Avtomobil d\u00fcnyas\u0131. Bir \u00fcnvanda.</p><nav aria-label=\"M\u0259lumat v\u0259 d\u0259st\u0259k\"><a href=\"info/index.html#about\">Haqq\u0131m\u0131zda</a><a href=\"info/index.html#contact\">\u018flaq\u0259</a><a href=\"info/index.html#services\">Xidm\u0259tl\u0259rimiz</a><a href=\"info/index.html#advertising\">Reklam yerl\u0259\u015fdirm\u0259</a><a href=\"info/index.html#agreement\">\u0130stifad\u0259\u00e7i raz\u0131la\u015fmas\u0131</a><a href=\"info/index.html#privacy\">M\u0259xfilik siyas\u0259ti</a><a href=\"info/index.html#rules\">Qaydalar</a><a href=\"info/index.html#listing-rules\">Elan yerl\u0259\u015fdirm\u0259 qaydalar\u0131</a><a href=\"info/index.html#help\">Yard\u0131m m\u0259rk\u0259zi</a><a href=\"info/index.html#faq\">Tez-tez veril\u0259n suallar</a><a href=\"info/index.html#technical-support\">Texniki d\u0259st\u0259k</a><a href=\"info/index.html#complaints\">\u015eikay\u0259t v\u0259 m\u00fcraci\u0259tl\u0259r</a><a href=\"info/index.html#brands\">Avtomobil markalar\u0131</a><a href=\"info/index.html#categories\">Avtomobil kateqoriyalar\u0131</a><a href=\"info/index.html#parts\">Ehtiyat hiss\u0259l\u0259ri</a><a href=\"info/index.html#service\">Avtoservisl\u0259r</a></nav></div></footer>",oldFooter="<footer class=\"footer\"><div class=\"footer-grid\"><div><div class=\"brand\"><span class=\"brand-logo brand-logo-full\">A-USTA</span><span class=\"brand-text\"><strong>A-USTA</strong><small>Avtomobiliniz \u00fc\u00e7\u00fcn h\u0259r \u015fey</small></span></div><p>A-USTA \u2014 avtomobil xidm\u0259tl\u0259ri, ehtiyat hiss\u0259l\u0259ri, elan v\u0259 n\u0259qliyyat xidm\u0259tl\u0259rini bir platformada birl\u0259\u015fdir\u0259n sistem.</p></div><div><h4>\u018fsas b\u00f6lm\u0259l\u0259r</h4><a href=\"#services\">Xidm\u0259tl\u0259r</a><a href=\"#austaAllFunctions\">Avtomobil bazar\u0131</a><a href=\"#austaAllFunctions\">Ehtiyat hiss\u0259l\u0259ri</a><a href=\"#austaAllFunctions\">Xaricd\u0259n sifari\u015f</a><a href=\"#austaAllFunctions\">Logistika</a></div><div><h4>M\u0259lumat</h4><a href=\"#austaAllFunctions\">Haqq\u0131m\u0131zda</a><a href=\"#austaAllFunctions\">\u0130stifad\u0259 \u015f\u0259rtl\u0259ri</a><a href=\"#austaAllFunctions\">M\u0259xfilik siyas\u0259ti</a><a href=\"#austaAllFunctions\">T\u0259r\u0259fda\u015fl\u0131q</a></div><div><h4>D\u0259st\u0259k</h4><a href=\"#austaAllFunctions\">FAQ</a><a href=\"#austaAllFunctions\">Canl\u0131 d\u0259st\u0259k</a><a href=\"tel:+994501234567\">+994 50 123 45 67</a><a href=\"mailto:support@a-usta.az\">support@a-usta.az</a></div><div><h4>T\u0259tbiql\u0259rimiz</h4><div class=\"apps\"><span class=\"app-badge\">\u25b6 Google Play</span><span class=\"app-badge\">\uf8ff App Store</span></div><p>\ud83c\udde6\ud83c\uddff Az\u0259rbaycan dili\u2304</p></div></div><div class=\"copyright\"><span>\u00a9 2026 A-USTA. B\u00fct\u00fcn h\u00fcquqlar qorunur.</span><span>Premium platform UI \u2022 Az\u0259rbaycan</span></div></footer>";
const v35suffix="<!-- V3.5 compact Home composition; original loaders and contracts retained. -->\n<link rel=\"stylesheet\" href=\"assets/homepage/premium-homepage.css\">\n<script src=\"assets/homepage/premium-homepage.js\"></script>\n";
const v351suffix="<!-- V3.5.1 header and Home advertising only. -->\n<link rel=\"stylesheet\" href=\"assets/homepage/header-ads.css\">\n<script src=\"assets/homepage/header-ads.js\"></script>\n";
const v352suffix="<!-- V3.5.2 header/search presentation; existing contracts retained. -->\n<link rel=\"stylesheet\" href=\"assets/homepage/header-search-polish.css\">\n<script src=\"assets/homepage/header-search-polish.js\"></script>\n";
const v353suffix="<!-- V3.5.3 service presentation and Home cleanup only. -->\n<link rel=\"stylesheet\" href=\"assets/homepage/service-experience.css\">\n<script src=\"assets/homepage/service-experience.js\"></script>\n";
const serviceExports=[["window.AUSTA_V54={openService,addCategoryImages};", "window.AUSTA_V54={openService,addCategoryImages,categories:Object.freeze(Object.keys(Q))};"], ["window.AUSTA_V55_PROTECTED={openProtected,lockOldUstaUI};", "window.AUSTA_V55_PROTECTED={openProtected,lockOldUstaUI,categories:Object.freeze(Object.keys(FORMS))};"]];
exports.withoutServiceCatalog=html=>{for(const [old,next]of serviceExports){if(html.includes(next)){assert.equal(html.split(next).length,2,"exact V3.5.3 catalog export");html=html.replace(next,()=>old);}else assert.equal(html.split(old).length,2,"exact V3.5.3 baseline catalog export");}return html;};
const v354suffix="<!-- V3.5.4 listing presentation; existing publication controller retained. -->\n<link rel=\"stylesheet\" href=\"assets/marketplace/listing-experience.css\">\n<script src=\"assets/marketplace/listing-experience.js\"></script>\n";
const v355suffix="<!-- V3.5.5 opt-in automotive map; existing service and listing controllers retained. -->\n<link rel=\"stylesheet\" href=\"assets/map/map.css\">\n<script src=\"assets/map/config.js\"></script>\n<script src=\"assets/map/data.js\"></script>\n<script src=\"assets/map/publication.js\"></script>\n<script src=\"assets/map/map.js\"></script>\n";
exports.normalize=html=>{const v36css='<link rel="stylesheet" href="assets/marketplace/listing-detail-v36.css">',v36js='<script src="assets/marketplace/listing-detail-v36.js"></script>';if(html.includes(v36css)){assert.equal(html.split(v36css).length,2,"exact V3.6 listing-detail stylesheet import");const line="\n"+v36css+"\n";assert.equal(html.split(line).length,2,"exact V3.6 stylesheet placement");html=html.replace(line,"\n");}if(html.includes(v36js)){assert.equal(html.split(v36js).length,2,"exact V3.6 listing-detail script import");assert.equal(html.split(v36js+"\n").length,2,"exact V3.6 script placement");html=html.replace(v36js+"\n","");}if(html.includes('\"public_service_provider_listings\"')){assert.equal(html.split('\"public_service_provider_listings\"').length,3,'exact two provider privacy read sites');html=html.replaceAll('\"public_service_provider_listings\"','\"service_provider_listings\"');}if(html.includes("<!-- V3.5.5 opt-in automotive map")){assert(html.endsWith(v355suffix),"final suffix: exact V3.5.5 suffix");assert.equal(html.split(v355suffix).length,2);html=html.slice(0,-v355suffix.length);}if(html.includes("<!-- V3.5.4 listing presentation")){assert(html.endsWith(v354suffix),"final suffix: exact final V3.5.4 suffix");assert.equal(html.split(v354suffix).length,2);html=html.slice(0,-v354suffix.length);}if(html.includes("<!-- V3.5.3 service")){assert(html.endsWith(v353suffix),"final suffix: exact V3.5.3 suffix");assert.equal(html.split(v353suffix).length,2);html=exports.withoutServiceCatalog(html.slice(0,-v353suffix.length));}if(html.includes("<!-- V3.5.2 header/search")){assert(html.endsWith(v352suffix),"final suffix: exact V3.5.2 suffix");assert.equal(html.split(v352suffix).length,2);html=html.slice(0,-v352suffix.length);}if(html.includes('<!-- V3.5.1 header')){assert(html.endsWith(v351suffix),'final suffix: exact V3.5.1 suffix');assert.equal(html.split(v351suffix).length,2);html=html.slice(0,-v351suffix.length);}if(html.includes('<!-- V3.5 compact Home')){assert(html.endsWith(v35suffix),'final suffix: exact V3.5 suffix');assert.equal(html.split(v35suffix).length,2);html=html.slice(0,-v35suffix.length);}if(!html.includes('<!-- V3.4 Home presentation;'))return html;assert.equal(html.split(suffix).length,2,'exact unique V3.4 bootstrap');assert(html.endsWith(suffix),'V3.4 bootstrap is final suffix');assert.equal(html.split(footer).length,2,'exact unique V3.4 fallback footer');return html.slice(0,-suffix.length).replace(footer,()=>oldFooter);};
const files={
 ".github/workflows/v356-cloudflare-test.yml": "77cbcefae544d721b6da36e341f21896052c74531c69fe8ac941b395b81325c5",
 "tools/geoapify/cloudflare/.gitignore": "2f21d2245886c2ee7c64b5b515976d29bad0baed47b5fb9e23ff8779179a4393",
 "tools/geoapify/cloudflare/README.md": "3befe6f44a8023a8ca1a4fb7fdd7c5ad1f03f0c1b5a14b354d710d1c87a4dc64",
 "tools/geoapify/cloudflare/build.py": "da718022b30c6f2001c6790581a75a32b7e22a474d9da21f8816002cb67efb55",
 "tools/geoapify/cloudflare/live-qa.cjs": "3765f8de500b4f5bc53c0a6e55a805c9cbc16e2e3557d9bb8cd3f430c0327751",
 "tools/geoapify/cloudflare/package-lock.json": "5f7e7394010ba4d91de44f5f07d0e571e02812bfc266773d1565ffc21ce67681",
 "tools/geoapify/cloudflare/package.json": "87806f4ff58f064988e93a4192a385b40a414144d16bcc8752685b4ad3368cf9",
 "tools/geoapify/cloudflare/policy.mjs": "9ea15cfd7c5ae600c835308caf45147b09bf6fbdc5d5eddbcbf6c030d477ef5a",
 "tools/geoapify/cloudflare/test/policy.test.mjs": "b0897362d8e59d748ed7b1129d43342617ca1394b75a7fd7f5eb668a00da0093",
 "tools/geoapify/cloudflare/test/runtime.test.mjs": "592a3e86154ce643f331e79128abad0777551e624dad9453ddfde4fd0c322f3d",
 "tools/geoapify/cloudflare/test-providers.js": "83641ae7c08f87711839b720a87285edac67b363edf68e3a70f6dc55763dd1f9",
 "tools/geoapify/cloudflare/test/hosted-provider-rollback.sql": "87a26bfeddbeefef53496f0868c38294ab38c7365d80fcca799d73d002af6a81",
 "tools/geoapify/cloudflare/PAGES-RELEASE.md": "c54b1bf15269327450c2025038d9d90d95d5542ef461997e7f65d5a6118db76d",
 "tools/geoapify/cloudflare/worker.mjs": "b9c816fb0d4657241af057461afc7c32b624eb511a2d85ed7f54606611126ea0",

 "tools/geoapify/proxy/requirements-test-host.txt": "61faa20900c365a53e5bc060644b5c1b9a278a1058a5615ef11ea752648c2c0a",
 "tools/geoapify/proxy/prepare_preview.py": "a0362214e2883a6b6e791c76b5dc1cf3b01d61a84f2a46f6178d05a6fe60ab78",
 "tools/geoapify/proxy/gunicorn_config.py": "b1d2c6fa12d7d80562906b3b2845e38c75c977a90a88151b31d01010e6fde42e",
 "tools/geoapify/proxy/wsgi.py": "5dbd1e9d14bec1547db4ae7b999e086cdbcc1eb607d6e309133b661c896ca274",
 "tools/geoapify/proxy/test-config.example.json": "5d17fb5da3f61d1561f59d9d8b8967863450cbac6596ad22bf9db1b3eff2444d",
 "tools/geoapify/proxy/TEST-HOST.md": "4378b278ad76950046f6179e77bca7f6bce5c5c37283c5de8f7cb2f98782cb28",
 "tools/geoapify/proxy/BOUNDARY.md": "6d031adbe6c544e9c251e9fe0189b2d26534f4d170d9396a62019d1525dbb2b2",
 "tools/geoapify/proxy/aze-adm0.geojson": "8578487282384781be5bf87fb4d4fe0635c1323a2bec08cd331f67f8122266fc",
 "tools/geoapify/proxy/test_app.py": "334ff8e80d8814359b6dfee6b08324f17904ba5d149a3314b1030cb2d0c03cfc",
 "tools/geoapify/proxy/sessions.py": "9483792dc420e7a45b7de120165fc564117d206289716ff882e0f717f0a95aa3",
 "tools/geoapify/proxy/__init__.py": "cda1b46582b300b220b48ce656e27192badd257705b0c3999497279db5c772de",
 "tools/geoapify/proxy/core.py": "6c113c7c47b4ec9292907dd539657089aad48cdaa683a4dfb2324cb2c5732f75",
 "tools/geoapify/proxy/app.py": "b77cf7186662f805b1227650546210201561066e6b39bae58d13e2a365a0118f",
 "tools/geoapify/proxy/README.md": "a45376ddf3fe58a6bfbba068728fbc33bfa259d0e27c4282c161a033d8dc5d9c",
 "tools/geoapify/live.cjs": "010e5c7371950ad2833fe3fc376324dee974a1947aa75fa47bdd400ad8c7a541",
 "tools/geoapify/preview.cjs": "777d113a18b2062f06e9756f4e5a4188cda3e73c038b0de5e248e7a7a368774b",
 "assets/map/runtime-config.example.json": "90712b980f316c47221df67ab69172cdcad97c6cea05813211da9694c78753d6",
 "tools/build-map-runtime-config.cjs": "bf8fb6e2d5a25b377ecccee47acf4eedb083d5193eeb5f6b83f9ad383f1867e0",
 "tests/hosted/check_environment.py": "fbc390ab9878ddede023bf17aeb9b0758cf0bfb0132c6cff36998fb2dec944c1",
 "tests/hosted/run_cas.py": "38eebec02934622928cf968711adb2be4d99dc9f5c215a42483dbf54024d242a",
 ".github/workflows/v355-hosted-cas.yml": "73c6e3db27701f445aae8f41a2c991b38eb0b46f79b2a35b784384e31378cab4",
 ".github/workflows/v355-security.yml": "130e581506372ac50ed4fb4787bca3c7d92a3bf37dce1e7cdfcfd08d0b6e8966",
 "supabase/migrations/20261117090000_v355_map_publication_cas.sql": "560222a53a0840a82b98f7ca4327d37e08f00757a784bcbbf9bbbd58f1c3320d",
 "supabase/migrations/20261114132329_v355_provider_location_privacy.sql": "6819d31972685dd601cb8ada708748c75b99896c458ee543bd766a0e7dd4982a",
 "assets/marketplace/listing-detail.js": "05469b1100b0c904e108002fb5e00bd1fac2573e70d792385bb8936a506d35c2",
 "supabase/migrations/20261114072012_v355_public_provider_discovery.sql": "e654873b2ede0f4c393eda28a9e178fc26dcec7afbb8e3cfba9682eb593ebfd7",
 "assets/vendor/leaflet-1.9.4/leaflet.js": "4f1ac3296897403e0a84881c974dbdf36d9a8488f0ef4b5626a952b1b6190d80",
 "assets/vendor/leaflet-1.9.4/leaflet.css": "4362440f28a49a41de5b1f52f98a5d503f50ac19ffef89de3bc21178c5c6633a",
 "assets/vendor/leaflet-1.9.4/README.md": "1b9db23e599d52adcb72245fef3e942e1abe6443c3ecf8f141546278c101f14c",
 "assets/vendor/leaflet-1.9.4/LICENSE": "bbc959aaef7488b38942e7f05cfd1244351f8bce54261951ea17dd7cf60f894b",
 "assets/map/publication.js": "275f252764e1e7b9538252be0eac7bb7935b0962b9b758da49ad1613982c537e",
 "assets/map/map.js": "6f0941970c8758720ac5eb8688482594257aedc15d15d511d53f1261586a0553",
 "assets/map/map.css": "cc9d5ca39488fbf619881b36b27cad4ea5292df4a5d9d758a209edcfc8c3ab35",
 "assets/map/data.js": "273ef6a47cf544d99ec8567b06d61f40e2854a864424071b679ffb1f4b1d3d0e",
 "assets/map/config.js": "09f8c9393a4222bffb59df07bfe54aa0135b8358353d6c6e97c77ad5238d8d91",
  "assets/marketplace/listing-experience.css": "cb81ba715229fdb8316893c8b380359357a6b2f99adaeeb11a3bd1c31facae95",
  "assets/marketplace/listing-experience.js": "b4d703b1950aa21d39fff75438efb3e641cfd7edba7a9a6456bf6694c4734d36",
  "assets/homepage/service-experience.css": "318fa417f541c77ef58ef04b35f33a5a4dffc8059cca9a78c46f1964b1aa3b44",
  "assets/homepage/service-experience.js": "56f2acd569a377539b08c1d6d6114200f53ab271fddf3f630b014a9f4afd74ac",
  "assets/homepage/header-search-polish.js": "0dc18e961f8af2ad0686cdc3d3a6c9be2b75fe101b2c78077cd0953a10b2f98d",
  "assets/homepage/header-search-polish.css": "a444231719876956e73563cc3d31a2309f7dc5c9e74658be36d51ccb81d3eed8",
  "assets/homepage/header-ads.css": "dc8528b1d82b2e2e64f9bab6d905f4b84c9af8e3a8f09df0dae87ea55b7b1ade",
  "assets/homepage/header-ads.js": "862ccf1b589398ea70ade5bcaf80b5322e3a4376d4775e435d8d851f6e4b4275",
  "assets/marketplace/category-campaigns.js": "48e9c3ebc6d67f4be494bfe0c49c417e38d33b76428898ff9ae770c9faea5df3",

  "assets/homepage/premium-homepage.css": "fc55a06349ce701e9368eca14ebb2cd2fbb53fedbfe1583aa9c16b81592dfbfa",
  "assets/homepage/premium-homepage.js": "8dffa44c2e41a1b4e87d13bdcf930a51143cee4c68188278e577323653bbd7ad",

  "assets/homepage/company-contact.js": "20f454b6a3dc8ac6eeff2f9d70d563b8e5430d1961a723d98048f8ca2260cc9f",
  "assets/homepage/homepage.css": "b4083ada4aa123c5c1cd661777aaa1129fa6b54bbb9ec8dfd6ea03f95c7b0d91",
  "assets/homepage/homepage.js": "e390071e730aec68681b4074683a66d6b101a4ca2697d9d6d038c821eb806086",
  "assets/homepage/mobile-links.js": "f34151a63f2bfdc6f7ac580a59f1162e5701394a33904627daab04dbe77efc8a",
  "assets/homepage/mobile-preview.webp": "65ddacf11241fcfe0ed32cf21e1872e3b15cbd32a4ca3fe8b1246220d476c231",
  "assets/homepage/website-qr.png": "35cd532af33dfccaad80fa7fcf5374e7df6db50c0a0604b16c698b5bc270124f",
  "assets/marketplace/listing-detail-v36.css": "6e2aa6d0ff417b5bb1b06cc216a9af6dae068bfb583a487e366836efa85ee84e",
  "assets/marketplace/listing-detail-v36.js": "45787322ddb42a9d7c59002b947dac99e888da71318f417979e755737534e232"
};
exports.reviewed=files;
files["supabase/migrations/20261118100000_v36_listing_detail_metrics.sql"]="ee2be4047eabcad19afb25cd10ce900b4c199673502c828f53d4987ddcf836c3";
exports.isReviewedFile=p=>{if(!Object.hasOwn(files,p))return false;assert.equal(digest(fs.readFileSync(path.join(root,p))),files[p],'exact reviewed V3.4 file: '+p);return true;};
exports.verify=()=>{for(const p of Object.keys(files))exports.isReviewedFile(p);};

const campaignFrom=" // Existing category callers retain side-only placement; Home explicitly opts into TOP.\n if(options.placements!==undefined&&!Array.isArray(options.placements))throw new Error('Reklam yerl\u0259\u015fimi d\u00fczg\u00fcn deyil.');\n const placementSlots=options.placements===undefined?slots.filter(slot=>slot!=='marketplace_top'):[...new Set(options.placements)].filter(slot=>slots.includes(slot));\n for(const slot of placementSlots){",campaignTo=" // Category pages currently mount only side placements; keep TOP campaign support for future placement.\n for(const slot of slots.filter(slot=>slot!=='marketplace_top')){";
exports.normalizeCampaigns=text=>{if(!text.includes(campaignFrom))return text;assert.equal(text.split(campaignFrom).length,2,"exact reviewed placement opt-in");return text.replace(campaignFrom,()=>campaignTo);};
