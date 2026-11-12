const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,flush}=require('./helpers/listing-detail-fixture.cjs');
test('first detail open survives initial session notification without hiding later auth switches',async()=>{
 const f=fixture();const original=f.sb.auth.onAuthStateChange;f.sb.auth.onAuthStateChange=fn=>{const s=original(fn);queueMicrotask(()=>fn('INITIAL_SESSION',null));return s;};
 assert.equal(await f.open(),true);assert(f.page());await f.auth('foreign');assert.equal(f.page(),null);
});
