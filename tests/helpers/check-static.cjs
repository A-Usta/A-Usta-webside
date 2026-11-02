const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const digest = body => createHash('sha256').update(body).digest('hex');

// Reviewed tooling and real-browser tests: an early return/skip cannot replace
// Chromium execution while leaving this independent backend/static gate green.
const reviewedFiles = {
  "tests/package.json": "156d49124509a070a0e05f5a067da746a6ad52bb1339a4111f89ed378f9deba1",
  "tests/package-lock.json": "a8c0592f8094f5eec64e3f2ddd1e626083339c99d41c763d6f407c7c732033d1",
  "tests/db/package.json": "6ba43139036db3440a1222832c6db9fc3254693c7031cb61b12f0170dc60c1a2",
  "tests/category-detail-presentation.test.cjs": "a7382a6ede8bbc9ad1b13a4b57c1bcb9ecce3437eb6d6ae7175d93630d52826e",
  "tests/dealer-legacy-condition.test.cjs": "b668ac9e668ecb8f04c6a9a4cbf1450466e35a487bb6c1f096b2d87152397c14"
};
const legacy = [
  ['austa-v16-professional-flow-patch', '5fba6d8088946960717f19ae9af9847665df46939c52cc6e756d5e72cf83a752'],
  ['austa-v34-final-js', 'd98ecc696e756966490975c836f7399c593d28d8db8e9e9181651a8919b80ac4'],
  ['austa-v47-fix', 'ac728e4bb2853035bbdb3ac0f22fbdaebeaa9dc13a6ddddae2823410729cb8c5'],
  ['austa-market-v106-js', '934087053fcfe92b4f61940456d29fc18de0c5746060b24486d24f59ed7b9141'],
  [null, '21b0a006ee634f1dad4cb8634f01b2637fe8a9a0dc3d6a975089710444b3c68a']
];

function checkReviewedFiles(read = file => fs.readFileSync(path.join(root, file))) {
  for (const [file, expected] of Object.entries(reviewedFiles)) {
    assert.equal(digest(read(file)), expected, 'Reviewed tooling/browser contract changed: ' + file);
  }
}

function checkCatalog(source) {
  const context = {window: {}};
  vm.runInNewContext(source, context, {timeout: 5000, filename: 'assets/vehicle/catalog.js'});
  const catalog = context.window.AUSTA_VEHICLE_CATALOG;
  assert.equal(catalog.brands.length, 213, 'Catalog brand count');
  assert.equal(Object.values(catalog.models).reduce((n, models) => n + models.length, 0), 822, 'Catalog model count');
}

function checkJavaScript(file, source) {
  const result = cp.spawnSync(process.execPath, ['--check'], {
    input: source, encoding: 'utf8', cwd: root, timeout: 30000, maxBuffer: 2e6
  });
  assert.equal(result.error, undefined, 'Syntax checker could not execute: ' + file);
  assert.equal(result.signal, null, 'Syntax checker terminated: ' + file);
  assert.equal(result.status, 0, 'JavaScript syntax: ' + file + '\n' + result.stderr);
}

function checkInline(html) {
  const seen = new Set();
  let valid = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [_, attrs, body] = match;
    const type = attrs.match(/\btype\s*=\s*['"]([^'"]+)['"]/i)?.[1]?.toLowerCase();
    if (/\bsrc\s*=/i.test(attrs) || !body.trim() || (type && !['text/javascript', 'application/javascript', 'module'].includes(type))) continue;
    const id = attrs.match(/\bid\s*=\s*['"]([^'"]+)['"]/i)?.[1] ?? null;
    const hash = digest(body);
    const approved = legacy.find(entry => entry[1] === hash);
    if (approved) {
      assert.equal(id, approved[0], 'Legacy inline identity changed');
      assert.ok(!seen.has(hash), 'Duplicate legacy inline exception');
      assert.throws(() => new vm.Script(body), SyntaxError, 'Legacy body unexpectedly became valid');
      seen.add(hash);
    } else {
      try { new vm.Script(body, {filename: id || 'unnamed-inline'}); }
      catch (error) { assert.fail('Unapproved inline syntax failure: ' + (id || 'unnamed') + ': ' + error.message); }
      valid++;
    }
  }
  for (const [id, hash] of legacy) assert.ok(seen.has(hash), 'Missing exact legacy inline exception: ' + (id || 'unnamed'));
  assert.equal(valid, 81, 'Reviewed valid inline script inventory');
  return {valid, legacy: seen.size};
}

function main() {
  checkReviewedFiles();
  checkCatalog(fs.readFileSync(path.join(root, 'assets/vehicle/catalog.js'), 'utf8'));
  const files = cp.execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd: root, encoding: 'utf8'})
    .split('\0').filter(file => /\.(?:js|cjs)$/.test(file));
  assert.ok(files.length > 0, 'No JavaScript sources discovered');
  assert.equal(new Set(files).size, files.length, 'Duplicate JavaScript discovery');
  for (const file of files) checkJavaScript(file, fs.readFileSync(path.join(root, file), 'utf8'));
  const inline = checkInline(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  console.log(`Static PASS: catalog 213/822; ${files.length} JS/CJS; ${inline.valid} valid inline; ${inline.legacy} exact legacy exceptions; tooling/browser fingerprints`);
}

module.exports = {checkReviewedFiles, checkCatalog, checkJavaScript, checkInline, main};
if (require.main === module) main();
