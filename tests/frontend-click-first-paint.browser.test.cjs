'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const bootstrapComment='<!-- V3.9 first-paint styles: versioned and loaded before the page body. The ordered tail imports below remain to preserve the existing cascade. -->';

async function serve(){
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const relative=pathname==='/'?'index.html':pathname.replace(/^\//,'');
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
      res.writeHead(404);res.end('not found');return;
    }
    const ext=path.extname(file);
    const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'};
    res.writeHead(200,{'content-type':types[ext]||'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,url:`http://127.0.0.1:${server.address().port}/`};
}

async function mockExternal(page){
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})})};`}));
}

test('Blank-area clicks do nothing; intended Usta button opens the current flow at all requested sizes',async()=>{
  const {server,url}=await serve();const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  try{
    for(const width of [1920,1536,1366,900,390]){
      const page=await browser.newPage({viewport:{width,height:936}});await mockExternal(page);
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
      await page.waitForSelector('#austaHomeSearch');
      assert.equal(await page.locator('head link[rel="stylesheet"][href*="homepage.css?v=20261120-1"]').count(),2,`versioned Home styles are present in head at ${width}px (early bootstrap plus cascade-preserving tail import)`);
      await page.evaluate(()=>document.body.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})));
      const blank=await page.evaluate(()=>{for(let y=20;y<innerHeight;y+=20)for(let x=20;x<innerWidth;x+=20){const el=document.elementFromPoint(x,y);if(el&&!el.closest('button,a,input,select,textarea,[role=button]'))return{x,y};}return null;});
      assert(blank,`find a non-control surface to click at ${width}px`);
      await page.mouse.click(blank.x,blank.y);
      assert.equal(await page.locator('#austaV48Overlay,#austaV51Overlay,.austa-v55-overlay,.austa-v54-service-overlay,#austaV32TransportOverlay,#austaServiceSelection').count(),0,`blank click must not open a service or legacy listing at ${width}px`);
      await page.locator('#v34MechanicEntry').click();
      await page.waitForSelector('#austaServiceSelection');
      assert.equal(await page.locator('#austaV48Overlay').count(),0);
      assert.equal(await page.locator('#austaServiceSelection').isVisible(),true);
      await page.locator('#austaServiceSelection [role="button"]').filter({hasText:'Mühərrik'}).first().click();
      await page.waitForSelector('.austa-v54-service-overlay[data-v353]');
      assert.equal(await page.locator('.austa-v54-service-overlay[data-v353] [data-v353-dialog]').count(),1);
      await page.close();
    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Versioned first-paint CSS blocks paint during a slow stylesheet load and reload stays styled',async()=>{
  const {server,url}=await serve();const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:900}});await mockExternal(page);
    let delayed=false;
    await page.route('**/assets/homepage/homepage.css?v=20261120-1',async route=>{if(!delayed){delayed=true;await new Promise(resolve=>setTimeout(resolve,500));}await route.continue();});
    await page.addInitScript(()=>{window.__firstPaint=[];new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.name==='first-contentful-paint')window.__firstPaint.push(entry.startTime)}).observe({type:'paint',buffered:true});});
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForSelector('#austaHomeSearch');
    const state=await page.evaluate(()=>({fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,css:performance.getEntriesByType('resource').filter(x=>x.name.includes('v=20261120-1')&&x.name.endsWith('.css?v=20261120-1')).map(x=>({name:x.name,responseEnd:x.responseEnd})),background:getComputedStyle(document.querySelector('#home .v34-search')).backgroundColor}));
    assert(delayed,'the Home CSS request was delayed to simulate a slow connection');
    assert(state.css.length>=5,'versioned current CSS is fetched before page body renders');
    assert.equal(state.background,'rgb(242, 245, 243)');
    const homeCss=state.css.filter(x=>x.name.includes('/assets/homepage/homepage.css?v=20261120-1'));
    assert(homeCss.length>0,'versioned Home presentation CSS was requested');
    if(Number.isFinite(state.fcp))assert(state.fcp>=Math.min(...homeCss.map(x=>x.responseEnd))-1,'first contentful paint waits for the delayed, render-blocking Home stylesheet');
    await page.reload({waitUntil:'domcontentloaded',timeout:90000});
    assert.equal(await page.locator('#home .v34-search').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(242, 245, 243)');
    assert.equal(await page.locator('#austaServiceSelection,.austa-v55-overlay,#austaV48Overlay').count(),0,'reload does not reveal an old service dialog');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('V48 no longer binds document-wide clicks to textContent',()=>{
  assert(!html.includes('function bindUstaCreate(){'));
  assert(!html.includes('document.addEventListener("click",e=>{\n    const t=norm(e.target.textContent||"");\n    if(t.includes("usta profili elani")'));
  assert.equal((html.match(new RegExp(bootstrapComment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length,1);
  const head=html.slice(html.indexOf('<head>'),html.indexOf('</head>'));
  for(const asset of ['homepage.css','premium-homepage.css','header-ads.css','header-search-polish.css','service-experience.css','listing-experience.css']){
    assert(head.includes(`${asset}?v=20261120-1`),`${asset} is versioned in the render-blocking head`);
  }
});
