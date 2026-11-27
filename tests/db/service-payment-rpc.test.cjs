const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'../..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261127100000_v4314_service_payment_wallet_foundation.sql'),'utf8');
const lockMigration=fs.readFileSync(path.join(root,'supabase/migrations/20261127110000_v4314_lock_down_payment_data.sql'),'utf8');
const idempotencyMigration=fs.readFileSync(path.join(root,'supabase/migrations/20261127120000_v4314_commission_reservation_idempotency.sql'),'utf8');
const lifecycleMigration=fs.readFileSync(path.join(root,'supabase/migrations/20261127130000_v4314_service_order_wallet_lifecycle.sql'),'utf8');
const statementMigration=fs.readFileSync(path.join(root,'supabase/migrations/20261127140000_v4314_wallet_statement.sql'),'utf8');
const customer='10000000-0000-4000-8000-000000000001', provider='20000000-0000-4000-8000-000000000001';
const order='30000000-0000-4000-8000-000000000001', assignment='40000000-0000-4000-8000-000000000001';
const request='50000000-0000-4000-8000-000000000001';
let db;
async function scalar(sql,params=[]){return (await db.query(sql,params)).rows[0];}
async function call(sql,params=[]){await db.exec('SET ROLE service_role');try{return await scalar(sql,params);}finally{await db.exec('RESET ROLE');}}
async function reserve(orderId=order,providerId=provider,key=request){return call('SELECT * FROM public.austa_reserve_service_commission($1,$2,$3)',[orderId,providerId,key]);}

test('wallet commission reservation, repricing, settlement and release are atomic/idempotent',async t=>{
 db=new PGlite();
 try{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE SCHEMA austa_private; CREATE TABLE austa_private.promotion_payment_intents(id uuid);
    CREATE TABLE public.service_orders(id uuid PRIMARY KEY,customer_id uuid NOT NULL REFERENCES auth.users(id),status text NOT NULL,service_category text NOT NULL,final_price numeric,proposed_price numeric,estimated_price_max numeric);
    CREATE TABLE public.service_order_assignments(id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES public.service_orders(id),provider_id uuid NOT NULL REFERENCES auth.users(id),status text NOT NULL);
    INSERT INTO auth.users VALUES('${customer}'),('${provider}');`);
  await db.exec(migration);
  await db.exec(`INSERT INTO austa_private.service_commission_tariffs(service_category,commission_bps,active) VALUES('mechanic_service',100,true);
    INSERT INTO austa_private.provider_wallets(owner_id,balance_minor) VALUES('${provider}',100000);
    INSERT INTO public.service_orders(id,customer_id,status,service_category,proposed_price) VALUES('${order}','${customer}','accepted','mechanic_service',100);
    INSERT INTO public.service_order_assignments(id,order_id,provider_id,status) VALUES('${assignment}','${order}','${provider}','accepted');`);
  const [first,replay]=await Promise.all([reserve(),reserve()]);assert.deepEqual(first,{result:'reserved',commission_minor:100});assert.deepEqual(replay,first);
  let wallet=await scalar('SELECT balance_minor,reserved_minor FROM austa_private.provider_wallets WHERE owner_id=$1',[provider]);
  assert.deepEqual(wallet,{balance_minor:100000,reserved_minor:100});
  assert.equal((await scalar('SELECT count(*)::int AS n FROM austa_private.provider_wallet_ledger')).n,1);
  await db.exec(`UPDATE public.service_orders SET proposed_price=200 WHERE id='${order}'`);
  const repriced=await reserve(order,provider,'50000000-0000-4000-8000-000000000002');assert.equal(repriced.commission_minor,200);
  wallet=await scalar('SELECT balance_minor,reserved_minor FROM austa_private.provider_wallets WHERE owner_id=$1',[provider]);
  assert.deepEqual(wallet,{balance_minor:100000,reserved_minor:200});
  const split=await scalar('SELECT gross_minor,provider_earning_minor,commission_minor,status FROM austa_private.service_financial_records WHERE order_id=$1',[order]);
  assert.deepEqual(split,{gross_minor:20000,provider_earning_minor:19800,commission_minor:200,status:'reserved'});
  await db.exec(`UPDATE public.service_orders SET status='completed' WHERE id='${order}'`);
  assert.equal(await call('SELECT public.austa_settle_service_commission($1,$2) AS result',[order,request]).then(x=>x.result),'settled');
  assert.equal(await call('SELECT public.austa_settle_service_commission($1,$2) AS result',[order,request]).then(x=>x.result),'settled');
  wallet=await scalar('SELECT balance_minor,reserved_minor FROM austa_private.provider_wallets WHERE owner_id=$1',[provider]);
  assert.deepEqual(wallet,{balance_minor:99800,reserved_minor:0});
  assert.equal((await scalar('SELECT count(*)::int AS n FROM austa_private.provider_wallet_ledger')).n,3);
  await assert.rejects(()=>db.exec(`UPDATE austa_private.provider_wallet_ledger SET amount_delta_minor=1`),/append-only/);
  await assert.rejects(()=>db.exec(`DELETE FROM austa_private.provider_wallet_ledger`),/append-only/);
  const cancelled='30000000-0000-4000-8000-000000000002',aid2='40000000-0000-4000-8000-000000000002';
  await db.exec(`INSERT INTO public.service_orders(id,customer_id,status,service_category,proposed_price) VALUES('${cancelled}','${customer}','accepted','mechanic_service',50);
    INSERT INTO public.service_order_assignments(id,order_id,provider_id,status) VALUES('${aid2}','${cancelled}','${provider}','accepted');`);
  const reserved=await reserve(cancelled,provider,'50000000-0000-4000-8000-000000000003');assert.equal(reserved.commission_minor,50);
  await db.exec(`UPDATE public.service_orders SET status='cancelled' WHERE id='${cancelled}'`);
  assert.equal(await call('SELECT public.austa_release_service_commission($1,$2) AS result',[cancelled,'50000000-0000-4000-8000-000000000004']).then(x=>x.result),'released');
  assert.equal(await call('SELECT public.austa_release_service_commission($1,$2) AS result',[cancelled,'50000000-0000-4000-8000-000000000004']).then(x=>x.result),'released');
  wallet=await scalar('SELECT balance_minor,reserved_minor FROM austa_private.provider_wallets WHERE owner_id=$1',[provider]);assert.deepEqual(wallet,{balance_minor:99800,reserved_minor:0});
 } finally { await db?.close(); }
});

test('card, absent tariff and insufficient wallet never create a reservation',async()=>{
 db=new PGlite();
 try{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE SCHEMA austa_private; CREATE TABLE austa_private.promotion_payment_intents(id uuid);
    CREATE TABLE public.service_orders(id uuid PRIMARY KEY,customer_id uuid NOT NULL REFERENCES auth.users(id),status text NOT NULL,service_category text NOT NULL,payment_method text NOT NULL DEFAULT 'cash',final_price numeric,proposed_price numeric,estimated_price_max numeric);
    CREATE TABLE public.service_order_assignments(id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES public.service_orders(id),provider_id uuid NOT NULL REFERENCES auth.users(id),status text NOT NULL);
    INSERT INTO auth.users VALUES('${customer}'),('${provider}');`);
  await db.exec(migration);
  await db.exec(`INSERT INTO austa_private.service_commission_tariffs(service_category,commission_bps,active) VALUES('mechanic_service',100,true);
    INSERT INTO austa_private.provider_wallets(owner_id,balance_minor) VALUES('${provider}',0);
    INSERT INTO public.service_orders(id,customer_id,status,service_category,payment_method,proposed_price) VALUES('${order}','${customer}','accepted','mechanic_service','card',100);
    INSERT INTO public.service_order_assignments(id,order_id,provider_id,status) VALUES('${assignment}','${order}','${provider}','accepted');`);
  await assert.rejects(()=>reserve(),/card settlement provider is not configured/);
  await db.exec(`UPDATE public.service_orders SET payment_method='cash' WHERE id='${order}'`);
  await assert.rejects(()=>reserve(),/insufficient provider wallet balance/);
  const noTariff='30000000-0000-4000-8000-000000000002',noTariffAssignment='40000000-0000-4000-8000-000000000002';
  await db.exec(`INSERT INTO public.service_orders(id,customer_id,status,service_category,proposed_price) VALUES('${noTariff}','${customer}','accepted','tow_service',100);
    INSERT INTO public.service_order_assignments(id,order_id,provider_id,status) VALUES('${noTariffAssignment}','${noTariff}','${provider}','accepted');`);
  await assert.rejects(()=>reserve(noTariff,provider,'50000000-0000-4000-8000-000000000002'),/commission tariff is not configured/);
  assert.equal((await scalar('SELECT count(*)::int AS n FROM austa_private.service_financial_records')).n,0);
  assert.equal((await scalar('SELECT reserved_minor FROM austa_private.provider_wallets WHERE owner_id=$1',[provider])).reserved_minor,0);
 } finally { await db?.close(); }
});

test('existing order acceptance, price changes, completion and cancellation call the wallet atomically',async()=>{
 db=new PGlite();
 try{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE SCHEMA austa_private; CREATE TABLE austa_private.promotion_payment_intents(id uuid);
    CREATE TABLE public.service_orders(id uuid PRIMARY KEY,customer_id uuid NOT NULL REFERENCES auth.users(id),status text NOT NULL,service_category text NOT NULL,final_price numeric,proposed_price numeric,estimated_price_max numeric);
    CREATE TABLE public.service_order_assignments(id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES public.service_orders(id),provider_id uuid NOT NULL REFERENCES auth.users(id),status text NOT NULL);
    INSERT INTO auth.users VALUES('${customer}'),('${provider}');`);
  await db.exec(migration);await db.exec(lockMigration);await db.exec(idempotencyMigration);await db.exec(lifecycleMigration);await db.exec(statementMigration);
  await db.exec(`INSERT INTO austa_private.service_commission_tariffs(service_category,commission_bps,active) VALUES('mechanic_service',100,true);
    INSERT INTO austa_private.provider_wallets(owner_id,balance_minor) VALUES('${provider}',100000);
    INSERT INTO public.service_orders(id,customer_id,status,service_category,proposed_price) VALUES('${order}','${customer}','pending','mechanic_service',100);
    INSERT INTO public.service_order_assignments(id,order_id,provider_id,status) VALUES('${assignment}','${order}','${provider}','offered');`);
  await db.exec(`UPDATE public.service_orders SET status='accepted' WHERE id='${order}';
    UPDATE public.service_order_assignments SET status='accepted' WHERE id='${assignment}';`);
  assert.deepEqual(await scalar('SELECT balance_minor,reserved_minor FROM austa_private.provider_wallets WHERE owner_id=$1',[provider]),{balance_minor:100000,reserved_minor:100});
  await db.exec(`UPDATE public.service_orders SET proposed_price=200 WHERE id='${order}'`);
  assert.deepEqual(await scalar('SELECT balance_minor,reserved_minor FROM austa_private.provider_wallets WHERE owner_id=$1',[provider]),{balance_minor:100000,reserved_minor:200});
  await db.exec(`UPDATE public.service_orders SET status='completed' WHERE id='${order}'`);
  assert.deepEqual(await scalar('SELECT balance_minor,reserved_minor FROM austa_private.provider_wallets WHERE owner_id=$1',[provider]),{balance_minor:99800,reserved_minor:0});
  assert.equal((await scalar('SELECT status FROM austa_private.service_financial_records WHERE order_id=$1',[order])).status,'settled');
  await db.exec(`SET request.jwt.claim.sub='${provider}'; SET ROLE authenticated`);
  const statement=await scalar('SELECT * FROM public.austa_get_my_wallet_statement()');
  assert.equal(statement.earnings_minor,19800);assert.equal(statement.commission_minor,200);assert.equal(statement.balance_minor,99800);
  await db.exec('RESET ROLE; RESET request.jwt.claim.sub');

  const cancelled='30000000-0000-4000-8000-000000000002',aid='40000000-0000-4000-8000-000000000002';
  await db.exec(`INSERT INTO public.service_orders(id,customer_id,status,service_category,proposed_price) VALUES('${cancelled}','${customer}','pending','mechanic_service',50);
    INSERT INTO public.service_order_assignments(id,order_id,provider_id,status) VALUES('${aid}','${cancelled}','${provider}','offered');
    UPDATE public.service_orders SET status='accepted' WHERE id='${cancelled}';
    UPDATE public.service_order_assignments SET status='accepted' WHERE id='${aid}';
    UPDATE public.service_orders SET status='cancelled' WHERE id='${cancelled}';`);
  assert.deepEqual(await scalar('SELECT balance_minor,reserved_minor FROM austa_private.provider_wallets WHERE owner_id=$1',[provider]),{balance_minor:99800,reserved_minor:0});
  assert.equal((await scalar('SELECT status FROM austa_private.service_financial_records WHERE order_id=$1',[cancelled])).status,'released');
 } finally { await db?.close(); }
});
