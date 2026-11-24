const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/user-error.ts'), 'utf8');
const js = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
const moduleUnderTest = { exports: {} };
vm.runInNewContext(`(function(exports,module){${js}\n})(module.exports,module)`, { module: moduleUnderTest, Error });
const { userErrorMessage } = moduleUnderTest.exports;

test('network and permission diagnostics are mapped to clear Azerbaijani messages', () => {
  assert.equal(userErrorMessage(new Error('Network request failed')), 'İnternet bağlantısını yoxlayın və yenidən cəhd edin.');
  const permission = new Error('new row violates row-level security policy');
  permission.code = '42501';
  assert.equal(userErrorMessage(permission), 'Bu əməliyyat üçün hesab icazəsi təsdiqlənmədi. Hesabınızı yoxlayın və yenidən cəhd edin.');
});

test('app-authored Azerbaijani validation is preserved and raw server English is hidden', () => {
  assert.equal(userErrorMessage(new Error('Marka və model daxil edin.')), 'Marka və model daxil edin.');
  assert.equal(userErrorMessage(new Error('Unexpected error from storage backend')), 'Xəta baş verdi. Yenidən cəhd edin.');
});
