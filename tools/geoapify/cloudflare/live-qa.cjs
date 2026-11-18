"use strict";
// Missing-evidence continuation only. Real TEST responses, never fixtures.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('../../../tests/node_modules/playwright');
const origin='https://austa-map-test.austahelper.workers.dev';
(async()=>{
 if(process.env.AUSTA_CF_LIVE_APPROVED!=='YES_TEST_ONLY'||!process.env.AUSTA_CF_EVIDENCE)throw Error('MANUAL_TEST_APPROVAL_REQUIRED');
 const dir=path.resolve(process.env.AUSTA_CF_EVIDENCE);fs.mkdirSync(dir,{recursive:true});
 const report={source:'real deployed TEST; missing-evidence continuation; no fixtures',priorEvidenceRun:44366068920,requests:0,upstreamUpperBound:0,regional:[],status:'INCOMPLETE'};
 let b;try{
 b=await chromium.launch({args:['--no-sandbox']});const context=await b.newContext({viewport:{width:1536,height:1100},serviceWorkers:'block',ignoreHTTPSErrors:false}),p=await context.newPage();
 await p.route(origin+'/map-api/**',async route=>{if(route.request().method()==='GET'&&++report.requests>12)return route.abort();return route.continue();});
 const home=await p.goto(origin);if(home.status()!==200)throw Error('TEST_ORIGIN_REJECTED');
 report.before=await p.evaluate(async()=>await(await fetch('/health')).json());
 const session=await p.evaluate(async()=> (await fetch('/map-api/session',{method:'POST',headers:{'X-AUSTA-Map-Session':'1'}})).status);if(session!==200)throw Error('SESSION_'+session);
 // No map open here: reuse the successful desktop/mobile screenshots; no tile burst.
 for(const [name,lat,lon,category]of [['Xınalıq',41.1786,48.1268,'all'],['Lənkəran',38.752,48.8506,'all'],['Ağdam',39.9908,46.9274,'all'],['Bakı EV',40.4093,49.8671,'charging'],['Bakı repair',40.4093,49.8671,'repair']]){
 const result=await p.evaluate(async({lat,lon,category})=>{const box=[lon-.025,lat-.025,lon+.025,lat+.025].join(',');const r=await fetch('/map-api/places?category='+category+'&box='+encodeURIComponent(box),{credentials:'same-origin',cache:'no-store',redirect:'error'});if(r.status!==200)return {status:r.status};const j=await r.json();return {status:200,features:j.features,hasMore:j.hasMore,rows:AUSTA_MAP_DATA.externalRows(j,category)};},{lat,lon,category});
 report.regional.push({name,category,...result});if(result.status===429){report.budgetStopped=true;break;}if(result.status!==200)throw Error('UPSTREAM_'+result.status);await p.waitForTimeout(650);
 }
 report.after=await p.evaluate(async()=>await(await fetch('/health')).json());
 report.upstreamUpperBound=report.requests;report.status=report.budgetStopped?'BLOCKED_QUOTA':'PARTIAL_API_ONLY';
 // A scoped API continuation cannot certify all visual/category/internal publication gates.
 process.exitCode=1;
 }catch(e){report.status='BLOCKED_OR_FAILED';report.error=String(e.message).split('\n')[0].replace(/https?:\/\/\S+/g,'[URL]').slice(0,160);process.exitCode=1;}finally{await b?.close();fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,requests:report.requests,regions:report.regional.length}));}
})();
