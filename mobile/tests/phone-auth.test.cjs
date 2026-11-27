const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const helper = fs.readFileSync(path.join(root, 'src/lib/phone-auth.ts'), 'utf8');
const emitted = ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const box = { exports: {} };
vm.runInNewContext(emitted, { exports: box.exports, module: { exports: box.exports } });
const normalize = box.exports.normalizeAzerbaijaniPhone;

test('Azerbaijan phone input normalizes to canonical E.164', () => {
  assert.equal(normalize('0103999217'), '+994103999217');
  assert.equal(normalize('+994 10 399 92 17'), '+994103999217');
  assert.equal(normalize('994103999217'), '+994103999217');
  assert.equal(normalize('00994103999217'), '+994103999217');
  assert.equal(normalize('not-a-phone'), null);
  assert.equal(normalize('+12025550123'), null);
});

test('mobile auth uses Supabase phone OTP and verified phone linking', () => {
  const source = fs.readFileSync(path.join(root, 'src/components/AccountScreens.tsx'), 'utf8');
  assert.match(source, /signInWithOtp\(\{phone:normalized/);
  assert.match(source, /verifyOtp\(\{phone:normalized,token:otp\.trim\(\),type:linkCurrentAccount\?'phone_change':'sms'\}\)/);
  assert.match(source, /updateUser\(\{phone:normalized\}\)/);
  assert.match(source, /shouldCreateUser:authMode==='signup'/);
});
