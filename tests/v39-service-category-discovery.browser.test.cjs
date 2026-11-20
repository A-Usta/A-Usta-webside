'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const newCategories=[
  ['leasing','Lizinq şirkətləri','lizinq-sirketleri.webp'],
  ['insurance','Sığorta şirkətləri','sigorta-sirketleri.webp'],
  ['sober_driver','Ayıq sürücü','ayiq-surucu.webp']
];

test('V3.9 service categories appear once, show images and route to their real category keys',async t=>{
  let browser,server;
  try{browser=await chromium.launch({executablePath:process.env.AUSTA_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});}
  catch(error){t.skip(`Chromium unavailable: ${error.message.split('\n')[0]}`);return;}
  try{
    server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file=path.join(root,pathname.replace(/^\//,''));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
        res.writeHead(404);res.end('not found');return;
      }
      const ext=path.extname(file);
      const type=ext==='.html'?'text/html':ext==='.js'?'application/javascript':ext==='.css'?'text/css':ext==='.webp'?'image/webp':ext==='.png'?'image/png':'application/octet-stream';
      res.writeHead(200,{'content-type':type});res.end(fs.readFileSync(file));
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const page=await browser.newPage({viewport:{width:1536,height:1000}});
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelectorAll('#austaV107ListingCategories [data-austa-v107-category]').length===17);
    assert.equal(await page.locator('#austaV107ListingCategories [data-austa-v107-category="dealer"]').count(),1,'Avtosalon remains a single category');

    for(const [key,label,image] of newCategories){
      const card=page.locator(`#austaV107ListingCategories [data-austa-v107-category="${key}"]`);
      assert.equal(await card.count(),1,`${key} should appear once`);
      assert.ok((await card.innerText()).includes(label),`${key} card keeps its category label after the decorative icon`);
      assert.match(await card.evaluate(el=>getComputedStyle(el).backgroundImage),new RegExp(image.replace('.','\\.')));
      assert.equal(fs.existsSync(path.join(root,'assets/austa-home',image)),true,`${image} exists`);
    }

    await page.locator('#austaV107ListingCategories [data-austa-v107-category="dealer"]').evaluate(el=>{
      if(window.AUSTA_MARKET_V106)window.AUSTA_MARKET_V106.category=()=>{};
      window.__v39CategoryCalls=[];
      window.AUSTA_V151_MARKETPLACE={openCategory:(...args)=>window.__v39CategoryCalls.push(args)};
    });
    for(const [key] of newCategories){
      await page.locator(`#austaV107ListingCategories [data-austa-v107-category="${key}"]`).click();
      const calls=await page.evaluate(()=>window.__v39CategoryCalls.splice(0));
      assert.deepEqual(calls,[[key]],`${key} opens the matching listing category`);
    }

    for(const width of [1920,1536,1366,900,390]){
      await page.setViewportSize({width,height:1000});
      const dimensions=await page.locator('#austaV107ListingCategories .austa-v107-category-grid').evaluate(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
      assert.ok(dimensions.scrollWidth<=dimensions.clientWidth+1,`category grid overflows at ${width}px`);
      if(process.env.V39_SCREENSHOTS){
        fs.mkdirSync(process.env.V39_SCREENSHOTS,{recursive:true});
        await page.screenshot({path:path.join(process.env.V39_SCREENSHOTS,`categories-${width}.png`),fullPage:false});
      }
    }
  }finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}
});

test('V3.9 dealer option cleanup retains exactly one existing Avtosalon category',async t=>{
  let browser;
  try{browser=await chromium.launch({executablePath:process.env.AUSTA_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});}
  catch(error){t.skip(`Chromium unavailable: ${error.message.split('\n')[0]}`);return;}
  try{
    const match=html.match(/function ensureDealerOption\(\)\s*\{[\s\S]*?\n\}/);
    assert.ok(match,'dealer option cleanup function is present');
    const page=await browser.newPage();
    await page.setContent('<select id="austaV153CCategory"><option value="dealer">Avtosalonlar</option><option value="dealer">Avtosalonlar (təkrar)</option><option value="cars">Avtomobil</option></select>');
    await page.evaluate(source=>{(0,eval)(`(${source})`)();},match[0]);
    assert.equal(await page.locator('#austaV153CCategory option[value="dealer"]').count(),1);
    assert.equal(await page.locator('#austaV153CCategory option[value="cars"]').count(),1);
  }finally{await browser?.close();}
});
