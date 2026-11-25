const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const read = file => fs.readFileSync(path.join(repoRoot, file), 'utf8');

test('V4.2 mobile CI runs for PRs against any base and gates Android JS export', () => {
  const workflow = read('.github/workflows/main.yml');
  assert.match(workflow, /pull_request:\s*\n\s*# PR #319/);
  assert.match(workflow, /mobile-regression:/);
  for (const command of ['typecheck', 'lint', 'build:android-js']) assert.match(workflow, new RegExp(`npm run ${command} --prefix mobile`));
  assert.match(workflow, /npm test --prefix mobile/);
  assert.doesNotMatch(workflow.slice(0, workflow.indexOf('  push:')), /branches:/);
});

test('workflow job identifiers are unique so GitHub creates the full check matrix', () => {
  const workflow = read('.github/workflows/main.yml');
  const jobs = workflow.split('jobs:\n')[1];
  assert.ok(jobs);
  const identifiers = [...jobs.matchAll(/^  ([A-Za-z0-9_-]+):/gm)].map(([, id]) => id);
  assert.equal(new Set(identifiers).size, identifiers.length);
  assert.equal(identifiers.filter(id => id === 'mobile-regression').length, 1);
});

test('mobile marketplace and account primary actions use the A-USTA red brand token', () => {
  const marketplace = read('mobile/src/components/MarketplaceScreens.tsx');
  const tabs = read('mobile/src/app/(drawer)/(tabs)/_layout.tsx');
  const account = read('mobile/src/components/AccountScreens.tsx');
  assert.match(marketplace, /const RED='#D92D20'/);
  assert.match(marketplace, /backgroundColor:RED/);
  assert.match(tabs, /tabBarActiveTintColor: RED/);
  assert.match(account, /button:\{[^}]*backgroundColor:RED/);
  assert.match(account, /success:\{[^}]*color:GREEN/);
});
