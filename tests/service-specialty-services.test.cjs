const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
// Reuse the existing real-router/form fixture without registering its suite.
const filename=path.join(__dirname,'listing-details.test.cjs');
const source=fs.readFileSync(filename,'utf8').split('for(const [type,keys] of Object.entries(fields)){')[0]
 .replace('CustomEvent:class','alert(message){(state.alerts ||= []).push(message)},CustomEvent:class');
const fixtureModule=new Module(filename,module);
fixtureModule.filename=filename;
fixtureModule.paths=module.paths;
fixtureModule._compile(source+'\nmodule.exports=fixture;',filename);
const fixture=fixtureModule.exports;
const own=(o,k)=>Object.hasOwn(o,k);
function setup(type='service',specialty='Engine',services='Brakes',options={}){
 const f=fixture(type,{legacy:{array:[1,2]},owner_name:'Contact'},options);
 Object.assign(f.state.row,{name:'Workshop',phone:'123',specialty,services,about:'Old'});
 return f;
}
async function roundTrip(f,patch={}){
 f.setFields({name:'',service_name:'',phone:'',specialty:'',services:'',about:''});
 f.form.fillEditFields(f.state.row,f.state.formType);
 for(const [key,value] of Object.entries(patch))f.state.nodes.find(n=>n.dataset.v153cKey===key).value=value;
 f.form.setEdit();await f.form.saveCurrentListing();
 assert.match(f.status.textContent,/yadda saxlanıldı/);
}
test('Service form exposes independent specialty/services textarea controls',()=>{
 const f=setup();const fields=f.window.AUSTA_V153C.categories.service.fields;
 assert.deepEqual(Array.from(fields.find(x=>x[0]==='specialty')),['specialty','İxtisaslaşma','textarea']);
 assert.deepEqual(Array.from(fields.find(x=>x[0]==='services')),['services','Göstərilən xidmətlər','textarea']);
});
for(const type of ['service','usta']){
 test(type+': create independently persists both values',async()=>{
  const f=setup(type);const input=f.form.buildRouterInput(type,{service_name:'Workshop',name:'Name',phone:'123',specialty:'Engine',services:'Brakes',details:{}});
  await f.api.saveListing(type,input,{});
  assert.equal(f.state.row.specialty,'Engine');assert.equal(f.state.row.services,'Brakes');assert.equal(f.state.row.status,'inactive');
 });
 for(const [specialty,services] of [['Engine','Brakes'],['Engine',null]])
 test(type+': unrelated edit preserves '+JSON.stringify([specialty,services]),async()=>{
  const f=setup(type,specialty,services);await roundTrip(f,{about:'Updated'});
  assert.equal(f.state.row.specialty,specialty);assert.equal(f.state.row.services,services);
  assert.deepEqual(f.state.row.details.legacy,{array:[1,2]});
 });
 for(const key of ['specialty','services']){
  test(type+': '+key+' only edit preserves counterpart',async()=>{
   const f=setup(type);await roundTrip(f,{[key]:'Diagnostics'});
   assert.equal(f.state.row[key],'Diagnostics');assert.equal(f.state.row[key==='specialty'?'services':'specialty'],key==='specialty'?'Brakes':'Engine');
  });
  if(key==='services')test(type+': explicit whitespace clear '+key,async()=>{
   const f=setup(type);await roundTrip(f,{[key]:'   '});assert.equal(f.state.row[key],null);
  });
 }
}
for(const key of ['specialty','services'])
for(const value of [undefined,'Changed',null,''])
test('sparse API '+key+' '+String(value),async()=>{
 const f=setup();await f.api.updateListing('service','listing',{[key]:value});
 assert.equal(f.state.row[key],value===undefined?(key==='specialty'?'Engine':'Brakes'):value||null);
 assert.equal(f.state.row[key==='specialty'?'services':'specialty'],key==='specialty'?'Brakes':'Engine');
});
test('absent Service router field does not fabricate counterpart',async()=>{
 for(const key of ['specialty','services']){
  const f=setup();f.form.setEdit();const input=f.form.buildRouterInput('service',{[key]:'Changed',details:{}});
  await f.api.updateListing('service','listing',input);
  assert.equal(f.state.row[key],'Changed');
  assert.equal(f.state.row[key==='specialty'?'services':'specialty'],key==='specialty'?'Brakes':'Engine');
 }
});
test('owner-scoped sparse update preserves other provider metadata and blocks mass assignment',async()=>{
 const f=setup();await f.api.updateListing('service','listing',{phone:'456',status:'inactive',owner_id:'attacker',seller_profile_id:'fake',promotion_type:'premium'});
 const op=f.state.ops.find(o=>o.op==='update');
 for(const key of ['rating','reviews_count','latitude','longitude','status','owner_id','seller_profile_id','promotion_type'])assert.equal(own(op.row,key),false,key);
 assert.deepEqual(op.filters,[['id','listing'],['owner_id','owner']]);
 assert.equal(f.state.row.specialty,'Engine');assert.equal(f.state.row.services,'Brakes');
});
test('JSON fresh read failure still blocks provider update',async()=>{
 const f=setup('service','Engine','Brakes',{failRead:true});
 await assert.rejects(f.api.updateListing('service','listing',{details:{owner_name:'New'}}));
 assert.equal(f.state.ops.some(o=>o.op==='update'),false);
});
for(const key of ['specialty','services'])
test('Service persistence builder does not fabricate absent '+key,async()=>{
 const f=setup();const other=key==='specialty'?'services':'specialty';
 if(key==='specialty'){await assert.rejects(async()=>f.api.saveListing('service',f.form.buildRouterInput('service',{service_name:'Workshop',phone:'123',[other]:'Independent',details:{}}),{}));assert.ok(!f.state.ops.some(o=>o.op==='insert'));return;}
 await f.api.saveListing('service',f.form.buildRouterInput('service',{service_name:'Workshop',phone:'123',[other]:'Independent',details:{}}),{});
 assert.equal(f.state.row[key],null);assert.equal(f.state.row[other],'Independent');
});
test('Service CREATE still requires specialty; Usta validation remains unchanged',()=>{
 const validation=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').match(/function validate\(type,data\)\{([\s\S]*?)\n\}/)[0];
 const validate=new Function('currentEdit',validation+';return validate;');
 assert.throws(()=>validate(null)('service',{phone:'123',service_name:'Workshop'}));
 assert.throws(()=>validate({id:'listing'})('service',{phone:'123',service_name:'Workshop'}));
 assert.doesNotThrow(()=>validate(null)('service',{phone:'123',service_name:'Workshop',specialty:'Engine'}));
 assert.doesNotThrow(()=>validate({id:'listing'})('service',{phone:'123',service_name:'Workshop',specialty:'Engine'}));
 assert.throws(()=>validate({id:'listing'})('usta',{phone:'123',name:'Name'}));
});

for(const specialty of [null,'Engine'])
test('Service EDIT blocks blank specialty without fabricating from services: '+String(specialty),async()=>{
 const f=setup('service',specialty,'Brake repair');
 f.setFields({name:'',service_name:'',phone:'',specialty:'',services:'',about:''});
 f.form.fillEditFields(f.state.row,'service');
 const control=key=>f.state.nodes.find(n=>n.dataset.v153cKey===key);
 assert.equal(control('specialty').value,specialty??'');
 assert.equal(control('services').value,'Brake repair');
 control('specialty').value=specialty===null?'':'   ';
 control('about').value='Updated';
 f.form.setEdit();await f.form.saveCurrentListing();
 assert.deepEqual(f.state.alerts,['Mütləq sahələri doldurun.']);
 assert.equal(f.state.ops.length,0);
 assert.equal(f.state.row.specialty,specialty);
 assert.equal(f.state.row.services,'Brake repair');
 assert.equal(f.state.row.about,'Old');
 assert.equal(f.state.events.length,0);
});
test('legacy NULL specialty can be explicitly supplied without rewriting services',async()=>{
 const f=setup('service',null,'Brake repair');
 await roundTrip(f,{specialty:'Diagnostics',about:'Updated'});
 assert.equal(f.state.row.specialty,'Diagnostics');
 assert.equal(f.state.row.services,'Brake repair');
});
