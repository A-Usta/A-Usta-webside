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
