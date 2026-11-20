'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'../..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261120120000_v38_seller_messaging.sql'),'utf8');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const L='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',LB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const request=randomUUID(),hidden=randomUUID();let db,conversation;
async function as(uid,fn,role='authenticated'){
 await db.exec(`SET ROLE ${role}`);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid||'']);
 try{return await fn();}finally{await db.exec('RESET ROLE');}
}
before(async()=>{
 db=new PGlite();
 await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,created_at timestamptz NOT NULL);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;GRANT USAGE ON SCHEMA auth TO anon,authenticated;
 CREATE SCHEMA austa_private;GRANT USAGE ON SCHEMA austa_private TO anon,authenticated;
 CREATE TABLE austa_private.fixture_listings(source text,id uuid,owner_id uuid,status text,updated_at timestamptz,PRIMARY KEY(source,id));
 CREATE FUNCTION austa_private.v36_listing_exists(p_source text,p_id uuid,p_active_only boolean DEFAULT true) RETURNS TABLE(owner_id uuid,updated_at timestamptz,price numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT f.owner_id,f.updated_at,NULL::numeric FROM austa_private.fixture_listings f WHERE f.source=p_source AND f.id=p_id AND (NOT p_active_only OR f.status='active')$$;
 CREATE TABLE austa_private.listing_detail_metrics(listing_source text,listing_id uuid,public_number bigint,PRIMARY KEY(listing_source,listing_id));
 INSERT INTO auth.users VALUES('${A}','2017-08-12T00:00:00Z'),('${B}','2018-02-03T00:00:00Z'),('${C}','2020-05-08T00:00:00Z');
 INSERT INTO austa_private.fixture_listings VALUES('vehicle','${L}','${B}','active',now()),('vehicle','${LB}','${A}','active',now()),('vehicle','${hidden}','${B}','archived',now());
 INSERT INTO austa_private.listing_detail_metrics VALUES('vehicle','${L}',12541265),('vehicle','${LB}',12541266);
 `);
 await db.exec(migration);
});
after(async()=>db?.close());

test('listing owner is derived server-side; same buyer reuses one conversation',async()=>{
 const first=(await as(A,()=>db.query("SELECT public.austa_open_listing_conversation('vehicle',$1) id",[L]))).rows[0].id;
 const repeated=(await as(A,()=>db.query("SELECT public.austa_open_listing_conversation('vehicle',$1) id",[L]))).rows[0].id;
 assert.equal(first,repeated);conversation=first;
 assert.equal((await db.query('SELECT buyer_id,seller_id FROM austa_private.listing_conversations WHERE id=$1',[first])).rows[0].seller_id,B);
 await assert.rejects(as(B,()=>db.query("SELECT public.austa_open_listing_conversation('vehicle',$1)",[L])),{code:'42501'});
 await assert.rejects(as(C,()=>db.query("SELECT public.austa_open_listing_conversation('vehicle',$1)",[randomUUID()])),{code:'22023'});
 await assert.rejects(as(null,()=>db.query("SELECT public.austa_open_listing_conversation('vehicle',$1)",[L]),'anon'),{code:'42501'});
});

test('message writes are authenticated, idempotent and sender cannot be forged',async()=>{
 const one=(await as(A,()=>db.query('SELECT * FROM public.austa_send_listing_message($1,$2,$3)',[conversation,request,'Salam, lizinq təklifi ilə maraqlanıram.']))).rows[0];
 const retry=(await as(A,()=>db.query('SELECT * FROM public.austa_send_listing_message($1,$2,$3)',[conversation,request,'Salam, lizinq təklifi ilə maraqlanıram.']))).rows[0];
 assert.equal(one.message_id,retry.message_id);assert.equal(one.sender_id,A);
 assert.equal((await db.query('SELECT count(*)::int n FROM austa_private.listing_messages WHERE conversation_id=$1',[conversation])).rows[0].n,1);
 await assert.rejects(as(null,()=>db.query('SELECT * FROM public.austa_send_listing_message($1,$2,$3)',[conversation,randomUUID(),'x']),'anon'),{code:'42501'});
 await assert.rejects(as(C,()=>db.query('SELECT * FROM public.austa_send_listing_message($1,$2,$3)',[conversation,randomUUID(),'spoof'])),{code:'42501'});
 await assert.rejects(as(A,()=>db.query('SELECT * FROM public.austa_send_listing_message($1,$2,$3)',[conversation,randomUUID(),'   '])),{code:'22023'});
});

test('both participants share history, read state is recipient-only, unrelated users cannot read',async()=>{
 const seller=(await as(B,()=>db.query('SELECT * FROM public.austa_get_listing_messages($1)',[conversation]))).rows;
 assert.equal(seller.length,1);assert.equal(seller[0].sender_id,A);
 assert.equal((await as(B,()=>db.query('SELECT public.austa_unread_listing_message_count() n'))).rows[0].n,1);
 assert.equal((await as(B,()=>db.query('SELECT public.austa_mark_listing_messages_read($1) n',[conversation]))).rows[0].n,1);
 assert.equal((await as(B,()=>db.query('SELECT public.austa_unread_listing_message_count() n'))).rows[0].n,0);
 const reply=(await as(B,()=>db.query('SELECT * FROM public.austa_send_listing_message($1,$2,$3)',[conversation,randomUUID(),'Salam, məlumatı göndərirəm.']))).rows[0];
 assert.equal(reply.sender_id,B);
 assert.equal((await as(A,()=>db.query('SELECT count(*) n FROM public.austa_get_listing_messages($1)',[conversation]))).rows[0].n,2);
 await assert.rejects(as(C,()=>db.query('SELECT * FROM public.austa_get_listing_messages($1)',[conversation])),{code:'42501'});
 await assert.rejects(as(C,()=>db.query('SELECT public.austa_mark_listing_messages_read($1)',[conversation])),{code:'42501'});
});

test('conversation list contains only participant rows and registration date exposes timestamp only',async()=>{
 const rows=(await as(B,()=>db.query('SELECT * FROM public.austa_list_listing_conversations()'))).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].public_number,12541265);assert.equal(Number(rows[0].unread_count),0);
 const joined=(await as(null,()=>db.query("SELECT * FROM public.austa_get_listing_seller_registered_at('vehicle',$1)",[L]),'anon')).rows[0].registered_at;
 assert.equal(new Date(joined).toISOString(),'2018-02-03T00:00:00.000Z');
 assert.equal((await as(null,()=>db.query("SELECT * FROM public.austa_get_listing_seller_registered_at('vehicle',$1)",[hidden]),'anon')).rows.length,0);
 assert.deepEqual((await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='austa_private' AND table_name='listing_conversations' ORDER BY ordinal_position")).rows.map(x=>x.column_name),['id','listing_source','listing_id','buyer_id','seller_id','created_at','last_message_at']);
});

test('private tables are RLS enabled and browser roles have no direct table access',async()=>{
 for(const name of ['listing_conversations','listing_messages']){
  const row=(await db.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',[`austa_private.${name}`])).rows[0];assert.equal(row.relrowsecurity,true);
  await assert.rejects(as(A,()=>db.query(`SELECT * FROM austa_private.${name}`)),{code:'42501'});
 }
});
