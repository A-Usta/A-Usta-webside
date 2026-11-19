'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),js=read('assets/marketplace/service-company-v37.js'),css=read('assets/marketplace/service-company-v37.css');
const migration=read('supabase/migrations/20261119210000_v37_service_company_public_details.sql');
const types=['leasing','insurance','sober_driver'];

test('V3.7 category routes, form adapter and detail contract are connected to existing provider listing',()=>{
 for(const type of types){
  assert.match(html,new RegExp('key:"'+type+'"'));
  assert.match(html,new RegExp(type+': "'));
  assert.match(html,new RegExp('contains\\("details",\\{service_category:type\\}\\)'));
 }
 assert.match(html,/SERVICE_COMPANY_TYPES=new Set\(\["leasing","insurance","sober_driver"\]\)/);
 assert.match(html,/providerTypeForCategory=type=>SERVICE_COMPANY_TYPES\.has\(type\)\?"service":type/);
 assert.match(html,/service_provider_listings,item\.details\?\.service_category \|\| item\.provider_type/);
 assert.match(html,/type=item\.details\?\.service_category \|\| item\.provider_type/);
 assert.match(html,/service-company-v37\.js/);
 assert.match(html,/service-company-v37\.css/);
 assert.match(read('assets/marketplace/card-data.js'),/leasing','insurance','sober_driver/);
 assert.match(read('assets/marketplace/seller-intent.js'),/leasing:'service',insurance:'service',sober_driver:'service'/);
});

test('each category has its own questions and no invented quotation values',()=>{
 const expected={
  leasing:['company_name','tax_id','legal_name','phone','email','website','city','service_area','vehicle_categories','vehicle_condition','customer_types','minimum_down_payment','minimum_term','maximum_term','rate','interest_type','currency','minimum_financing','maximum_financing','guarantor_required','income_proof_required','required_documents','terms','license_reference'],
  insurance:['company_name','tax_id','phone','email','website','city','service_area','insurance_types','coverage','franchise','contract_months','payment_methods','installments_available','online_application','claims_support','repair_network','exclusions','license_reference','license_disclosure'],
  sober_driver:['company_name','tax_id','phone','city','service_area','service_24_7','working_hours','minimum_order_price','rate_per_km','rate_per_hour','night_rate','city_service','intercity_service','advance_booking','urgent_service','driver_experience','payment_methods','waiting_fee','special_conditions']
 };
 for(const [type,fields] of Object.entries(expected)){
  const start=js.indexOf(type+':{label:');assert(start>=0,type);
  const end=js.indexOf('\n};',start);const block=js.slice(start,end<0?js.length:end);
  for(const key of fields)assert.ok(block.includes("['"+key+"'"),type+' missing '+key);
 }
 assert.doesNotMatch(js,/value:\s*(?:[0-9]+(?:\.[0-9]+)?|[0-9]+%)/);
 const filters=read('assets/marketplace/category-filters.js');for(const key of ['leasing','insurance','sober_driver'])assert.match(filters,new RegExp(key+':\\{title:[^\\n]*detail\\(\\'city\\''));
 assert.match(html,/Qiymət və təminat yekun sığorta təklifi deyil/);
 assert.match(html,/platforma tərəfindən yoxlanılmayıb/);
});

test('public view preserves V355 RLS, owner fields and consent-gated contact/location',()=>{
 assert.match(migration,/CREATE OR REPLACE VIEW public\.public_service_provider_listings/);
 assert.match(migration,/security_barrier=true,security_invoker=false/);
 assert.match(migration,/v355_provider_public_visible\(l\.id\)/);
 assert.match(migration,/m\.enabled AND m\.consent AND m\.consent_at IS NOT NULL/);
 assert.match(migration,/CASE WHEN l\.owner_id=auth\.uid\(\) THEN l\.details ELSE/);
 for(const key of ['service_category','company_name','tax_id','vehicle_categories','insurance_types','license_reference','rate_per_km','waiting_fee'])assert.ok(migration.includes("'"+key+"'"));
 assert.doesNotMatch(migration,/CREATE POLICY|DROP POLICY|ALTER POLICY|ENABLE ROW LEVEL SECURITY/i);
 assert.match(migration,/CREATE OR REPLACE VIEW/);
});

test('V3.7 forms render and stay within desktop/mobile widths; checklist values round-trip',async t=>{
 let browser;
 try{const launch={args:['--no-sandbox','--disable-dev-shm-usage']};if(process.env.AUSTA_CHROMIUM_EXECUTABLE_PATH)launch.executablePath=process.env.AUSTA_CHROMIUM_EXECUTABLE_PATH;browser=await chromium.launch(launch);}
 catch(e){t.skip('Chromium əlçatan deyil: '+e.message.split('\n')[0]);return;}
 try{
  const page=await browser.newPage({viewport:{width:1536,height:1100}});
  await page.setContent(`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}body{margin:0;background:#f6f7f6;color:#202622;font:14px Arial}#austaV153COverlay{position:fixed;inset:0;padding:20px;overflow:auto;display:flex;justify-content:center;align-items:flex-start}#austaV153CModal{width:min(920px,100%);background:#fff;border:1px solid #e3e6e4;border-radius:16px;padding:22px}#austaV153CFields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.austa-v153c-field{min-width:0}.austa-v153c-field>label,.austa-v153c-field>legend{display:block;margin-bottom:6px;font-weight:700}.austa-v153c-field input:not([type=checkbox]),.austa-v153c-field select,.austa-v153c-field textarea{width:100%;min-height:42px;border:1px solid #d8ded9;border-radius:8px;padding:9px;background:#fff}.austa-v153c-field textarea{min-height:80px}.full{grid-column:1/-1}@media(max-width:600px){#austaV153COverlay{padding:8px}#austaV153CModal{padding:13px;border-radius:12px}#austaV153CFields{grid-template-columns:minmax(0,1fr)}}${css}</style><body><section id="austaV107ListingCategories"><div class="austa-v107-category-grid"></div></section><div id="austaV153COverlay"><main id="austaV153CModal"><h2>Elan yerləşdir</h2><select id="austaV153CCategory"></select><section id="austaV153CFields"></section></main></div></body></html>`);
  await page.evaluate(()=>window.AUSTA_V153C={categories:{}});
  await page.addScriptTag({content:js});
  const ready=await page.evaluate(()=>({types:Object.keys(window.AUSTA_SERVICE_COMPANY_V37.forms),home:[...document.querySelectorAll('[data-austa-v107-category]')].map(x=>x.dataset.austaV107Category)}));
  assert.deepEqual(ready.types,types);assert.deepEqual(ready.home,types);
  const widths=[1920,1536,1366,900,390];
  for(const width of widths){
   await page.setViewportSize({width,height:1100});
   for(const type of types){
    await page.evaluate(type=>{
     const form=window.AUSTA_SERVICE_COMPANY_V37.forms[type],root=document.querySelector('#austaV153CFields');root.replaceChildren();
     for(const [key,label,kind,options=[]] of form.fields){
      const box=document.createElement(kind==='checklist'?'fieldset':'div');box.className='austa-v153c-field'+(['textarea','checklist'].includes(kind)?' full':'');
      if(kind==='checklist'){box.classList.add('austa-v37-checklist');box.innerHTML='<legend>'+label+'</legend><div>'+options.map(v=>'<label><input type="checkbox" data-v37-choice="'+key+'" value="'+(Array.isArray(v)?v[0]:v)+'"><span>'+(Array.isArray(v)?v[1]:v)+'</span></label>').join('')+'</div><input type="hidden" data-v153c-key="'+key+'" value="[]">';}
      else{const l=document.createElement('label');l.textContent=label;box.append(l);const x=kind==='textarea'?document.createElement('textarea'):kind==='select'?document.createElement('select'):document.createElement('input');if(kind!=='textarea'&&kind!=='select')x.type=kind;x.dataset.v153cKey=key;if(kind==='select')for(const value of options){const o=document.createElement('option');o.value=Array.isArray(value)?value[0]:value;o.textContent=Array.isArray(value)?value[1]:value;x.append(o);}box.append(x);}
      root.append(box);
     }
    },type);
    if(width===1920&&type==='insurance'){
     const check=page.locator('#austaV153CFields [data-v37-choice]').first();await check.check();
     const hidden=page.locator('#austaV153CFields input[type=hidden]').first();
     await page.evaluate(()=>document.addEventListener('change',e=>{const c=e.target.closest('[data-v37-choice]');if(!c)return;const root=c.closest('#austaV153CFields'),key=c.dataset.v37Choice;root.querySelector('[data-v153c-key="'+key+'"]').value=JSON.stringify([...root.querySelectorAll('[data-v37-choice="'+key+'"]:checked')].map(n=>n.value));},{once:true}));
     await check.dispatchEvent('change');assert.deepEqual(JSON.parse(await hidden.inputValue()),['İcbari avtomobil sığortası']);
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(overflow<=1,type+' '+width+'px overflow '+overflow);
    if(process.env.V37_SCREENSHOTS){fs.mkdirSync(process.env.V37_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.V37_SCREENSHOTS,'v37-'+type+'-'+width+'.png'),fullPage:true});}
   }
  }
 }finally{await browser.close();}
});
