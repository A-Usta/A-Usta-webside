'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('supabase/migrations/20261118100000_v36_listing_detail_metrics.sql');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const L='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',LB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',D='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let db;
async function as(uid,fn,role='authenticated'){
 await db.exec('SET ROLE '+role);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid||'']);
 try{return await fn();}finally{await db.exec('RESET ROLE');}
}
before(async()=>{db=new PGlite();await db.exec(read('tests/db/fixtures/pre-v36-listings.sql'));await db.exec(migration);});
after(()=>db?.close());

test('backfill assigns stable unique numbers across active and legacy rows without fabricating view totals',async()=>{
 const {rows}=await db.query('SELECT listing_source,listing_id,public_number,view_count FROM austa_private.listing_detail_metrics ORDER BY public_number');
 assert.equal(rows.length,6);assert.equal(new Set(rows.map(r=>String(r.public_number))).size,6);assert(rows.every(r=>Number(r.view_count)===0));
 const first=rows.find(r=>r.listing_id===L).public_number;
 await db.exec(migration);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM austa_private.listing_detail_metrics')).rows[0].n,6);
 assert.equal((await db.query('SELECT public_number FROM austa_private.listing_detail_metrics WHERE listing_source=$1 AND listing_id=$2',['vehicle',L])).rows[0].public_number,first);
});
test('views are deduplicated for 24h, bounded per visitor, and never count owner self-views',async()=>{
 const visitor=randomUUID();
 const first=(await as(B,()=>db.query('SELECT public.austa_record_listing_detail_view($1,$2,$3) AS n',['vehicle',L,visitor]))).rows[0].n;
 const repeated=(await as(B,()=>db.query('SELECT public.austa_record_listing_detail_view($1,$2,$3) AS n',['vehicle',L,visitor]))).rows[0].n;
 assert.equal(first,1);assert.equal(repeated,1);
 assert.equal((await as(B,()=>db.query('SELECT public.austa_record_listing_detail_view($1,$2,$3) AS n',['vehicle',L,randomUUID()]))).rows[0].n,1,'authenticated identity cannot rotate visitor tokens');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM austa_private.listing_view_visitors WHERE listing_source=$1 AND listing_id=$2',['vehicle',L])).rows[0].n,1);
 const owner=(await as(A,()=>db.query('SELECT public.austa_record_listing_detail_view($1,$2,$3) AS n',['vehicle',L,randomUUID()]))).rows[0].n;
 assert.equal(owner,1);
 await db.query("UPDATE austa_private.listing_view_visitors SET viewed_at=now()-interval '25 hours' WHERE listing_source='vehicle' AND listing_id=$1 AND visitor_id=$2",[L,B]);
 assert.equal((await as(B,()=>db.query('SELECT public.austa_record_listing_detail_view($1,$2,$3) AS n',['vehicle',L,visitor]))).rows[0].n,2);
});
test('metadata RPC hides unpublished rows from non-owners and returns their real updated_at',async()=>{
 const hidden=(await as(B,()=>db.query('SELECT * FROM public.austa_get_listing_detail_metadata($1,$2)',['vehicle',D]))).rows;
 assert.equal(hidden.length,0);
 const owner=(await as(A,()=>db.query('SELECT * FROM public.austa_get_listing_detail_metadata($1,$2)',['vehicle',D]))).rows;
 assert.equal(owner.length,1);assert(owner[0].public_number>0);assert.equal(Number(owner[0].view_count),0);
});
test('price history begins at rollout-known price and records atomic genuine changes only',async()=>{
 const baseline=(await db.query('SELECT * FROM austa_private.listing_price_history WHERE listing_source=$1 AND listing_id=$2',['vehicle',L])).rows;
 assert.equal(baseline.length,1);assert.equal(Number(baseline[0].price),10000);assert.equal(baseline[0].initial_known,true);
 await db.query('UPDATE public.vehicle_listings SET price=10000 WHERE id=$1',[L]);
 assert.equal((await db.query('SELECT count(*)::int n FROM austa_private.listing_price_history WHERE listing_source=$1 AND listing_id=$2',['vehicle',L])).rows[0].n,1);
 await db.query('UPDATE public.vehicle_listings SET price=9000,updated_at=now()+interval \'1 second\' WHERE id=$1',[L]);
 assert.notEqual((await db.query('SELECT updated_at FROM public.vehicle_listings WHERE id=$1',[L])).rows[0].updated_at,(await db.query('SELECT updated_at FROM public.vehicle_listings WHERE id=$1',[L])).rows[0].created_at);
 await db.query('UPDATE public.vehicle_listings SET price=9000 WHERE id=$1',[L]);
 await db.query('UPDATE public.vehicle_listings SET price=11000,updated_at=now()+interval \'2 seconds\' WHERE id=$1',[L]);
 const history=(await db.query('SELECT price,initial_known FROM austa_private.listing_price_history WHERE listing_source=$1 AND listing_id=$2 ORDER BY changed_at,id',['vehicle',L])).rows;
 assert.deepEqual(history.map(r=>[Number(r.price),r.initial_known]),[[10000,true],[9000,false],[11000,false]]);
});
test('price history is public only for active listing; own report and anonymous report are rejected',async()=>{
 const rows=(await as(B,()=>db.query('SELECT * FROM public.austa_get_listing_price_history($1,$2)',['vehicle',L]))).rows;
 assert.equal(rows.length,3);
 await db.query("UPDATE public.vehicle_listings SET status='archived' WHERE id=$1",[L]);
 assert.equal((await as(B,()=>db.query('SELECT * FROM public.austa_get_listing_price_history($1,$2)',['vehicle',L]))).rows.length,0);
 await assert.rejects(as(null,()=>db.query('SELECT public.austa_report_listing($1,$2,$3,$4)',['vehicle',L,'other','']),'anon'),{code:'42501'});
 await assert.rejects(as(A,()=>db.query('SELECT public.austa_report_listing($1,$2,$3,$4)',['vehicle',L,'other',''])),/unavailable|own/i);
});
test('report RPC enforces auth, active visibility, ownership and one report per actor',async()=>{
 const result=(await as(A,()=>db.query('SELECT public.austa_report_listing($1,$2,$3,$4) AS id',['vehicle',LB,'misleading_price','Qiymət dəyişdirilib']))).rows[0].id;
 assert.match(result,/^[0-9a-f-]{36}$/i);
 await assert.rejects(as(A,()=>db.query('SELECT public.austa_report_listing($1,$2,$3,$4)',['vehicle',LB,'other',''])),{code:'23505'});
 await assert.rejects(as(B,()=>db.query('SELECT public.austa_report_listing($1,$2,$3,$4)',['vehicle',LB,'other',''])),/own listing/i);
 await assert.rejects(as(A,()=>db.query('SELECT public.austa_report_listing($1,$2,$3,$4)',['vehicle',LB,'bad_reason',''])),/Invalid report/i);
});
test('private metric, visitor and report tables cannot be read directly by browser roles',async()=>{
 for(const table of ['listing_detail_metrics','listing_view_visitors','listing_price_history','listing_reports']){
  await assert.rejects(as(B,()=>db.query(`SELECT * FROM austa_private.${table}`)),{code:'42501'});
 }
});
test('focused browser contract covers all sources, only real canonical fields and actions',()=>{
 const html=read('index.html');
 const js=read('assets/marketplace/listing-detail-v36.js'),css=read('assets/marketplace/listing-detail-v36.css');
 assert.match(html,/assets\/marketplace\/listing-detail-v36\.js/);assert.match(html,/assets\/marketplace\/listing-detail-v36\.css/);
 assert.match(js,/data-v36-listing-metadata/);assert.match(js,/austa_record_listing_detail_view/);assert.match(js,/austa_get_listing_detail_metadata/);
 assert.match(js,/data-favorite-source/);assert.match(js,/data-v36-report/);assert.match(js,/data-v36-price-history/);
 assert.match(js,/data-v36-promotion="boost"[\s\S]*?data-v36-promotion="vip"[\s\S]*?data-v36-promotion="premium"/);
 assert.match(js,/austa_get_listing_price_history/);assert.match(js,/austa_report_listing/);
 assert.match(js,/austa-v36-spec-row/);assert.match(css,/@media\(max-width:600px\)[\s\S]*?austa-v36-spec-row\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(js,/data-v36-fullscreen/);
 assert.doesNotMatch(js,/view_count\s*\|\|\s*Math\.random|Math\.random\(\).*view/i);
});
