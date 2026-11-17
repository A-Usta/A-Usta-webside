'use strict';
const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/map/publication.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261117090000_v355_map_publication_cas.sql'),'utf8');
class Element {
 constructor(tag,text=''){this.tagName=tag;this.textContent=text;this.children=[];this.attributes={};this.value='';this.disabled=false;this.checked=false;this.isConnected=true;this.parentElement=null;}
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n)}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this)}
 setAttribute(k,v){this.attributes[k]=v}
 reportValidity(){return true}
 get selectedOptions(){return this.children.filter(n=>n.tagName==='option').slice(0,1)}
}
function all(root,predicate){const out=[];function walk(n){if(predicate(n))out.push(n);for(const c of n.children)walk(c)}walk(root);return out}
function setup(){
 const calls=[];const host=new Element('div');let data=null;let staleOnce=false,loseOnce=false;
 const mock={auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:null})},
 from(name){if(name==='service_provider_listings')return {select(){return this},eq(){return this},limit(){return Promise.resolve({data:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'Test Workshop',provider_type:'usta'}]})}};
 if(name==='provider_map_publications')return {select(){return this},eq(){return this},maybeSingle(){return Promise.resolve({data})}};
 throw new Error('Unexpected table '+name)},
 rpc(name,args){calls.push({name,args});return {single:async()=>{if(staleOnce){staleOnce=false;data={revision:3,enabled:false,public_name:'Test Workshop',public_area:'Bakı',location_kind:'service_area',services:['repair']};return {error:{code:'40001'}}};const revision=(data?.revision??0)+1;data={revision,enabled:args.p_enabled,public_name:args.p_public_name||'Test Workshop',public_area:args.p_public_area||'Bakı',location_kind:args.p_location_kind||'service_area',services:args.p_services||['repair']};if(loseOnce){loseOnce=false;throw Error('lost response')}return {data:{listing_id:args.p_listing_id,revision,enabled:args.p_enabled}}}}}
 };
 const window={AUSTA_SUPABASE:mock,AUSTA_MAP_DATA:{filters:{repair:'Repair',wash:'Wash',tyre:'Tyre',alignment:'Alignment'}},crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(calls.length+1).padStart(12,'0')}`}};
 vm.runInNewContext(source,{window,document:{createElement:tag=>new Element(tag)}});
 return {window,calls,host,setStale:()=>staleOnce=true,lose:()=>loseOnce=true,getData:()=>data};
}
async function flush(){await new Promise(setImmediate);await new Promise(setImmediate)}
test('CAS client publish uses dedicated RPC, then withdrawal supplies expected revision',async()=>{
 const f=setup();await f.window.AUSTA_MAP_PUBLICATION.open(f.host,{current:()=>true,reset:()=>{}});
 const form=all(f.host,n=>n.tagName==='form')[0];
 const area=all(form,n=>n.tagName==='label'&&n.textContent.includes('Xidmət ərazisi'))[0].children[0];area.value='Bakı';
 all(form,n=>n.tagName==='label'&&n.textContent.includes('razıyam'))[0].children[0].checked=true;
 all(form,n=>n.tagName==='input'&&n.value==='repair')[0].checked=true;
 form.onsubmit({preventDefault(){}});await flush();
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'v355_apply_map_publication');assert.equal(f.calls[0].args.p_expected_revision,0);assert.equal(f.calls[0].args.p_consent,true);assert.equal(f.calls[0].args.p_enabled,true);
 const withdraw=all(form,n=>n.tagName==='button'&&n.textContent==='Dərcdən çıxar')[0];await withdraw.onclick();await flush();
 assert.equal(f.calls.length,2);assert.equal(f.calls[1].args.p_expected_revision,1);assert.equal(f.calls[1].args.p_enabled,false);assert.equal(f.calls[1].args.p_public_name,undefined);assert.equal(f.getData().revision,2);
});
test('stale update code causes reload instead of force overwrite',async()=>{
 const f=setup();await f.window.AUSTA_MAP_PUBLICATION.open(f.host,{current:()=>true,reset:()=>{}});
 f.setStale();const form=all(f.host,n=>n.tagName==='form')[0];
 const withdraw=all(form,n=>n.tagName==='button'&&n.textContent==='Dərcdən çıxar')[0];await withdraw.onclick();await flush();
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].args.p_expected_revision,0);
 assert.equal(f.getData().revision,3);
});
test('SQL proposal has no direct write bypass and implements version checks, durable receipts, and locks',()=>{
 assert.match(sql,/REVOKE INSERT, UPDATE, DELETE ON public\.provider_map_publications FROM authenticated/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/m\.revision=v_current_revision/);
 assert.match(sql,/PRIMARY KEY\(owner_id, request_id\)/);
 assert.match(sql,/SECURITY DEFINER[\s\S]*SET search_path = ''/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/consent/);
 assert.doesNotMatch(source,/\.upsert\(|\.update\(\{enabled:false/);
});

test('uncertain write freezes new input and replays the exact request across dialog reopen',async()=>{
 const f=setup();await f.window.AUSTA_MAP_PUBLICATION.open(f.host,{current:()=>true,reset:()=>{}});
 f.lose();let form=all(f.host,n=>n.tagName==='form')[0];
 await all(form,n=>n.tagName==='button'&&n.textContent==='Dərcdən çıxar')[0].onclick();await flush();
 assert.equal(f.calls.length,1);const first=JSON.stringify(f.calls[0].args);
 assert(all(form,n=>n.tagName==='button'&&n.textContent==='Dərcdən çıxar')[0].disabled);
 await all(form,n=>n.tagName==='button'&&n.textContent==='Bağla')[0].onclick();
 await f.window.AUSTA_MAP_PUBLICATION.open(f.host,{current:()=>true,reset:()=>{}});
 form=all(f.host,n=>n.tagName==='form')[0];
 const retry=all(form,n=>n.tagName==='button'&&n.textContent.includes('bərpa et'))[0];
 assert.equal(retry.hidden,false);await retry.onclick();await flush();
 assert.equal(f.calls.length,2);assert.equal(JSON.stringify(f.calls[1].args),first);
});
