const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
test('real category capture listener routes automobile click to canonical cars API type',()=>{
 const start=html.lastIndexOf('document.addEventListener(',html.indexOf('openCategory(\n                "cars"'));
 const end=html.indexOf('/* =========================================================\n   SCROLL',start);const source=html.slice(start,end);
 const handlers=[],calls=[];vm.runInNewContext(source,{document:{addEventListener:(type,fn)=>handlers.push(fn)},openCategory:(...a)=>calls.push(a)});
 assert.equal(handlers.length,1);let stopped=0;handlers[0]({target:{closest:()=>({textContent:'Avtomobillər'})},preventDefault(){},stopImmediatePropagation(){stopped++}});
 assert.equal(calls[0][0],'cars');assert.equal(stopped,1);
});
