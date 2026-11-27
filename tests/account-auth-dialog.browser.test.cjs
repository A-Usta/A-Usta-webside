/* Real Chromium UI regression; no database/authentication operation simulated or claimed. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..'),html=fs.readFileSync(root+'/index.html','utf8');
const script=id=>html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'))[1];
const style=id=>html.match(new RegExp('<style id="'+id+'">([\\s\\S]*?)<\\/style>'))?.[1]||'';
for(const width of [1536,390])test(`Account native Auth dialog: pointer, keyboard, inert background and dismissal at ${width}px`,async()=>{
 const b=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{const p=await b.newPage({viewport:{width,height:width===390?844:1024}});
 await p.route('http://account.test/**',r=>r.fulfill({contentType:'text/html',body:'<button id="headerAccountLink">Hesab</button><div id="account"></div>'}));await p.route('http://account.test/functions/v1/whatsapp-send-sms',r=>r.fulfill({status:200,contentType:'application/json',body:'{"enabled":true}'}));await p.goto('http://account.test/');
 for(const id of ['austa-v38-account-css','austa-v39-account-css','austa-v40-final-css'])await p.addStyleTag({content:style(id)});
 await p.addStyleTag({content:fs.readFileSync(root+'/assets/account/personal-account.css','utf8')});
 // Only a capability marker allows opening UI; submit is never invoked in this test.
 await p.evaluate(()=>{ window.__phoneOtpRequest=null; window.AUSTA_SUPABASE={supabaseUrl:'http://account.test',auth:{getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:null}}),signInWithOtp:async(payload)=>{window.__phoneOtpRequest=payload;return {error:null};},onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}}; });
 for(const name of ['maintenance-reminders','vehicle-data','my-vehicles','personal-account'])await p.addScriptTag({content:fs.readFileSync(root+'/assets/account/'+name+'.js','utf8')});
 await p.addScriptTag({content:script('austa-v39-account-js')});await p.waitForFunction(()=>document.querySelector('#headerAccountLink').dataset.v39Bound==='1');await p.locator('#headerAccountLink').click();const opener=p.locator('[data-action=login]').first();await opener.click();assert.equal(await p.locator('#austa-v39-auth-phone-panel').count(),1);assert.equal(await p.locator('#austa-v39-auth-phone-send').innerText(),'WhatsApp ilə kod al');await p.locator('#austa-v39-auth-phone-otp-phone').fill('0100000000');await p.locator('#austa-v39-auth-phone-send').click();await p.waitForFunction(()=>window.__phoneOtpRequest?.phone==='+994100000000');assert.equal(await p.evaluate(()=>window.__phoneOtpRequest.options.channel),'sms');assert.equal(await p.evaluate(()=>window.__phoneOtpRequest.options.shouldCreateUser),false);
 assert.equal(await p.locator('#austa-v39-auth-modal').evaluate(e=>e.matches(':modal')),true);
 const email=p.locator('#austa-v39-auth-email'),password=p.locator('#austa-v39-auth-password');await email.click();await email.fill('synthetic@example.invalid');await password.click();await password.fill('UI-only-no-submit');assert.equal(await password.inputValue(),'UI-only-no-submit');
 await p.evaluate(()=>document.querySelector('.austa-v39-close').focus());assert.equal(await p.evaluate(()=>document.querySelector('#austa-v39-auth-modal').contains(document.activeElement)),true);
 for(const key of ['Tab','Shift+Tab'])for(let i=0;i<15;i++){await p.keyboard.press(key);assert.equal(await p.evaluate(()=>document.querySelector('#austa-v39-auth-modal').contains(document.activeElement)),true);}
 await p.keyboard.press('Escape');assert.equal(await p.locator('#austa-v39-auth-modal').count(),0);assert.equal(await opener.evaluate(e=>document.activeElement===e),true);assert.equal(await p.locator('#austaAccountModal').evaluate(e=>e.classList.contains('open')),true);
 await opener.click();await p.mouse.click(1,1);assert.equal(await p.locator('#austa-v39-auth-modal').count(),0);assert.equal(await opener.evaluate(e=>document.activeElement===e),true);
 await opener.click();await p.locator('#austa-v39-auth-close').click();assert.equal(await p.locator('#austa-v39-auth-modal').count(),0);await p.keyboard.press('Escape');assert.equal(await p.locator('#headerAccountLink').evaluate(e=>document.activeElement===e),true);
 }finally{await b.close();}
});


test('WhatsApp OTP controls stay hidden while remote activation is disabled',async()=>{
 const b=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{const p=await b.newPage({viewport:{width:390,height:844}});
 await p.route('http://account.test/**',r=>r.fulfill({contentType:'text/html',body:'<button id="headerAccountLink">Hesab</button><div id="account"></div>'}));await p.route('http://account.test/functions/v1/whatsapp-send-sms',r=>r.fulfill({status:200,contentType:'application/json',body:'{"enabled":false}'}));await p.goto('http://account.test/');
 for(const id of ['austa-v38-account-css','austa-v39-account-css','austa-v40-final-css'])await p.addStyleTag({content:style(id)});
 await p.addStyleTag({content:fs.readFileSync(root+'/assets/account/personal-account.css','utf8')});
 await p.evaluate(()=>{window.AUSTA_SUPABASE={supabaseUrl:'http://account.test',auth:{getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:null}}),signInWithOtp:async()=>{throw new Error('disabled OTP must not be requested');},onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};});
 for(const name of ['maintenance-reminders','vehicle-data','my-vehicles','personal-account'])await p.addScriptTag({content:fs.readFileSync(root+'/assets/account/'+name+'.js','utf8')});
 await p.addScriptTag({content:script('austa-v39-account-js')});await p.waitForFunction(()=>document.querySelector('#headerAccountLink').dataset.v39Bound==='1');await p.locator('#headerAccountLink').click();await p.locator('[data-action=login]').first().click();
 const panel=p.locator('#austa-v39-auth-phone-panel');await p.waitForFunction(()=>document.querySelector('#austa-v39-auth-phone-panel')?.getAttribute('aria-hidden')==='true');assert.equal(await panel.isVisible(),false);assert.equal(await p.getByText('WhatsApp ilə kod al',{exact:true}).isVisible().catch(()=>false),false);assert.equal(await p.locator('#austa-v39-auth-email').isVisible(),true);assert.equal(await p.locator('#austa-v39-auth-password').isVisible(),true);
 }finally{await b.close();}
});
