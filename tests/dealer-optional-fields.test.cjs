const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const filename=path.join(__dirname,'listing-details.test.cjs');
const source=fs.readFileSync(filename,'utf8').split('for(const [type,keys] of Object.entries(fields)){')[0];
const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
m._compile(source+'\nmodule.exports=fixture;',filename);
const fixture=m.exports;
const required={dealer_name:'Salon',phone:'123',region:'Bakı',address:'Street'};
const textKeys=['contact_name','message_contact','district','working_hours','brands','about','vehicle_condition'];
const boolKeys=['credit_available','leasing_available','barter_available','delivery_available'];
function setup(options={}){
 const f=fixture('dealer',{legacy:{array:[1,2]},contact_name:'Contact',brands:'BMW',credit_available:true},options);
 Object.assign(f.state.row,required,Object.fromEntries(textKeys.map(k=>[k,k==='vehicle_condition'?'Yeni':'OLD-'+k])),Object.fromEntries(boolKeys.map(k=>[k,true])));
 return f;
}
async function update(f,patch={}){
 f.setFields({...required,...patch});
 await f.dealer.updateDealer({id:'listing'});
 return f.state.ops.find(o=>o.op==='update');
}
for(const key of textKeys){
 for(const mode of ['absent','undefined'])test(key+': '+mode+' preserves column and existing JSON',async()=>{
  const f=setup(),before=JSON.parse(JSON.stringify(f.state.row));
  const op=await update(f,mode==='undefined'?{[key]:undefined}:{});
  assert.equal(Object.hasOwn(op.row,key),false);
  assert.equal(f.state.row[key],before[key]);
  assert.deepEqual(f.state.row.details,before.details);
 });
 test(key+': explicit value updates',async()=>{
  const f=setup();await update(f,{[key]:key==='vehicle_condition'?'Sürülmüş':'Changed'});
  assert.equal(f.state.row[key],key==='vehicle_condition'?'Sürülmüş':'Changed');
  assert.deepEqual(f.state.row.details.legacy,{array:[1,2]});
 });
 test(key+': explicit blank clears nullable column',async()=>{
  const f=setup();await update(f,{[key]:'   '});assert.equal(f.state.row[key],null);
  if(Object.hasOwn(f.state.row.details,key))assert.equal(f.state.row.details[key],'');
 });
}
for(const key of boolKeys){
 for(const mode of ['absent','undefined'])test(key+': '+mode+' preserves true',async()=>{
  const f=setup();const op=await update(f,mode==='undefined'?{[key]:undefined}:{});
  assert.equal(Object.hasOwn(op.row,key),false);assert.equal(f.state.row[key],true);
  if(key==='credit_available')assert.equal(f.state.row.details[key],true);
 });
 for(const [value,expected] of [['Bəli',true],['Xeyr',false],['',false]])
 test(key+': explicit '+JSON.stringify(value)+' persists '+expected,async()=>{
  const f=setup();await update(f,{[key]:value});
  assert.equal(f.state.row[key],expected);assert.equal(f.state.row.details[key],expected);
 });
}
test('numeric zero in a text control is not discarded by falsy coercion',async()=>{
 const f=setup();await update(f,{contact_name:0});assert.equal(f.state.row.contact_name,'0');assert.equal(f.state.row.details.contact_name,'0');
});
test('unrelated edit preserves all optional metadata and coordinates',async()=>{
 const f=setup(),before=JSON.parse(JSON.stringify(f.state.row));const op=await update(f,{phone:'456'});
 for(const k of [...textKeys,...boolKeys,'latitude','longitude'])assert.equal(f.state.row[k],before[k],k);
 assert.deepEqual(f.state.row.details,before.details);
 for(const k of ['latitude','longitude'])assert.equal(Object.hasOwn(op.row,k),false);
});
test('owner scoping and explicit payload block system-field mass assignment',async()=>{
 const f=setup();const op=await update(f,{owner_id:'attack',status:'inactive',seller_profile_id:'fake',promotion_type:'premium',promotion_started_at:'now',promotion_until:'later',last_boosted_at:'now',latitude:0,longitude:0});
 assert.deepEqual(op.filters,[['id','listing'],['owner_id','owner']]);
 for(const k of ['owner_id','status','seller_profile_id','promotion_type','promotion_started_at','promotion_until','last_boosted_at','latitude','longitude'])assert.equal(Object.hasOwn(op.row,k),false,k);
 assert.deepEqual(f.state.row.details.legacy,{array:[1,2]});
});
test('JSON read error remains fail-closed',async()=>{
 const f=setup({failRead:true});await assert.rejects(update(f,{contact_name:'Changed'}));
 assert.equal(f.state.ops.some(o=>o.op==='update'),false);
});
test('foreign owner cannot update',async()=>{
 const f=setup({foreign:true});await assert.rejects(update(f,{contact_name:'Changed'}));
 assert.equal(f.state.ops.some(o=>o.op==='update'),false);
});
for(const key of Object.keys(required))test('required Dealer validation unchanged: '+key,async()=>{
 const f=setup();await assert.rejects(update(f,{[key]:''}),/mütləqdir/);
 assert.equal(f.state.ops.length,0);
});
