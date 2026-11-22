const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const account = fs.readFileSync(path.join(root, 'src/components/AccountScreens.tsx'), 'utf8');
const supabase = fs.readFileSync(path.join(root, 'src/lib/supabase.ts'), 'utf8');
const schema = fs.readFileSync(path.resolve(root, '../supabase/migrations/20261111235300_v33d2_personal_vehicle_history.sql'), 'utf8');
const idempotency = fs.readFileSync(path.resolve(root, '../supabase/migrations/20261112112645_v33d2_record_idempotency_hardening.sql'), 'utf8');
const messaging = fs.readFileSync(path.resolve(root, '../supabase/migrations/20261120120000_v38_seller_messaging.sql'), 'utf8');

test('M5 account uses existing email auth and secure persisted Supabase session', () => {
  assert.match(supabase, /expo-secure-store/);
  assert.match(supabase, /persistSession:\s*true/);
  assert.match(account, /signInWithPassword/);
  assert.match(account, /signUp/);
  assert.match(account, /resetPasswordForEmail/);
  assert.match(account, /auth\.signOut/);
  assert.match(account, /getSession\(\)/);
  assert.doesNotMatch(supabase, /service[_-]?role|SUPABASE_SECRET/i);
});

test('personal garage stays separate and every vehicle write is owner scoped', () => {
  assert.match(account, /from\('vehicles'\)/);
  assert.match(account, /eq\('user_id',ownerId\)/);
  assert.match(account, /eq\('user_id',user\.id\)/);
  assert.match(account, /\['vehicle_listings','vehicle',/);
  assert.match(schema, /CREATE POLICY v33d2_vehicle_owner_guard ON public\.vehicles AS RESTRICTIVE/);
  assert.match(schema, /user_id=\(SELECT auth\.uid\(\)\)/);
});

test('service history writes through idempotent RPC and edits only user entered records', () => {
  assert.match(account, /rpc\('create_vehicle_service_record'/);
  assert.match(account, /p_request_id:key/);
  assert.match(account, /SecureStore\.setItemAsync\(journalKey/);
  assert.match(account, /SecureStore\.deleteItemAsync/);
  assert.match(account, /eq\('source','user_entered'\)/);
  assert.match(idempotency, /CREATE FUNCTION public\.create_vehicle_service_record/);
  assert.match(idempotency, /pg_advisory_xact_lock/);
  assert.match(idempotency, /PRIMARY KEY\(owner_id,request_id\)/);
});

test('private service attachments validate owner, bucket and re-check the record before fetch', () => {
  assert.match(account, /vehicle_service_record_attachments/);
  assert.match(account, /owner_id',user\.id/);
  assert.match(account, /vehicle-service-evidence/);
  assert.match(account, /cacheNonce:uuid\(\)/);
  assert.match(account, /state','ready'/);
  assert.match(schema, /VALUES\('vehicle-service-evidence','vehicle-service-evidence',false/);
  assert.match(schema, /can_access_service_file\(name,'read'\)/);
});

test('PDF service attachments use the private backend contract and native preview flow', () => {
  assert.match(account, /expo-document-picker/);
  assert.match(account, /DocumentPicker\.getDocumentAsync\(\{type:'application\/pdf',copyToCacheDirectory:true/);
  assert.match(account, /\.eq\('owner_id',user\.id\)\.eq\('state','ready'\)/);
  assert.match(account, /new File\(Paths\.cache/);
  assert.match(account, /\.preview\(\{mimeType:'application\/pdf'/);
  assert.match(schema, /'application\/pdf'/);
});

test('messages and business profile use the existing participant and seller RPC contracts', () => {
  assert.match(account, /\(drawer\)\/\(tabs\)\/messages/);
  assert.match(account, /get_my_seller_profiles/);
  assert.match(messaging, /austa_list_listing_conversations/);
  assert.match(messaging, /austa_get_listing_messages/);
  assert.match(messaging, /austa_mark_listing_messages_read/);
  assert.match(messaging, /austa_send_listing_message/);
  assert.match(messaging, /actor IN\(c\.buyer_id,c\.seller_id\)/);
});

test('push capability is not fabricated when the repository has no notification delivery contract', () => {
  assert.match(account, /Push bildirişləri hazır deyil/);
  assert.match(account, /Saxta bildiriş göstərilmir və cihaz tokeni qeydə alınmır/);
});
