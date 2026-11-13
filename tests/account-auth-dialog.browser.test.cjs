/* Real Chromium UI regression; no database/authentication operation simulated or claimed. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..'),html=fs.readFileSync(root+'/index.html','utf8');
const script=id=>html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'))[1];
const style=id=>html.match(new RegExp('<style id="'+id+'">([\\s\\S]*?)<\\/style>'))?.[1]||'';
for(const width of [1536,390])test(`Account native Auth dialog: pointer, keyboard, inert background and dismissal at ${width}px`,async()=>{
 const b=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{const p=await b.newPage({viewport:{width,height:width===390?844:1024}});
 await p.route('http://account.test/**',r=>r.fulfill({contentType:'text/html',body:'<button id="headerAccountLink">Hesab</button><div id="account"></div>'}));await p.goto('http://account.test/');
 for(const id of ['austa-v38-account-css','austa-v39-account-css','austa-v40-final-css'])await p.addStyleTag({content:style(id)});
 await p.addStyleTag({content:fs.readFileSync(root+'/assets/account/personal-account.css','utf8')});
 // Only a capability marker allows opening UI; submit is never invoked in this test.
 await p.evaluate(()=>{ window.AUSTA_SUPABASE={auth:{getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}}; });
 for(const name of ['maintenance-reminders','vehicle-data','my-vehicles','personal-account'])await p.addScriptTag({content:fs.readFileSync(root+'/assets/account/'+name+'.js','utf8')});
 await p.addScriptTag({content:script('austa-v39-account-js')});await p.waitForFunction(()=>document.querySelector('#headerAccountLink').dataset.v39Bound==='1');await p.locator('#headerAccountLink').click();const opener=p.locator('[data-action=login]').first();await opener.click();
 assert.equal(await p.locator('#austa-v39-auth-modal').evaluate(e=>e.matches(':modal')),true);
 const email=p.locator('#austa-v39-auth-email'),password=p.locator('#austa-v39-auth-password');await email.click();await email.fill('synthetic@example.invalid');await password.click();await password.fill('UI-only-no-submit');assert.equal(await password.inputValue(),'UI-only-no-submit');
 await p.evaluate(()=>document.querySelector('.austa-v39-close').focus());assert.equal(await p.evaluate(()=>document.querySelector('#austa-v39-auth-modal').contains(document.activeElement)),true);
 for(const key of ['Tab','Shift+Tab'])for(let i=0;i<15;i++){await p.keyboard.press(key);assert.equal(await p.evaluate(()=>document.querySelector('#austa-v39-auth-modal').contains(document.activeElement)),true);}
 await p.keyboard.press('Escape');assert.equal(await p.locator('#austa-v39-auth-modal').count(),0);assert.equal(await opener.evaluate(e=>document.activeElement===e),true);assert.equal(await p.locator('#austaAccountModal').evaluate(e=>e.classList.contains('open')),true);
 await opener.click();await p.mouse.click(1,1);assert.equal(await p.locator('#austa-v39-auth-modal').count(),0);assert.equal(await opener.evaluate(e=>document.activeElement===e),true);
 await opener.click();await p.locator('#austa-v39-auth-close').click();assert.equal(await p.locator('#austa-v39-auth-modal').count(),0);await p.keyboard.press('Escape');assert.equal(await p.locator('#headerAccountLink').evaluate(e=>document.activeElement===e),true);
 }finally{await b.close();}
});
