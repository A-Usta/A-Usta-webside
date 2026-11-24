const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require(path.resolve(__dirname, '../node_modules/typescript'));

const sourcePath = path.resolve(__dirname, '../src/lib/listing-request.ts');
const compiled = ts.transpile(fs.readFileSync(sourcePath, 'utf8'), { module: ts.ModuleKind.CommonJS });
const requestModule = new Module(sourcePath, module);
requestModule.filename = sourcePath;
requestModule.paths = Module._nodeModulePaths(path.dirname(sourcePath));
requestModule._compile(compiled, sourcePath);
const { runListingRequest, safeListingRequest, withListingTimeout } = requestModule.exports;

test('a timed-out PostgREST request aborts its signal and returns a bounded timeout error', async () => {
  let observedSignal;
  await assert.rejects(runListingRequest(signal => {
    observedSignal = signal;
    return { abortSignal: next => new Promise((_, reject) => next.addEventListener('abort', () => reject(new Error('aborted')))) };
  }, { timeoutMs: 10 }), error => error.code === 'LISTING_TIMEOUT');
  assert.equal(observedSignal.aborted, true);
});

test('only transient read failures are retried when explicitly enabled', async () => {
  let attempts = 0;
  const result = await runListingRequest(() => ({
    abortSignal: async () => ++attempts === 1 ? { data: null, error: { status: 503 } } : { data: ['row'], error: null },
  }), { retries: 1, timeoutMs: 100 });
  assert.equal(attempts, 2);
  assert.deepEqual(result.data, ['row']);

  attempts = 0;
  const failure = await safeListingRequest(() => ({
    abortSignal: async () => { attempts += 1; return { data: null, error: { status: 400, code: 'PGRST204' } }; },
  }), { retries: 1, timeoutMs: 100 });
  assert.equal(attempts, 1);
  assert.equal(failure.error.code, 'PGRST204');
});

test('a late storage completion triggers cleanup after the UI timeout', async () => {
  let cleaned = false;
  const operation = new Promise(resolve => setTimeout(() => resolve({ data: { path: 'owner/listing/file.jpg' }, error: null }), 25));
  await assert.rejects(withListingTimeout(operation, 5, async result => { cleaned = result.data.path.endsWith('file.jpg'); }), error => error.code === 'LISTING_TIMEOUT');
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(cleaned, true);
});
