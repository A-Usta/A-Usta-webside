const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/account/personal-account.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function fixture(){
 const name={},email={},entry={},avatar={replaceChildren(){},append(){}};
 const elements={'[data-pa-name]':name,'[data-pa-email]':email,'[data-pa-avatar]':avatar};
 const document={getElementById:id=>id==='austaAccountModal'?({querySelector:s=>elements[s],querySelectorAll:()=>[entry]}):null,querySelector:()=>null,createElement:()=>({})};
 const window={AUSTA_MY_VEHICLES:{shell:()=>'<div data-my-vehicles></div>',mount(){}}},timers=[];const context={window,document,URL,setTimeout:fn=>timers.push(fn)};
 vm.runInNewContext(source,context);return {window,document,timers,name,email,entry,api:window.AUSTA_PERSONAL_ACCOUNT};
}
test('role normalization handles server roles and rejects unknown/prototype keys',()=>{
 const {api}=fixture();for(const [input,expected] of Object.entries({customer:'customer',provider:'provider',mechanic:'mechanic',shop:'mechanic',tow:'mechanic',cargo:'mechanic',store:'store',partner:'partner',admin:'admin',unknown:'customer',__proto__:'customer',constructor:'customer',toString:'customer'}))assert.equal(api.normalizeRole(input),expected);
 assert.equal(api.normalizeRole('__proto__'),'customer');assert.equal(api.normalizeRole(null),'customer');
});
test('dashboard preserves reference card order and adds vehicles in sixth slot',()=>{
 const {api}=fixture();assert.deepEqual([...api.dashboard().matchAll(/data-page-open="([^"]+)"/g)].map(m=>m[1]),['listings','orders','ratings','registration','business','vehicles']);assert.doesNotMatch(api.dashboard(),/example@mail|DEMO|BMW/);
});
test('vehicle page delegates to the authenticated garage module',()=>{assert.match(fixture().api.vehicles(),/data-my-vehicles/);});
test('personal presentation module cannot persist or modify vehicles',()=>{
 assert.doesNotMatch(source,/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|localStorage|storage\.from|from\(['"]vehicles/);
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('auth header reads only its profile and falls back safely',async()=>{
 const f=fixture();let selected;
 f.window.AUSTA_SUPABASE={auth:{getUser:async()=>({data:{user:{id:'a',email:'a@test.invalid'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:table=>{assert.equal(table,'profiles');return {select:fields=>{selected=fields;return {eq:(key,id)=>{assert.equal(key,'id');assert.equal(id,'a');return {maybeSingle:async()=>({data:{full_name:'A user',avatar_url:'javascript:alert(1)'}})};}};}};}};
 f.api.bindAuth();await tick();assert.equal(selected,'full_name,avatar_url');assert.equal(f.name.textContent,'A user');assert.equal(f.email.textContent,'a@test.invalid');assert.equal(f.entry.hidden,true);
});
test('slow profile response from account A cannot overwrite account B',async()=>{
 const f=fixture();let listener,resolveA,current={id:'a',email:'a@test.invalid'};
 f.window.AUSTA_SUPABASE={auth:{getUser:async()=>({data:{user:current}}),onAuthStateChange:fn=>(listener=fn,{data:{subscription:{unsubscribe(){}}}})},from:()=>({select:()=>({eq:(_key,id)=>({maybeSingle:()=>id==='a'?new Promise(resolve=>resolveA=resolve):Promise.resolve({data:{full_name:'B user'}})})})})};
 f.api.bindAuth();await tick();current={id:'b',email:'b@test.invalid'};listener('SIGNED_IN',{user:current});assert.equal(f.name.textContent,'İstifadəçi');f.timers.splice(0).forEach(fn=>fn());await tick();assert.equal(f.name.textContent,'B user');resolveA({data:{full_name:'A user'}});await tick();assert.equal(f.name.textContent,'B user');assert.equal(f.email.textContent,'b@test.invalid');
});
test('logout clears identity immediately before pending work completes',async()=>{
 const f=fixture();let listener;
 f.window.AUSTA_SUPABASE={auth:{getUser:async()=>({data:{user:null}}),onAuthStateChange:fn=>(listener=fn,{data:{subscription:{unsubscribe(){}}}})}};f.api.bindAuth();await tick();listener('SIGNED_OUT',null);assert.equal(f.email.textContent,'Daxil olmamısınız');assert.equal(f.entry.hidden,false);
});
test('all CSS selectors are scoped to Account',()=>{
 const css=fs.readFileSync(path.join(root,'assets/account/personal-account.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 for(const match of css.matchAll(/([^{}]+)\{/g)){const selector=match[1].trim();if(selector.startsWith('@media'))continue;for(const part of selector.split(','))assert.match(part.trim(),/^(?:#austaAccountModal\b|#austa-v39-auth-modal\[data-account-auth\])/);}
});
test('index outside approved V39 controller and new asset references is byte-identical to approved baseline',()=>{
 const body=require('./helpers/vehicle-history-baseline.cjs').normalize(html).replace(/<script id="austa-v39-account-js">[\s\S]*?<\/script>/,'ACCOUNT_CONTROLLER').replace('<script src="assets/account/personal-account.js"></script>\n','').replace('<link rel="stylesheet" href="assets/account/personal-account.css">\n','').trim();
 assert.equal(createHash('sha256').update(body).digest('hex'),'f1e504b83ca03415b92da25ad533097cf14e0ba9ab05358b5ec8dd18720fb0d9');
});
test('Seller Verification only changes Account mount target and exposes mount lifecycle',()=>{
 const seller=fs.readFileSync(path.join(root,'assets/marketplace/seller-verification.js'),'utf8');
 assert.match(seller,/querySelector\('#austaV39Main \[data-pa-business-host\]'\)/);
 const before=seller.replace("const main=document.querySelector('#austaV39Main [data-pa-business-host]');if(!main)return;","const main=document.getElementById('austaV39Main');if(!main)return;").replace('Object.freeze({open,close,refresh,mountAccount})','Object.freeze({open,close,refresh})');
 assert.equal(createHash('sha256').update(before).digest('hex'),'fd3334381befbfe068400969ebe16c3ad1fee4faa607b20e75f8205a8fe59109');
});
test('historical compatibility rejects unknown Account edits and preserves unrelated mutations',()=>{
 const normalize=require('./helpers/personal-account-baseline.cjs').normalize;
 assert.throws(()=>normalize(html.replace("modal.dataset.personalAccount='v33d2'","modal.dataset.personalAccount='changed'")),/exact (?:reviewed V33D3|V33D2)/);
 const changed=html.replace('Bütün avtomobil xidmətləri bir platformada','UNRELATED MUTATION');
 assert.match(normalize(changed),/UNRELATED MUTATION/);
 const seller=fs.readFileSync(path.join(root,'assets/marketplace/seller-verification.js'),'utf8');
 assert.throws(()=>require('./helpers/personal-account-baseline.cjs').assertSellerMount(seller.replace('MAX_FILE=10485760','MAX_FILE=999999')),/Seller module outside/);
});
test('mobile menu exposes labels, collapses after navigation and resets on rebuilt sidebar',()=>{
 let expanded=false,clicked,focused=0;
 function button(){return {dataset:{},attrs:{'aria-expanded':'false'},getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v},focus(){focused++}}}
 let toggle=button();const nav={dataset:{},classList:{remove(){expanded=false},toggle(_key,value){expanded=value}},querySelector:()=>toggle,addEventListener:(_type,fn)=>clicked=fn};
 const window={matchMedia:()=>({matches:true})},document={getElementById:id=>id==='austaV39Nav'?nav:null,querySelector:()=>null};vm.runInNewContext(source,{window,document,URL,setTimeout(){}});
 const api=window.AUSTA_PERSONAL_ACCOUNT;api.bindAuth();toggle.onclick();assert.equal(expanded,true);assert.equal(toggle.attrs['aria-expanded'],'true');clicked({target:{closest:()=>({})}});assert.equal(expanded,false);assert.equal(focused,1);assert.equal(toggle.attrs['aria-expanded'],'false');
 toggle.onclick();toggle=button();api.bindAuth();assert.equal(expanded,false);assert.equal(toggle.attrs['aria-expanded'],'false');
});

test('signed-out auth entry precedes cards, begins hidden, and has two existing-system actions',()=>{
 const d=fixture().api.dashboard();assert(d.indexOf('data-pa-auth-entry')<d.indexOf('pa-dashboard-grid'));assert.match(d,/data-pa-auth-entry hidden/);assert.match(d,/Hesabınıza daxil olun/);assert.match(d,/data-pa-auth-mode="register"/);assert.equal([...d.matchAll(/data-action="login"/g)].length,2);
});
test('auth resolution and account-switch loading never flash signed-out entry',async()=>{
 const f=fixture();let resolve,listener;
 f.window.AUSTA_SUPABASE={auth:{getUser:()=>new Promise(r=>resolve=r),onAuthStateChange:fn=>(listener=fn,{data:{subscription:{unsubscribe(){}}}})}};
 f.api.bindAuth();assert.equal(f.entry.hidden,true);resolve({data:{user:null}});await tick();assert.equal(f.entry.hidden,false);listener('SIGNED_IN',{user:{id:'b'}});assert.equal(f.entry.hidden,true);
});
test('reviewed polish normalization rejects unknown controller, CSS and JS mutations',()=>{
 const helper=require('./helpers/account-polish-baseline.cjs');assert.throws(()=>helper.normalize(html.replace("authModal.dataset.mode=mode;","authModal.dataset.mode='other';")),/exact reviewed V33D3/);
 for(const name of ['personal-account.js','personal-account.css'])assert.throws(()=>helper.normalizeAsset(name,fs.readFileSync(path.join(root,'assets/account',name),'utf8')+'\n/* unknown */'),/exact V33D3/);
});
