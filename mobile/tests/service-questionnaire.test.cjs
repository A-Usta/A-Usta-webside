const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mobile = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/service-questionnaire.json'), 'utf8'));

function extractObject(declaration, nextFunction) {
  const start = html.indexOf(declaration, html.indexOf('id="austa-v54-final-fix-js"'));
  assert.notEqual(start, -1, `${declaration} exists in the live website source`);
  const end = nextFunction ? html.indexOf(nextFunction, start) : -1;
  const close = html.lastIndexOf('};', end < 0 ? html.length : end) + 2;
  const context = {};
  const name = declaration.match(/const\s+(\w+)/)[1];
  vm.runInNewContext(`${html.slice(start, close)};globalThis.value=${name};`, context);
  return JSON.parse(JSON.stringify(context.value));
}

test('mobile mechanic question and select catalogs exactly match the live A-USTA website', () => {
  assert.deepEqual(mobile.questions, extractObject('const Q={', 'function serviceKey'));
  assert.deepEqual(mobile.options, extractObject('const O={', 'function serviceKey'));
  assert.equal(Object.keys(mobile.questions).length, 29);
});

test('service request keeps native file reads and sends selected answers through existing API contract', () => {
  const screen = fs.readFileSync(path.join(__dirname, '../src/components/ServiceScreens.tsx'), 'utf8');
  assert.match(screen, /new File\(asset\.uri\)/);
  assert.match(screen, /\.upload\(path,bytes/);
  assert.match(screen, /serviceQuestions\(serviceName\)/);
  assert.match(screen, /answers:OrderAnswer\[\]/);
  assert.match(screen, /form_version:'M4-MOBILE-SERVICE-1'/);
  assert.doesNotMatch(screen, /fetch\(asset\.uri\).*\.blob\(\)/);
});
