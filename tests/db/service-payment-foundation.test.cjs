const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const migration=fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261127100000_v4314_service_payment_wallet_foundation.sql'),'utf8');
const lockMigration=fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261127110000_v4314_lock_down_payment_data.sql'),'utf8');
const statementMigration=fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261127140000_v4314_wallet_statement.sql'),'utf8');

test('service payment foundation keeps provider and tariff disabled by default',()=>{
  assert.match(migration,/active boolean NOT NULL DEFAULT false/);
  assert.doesNotMatch(migration,/INSERT INTO austa_private\.service_commission_tariffs/i);
  assert.match(migration,/payment_method text NOT NULL DEFAULT 'cash'/);
  assert.match(migration,/payment_status text NOT NULL DEFAULT 'unconfigured'/);
  assert.match(migration,/o\.payment_method='card'.*card settlement provider is not configured/s);
});

test('wallet changes are transactionally locked, idempotent, and ledger append-only',()=>{
  assert.match(migration,/provider_wallet_ledger_immutable BEFORE UPDATE OR DELETE/);
  assert.match(migration,/UNIQUE\(owner_id,request_id,entry_type\)/);
  assert.match(migration,/FOR UPDATE/);
  assert.match(migration,/balance_minor-w\.reserved_minor<delta/);
  assert.match(migration,/austa_settle_service_commission/);
  assert.match(migration,/austa_release_service_commission/);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.austa_(?:reserve|settle|release)_service_commission[^;]+FROM PUBLIC,anon,authenticated/s);
});

test('card records can contain provider tokens and metadata only, never PAN or CVV fields',()=>{
  const cardTable=migration.slice(migration.indexOf('CREATE TABLE IF NOT EXISTS austa_private.saved_payment_tokens'),migration.indexOf('CREATE TABLE IF NOT EXISTS austa_private.payment_provider_events'));
  assert.match(cardTable,/provider_token text NOT NULL/);
  assert.match(cardTable,/last4 char\(4\)/);
  assert.doesNotMatch(cardTable,/card_number|pan|cvv|cvc/i);
  assert.match(migration,/payment_provider_events/);
  assert.match(lockMigration,/GRANT SELECT\(id,owner_id,provider,brand,last4,exp_month,exp_year,created_at\)/);
  assert.match(lockMigration,/REVOKE ALL ON austa_private\.payment_provider_events FROM PUBLIC,anon,authenticated/);
  assert.match(lockMigration,/ALTER TABLE austa_private\.service_financial_records ENABLE ROW LEVEL SECURITY/);
});

test('wallet statement returns only the authenticated provider totals and history',()=>{
  assert.match(statementMigration,/SECURITY DEFINER SET search_path=''/);
  assert.match(statementMigration,/fr\.provider_id=auth\.uid\(\) AND fr\.status='settled'/);
  assert.match(statementMigration,/owner_id=auth\.uid\(\)/);
  assert.match(statementMigration,/GRANT EXECUTE ON FUNCTION public\.austa_get_my_wallet_statement\(\) TO authenticated/);
  assert.match(statementMigration,/REVOKE ALL ON FUNCTION public\.austa_get_my_wallet_statement\(\) FROM PUBLIC,anon/);
});
