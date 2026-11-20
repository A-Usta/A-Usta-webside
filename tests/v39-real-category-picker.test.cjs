'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('listing picker uses real image assets for all three service companies and deduplicates dealer',()=>{
 const source=read('assets/marketplace/listing-experience.js');
 for(const [type,image] of [['leasing','lizinq-sirketleri'],['insurance','sigorta-sirketleri'],['sober_driver','ayiq-surucu']]){
  assert.match(source,new RegExp(type+":'"+image+"'"));
  assert.ok(fs.statSync(path.join(root,'assets/austa-home',image+'.webp')).size>1000);
 }
 assert.match(source,/dealerOptions\.slice\(1\)/);
 assert.match(source,/all\.findIndex\(candidate=>candidate\.value==='dealer'\)/);
});

test('homepage service company clicks reach real marketplace route without being consumed by legacy handlers',()=>{
 const handlers={};
 const calls=[];
 const document={readyState:'loading',addEventListener:(name,handler,capture)=>{(handlers[name]??=[]).push({handler,capture});}};
 const context={window:{AUSTA_V151_MARKETPLACE:{openCategory:key=>calls.push(key)}},document,MutationObserver:class {},console};
 vm.runInNewContext(read('assets/marketplace/service-company-v37.js'),context);
 const capture=handlers.click.find(item=>item.capture===true);
 assert.ok(capture,'service route must run in capture phase');
 for(const key of ['leasing','insurance','sober_driver']){
  let prevented=false,stopped=false;
  capture.handler({target:{closest:()=>({dataset:{austaV107Category:key}})},preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
  assert.ok(prevented&&stopped,key+' click is handled before legacy listener');
 }
 assert.deepEqual(calls,['leasing','insurance','sober_driver']);
});
