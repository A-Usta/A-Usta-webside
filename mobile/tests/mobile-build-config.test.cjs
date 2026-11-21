const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const TEST_URL = 'https://xnhxneziasqthkhhntkv.supabase.co';

function loadConfig(env) {
  return spawnSync(process.execPath, ['-e', "require('./app.config.js')"], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('M6 EAS profiles are TEST-only, create Android APKs and provide an iOS simulator build', () => {
  assert.deepEqual(Object.keys(eas.build).sort(), ['development', 'preview']);
  for (const profile of Object.values(eas.build)) {
    assert.equal(profile.environment, 'preview');
    assert.equal(profile.env.EXPO_PUBLIC_APP_ENV, 'test');
    assert.equal(profile.distribution, 'internal');
    assert.equal(profile.android.buildType, 'apk');
  }
  assert.equal(eas.build.development.ios.simulator, true);
  assert.equal(app.android.package, 'az.austa.mobile');
  assert.equal(app.ios.bundleIdentifier, 'az.austa.mobile');
  assert.equal(app.scheme, 'austa');
  assert.equal('production' in eas.build, false);
  assert.equal(JSON.stringify(eas).includes('SUPABASE_SERVICE_ROLE_KEY'), false);
});

test('TEST app config accepts only the separate Supabase project and rejects the known production API', () => {
  const valid = loadConfig({
    EXPO_PUBLIC_APP_ENV: 'test',
    EXPO_PUBLIC_SUPABASE_URL: TEST_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key-placeholder',
    EXPO_PUBLIC_SERVICE_API_URL: 'https://a-usta-test-api.example.invalid',
  });
  assert.equal(valid.status, 0, valid.stderr);

  const productionSupabase = loadConfig({
    EXPO_PUBLIC_APP_ENV: 'test',
    EXPO_PUBLIC_SUPABASE_URL: 'https://yafpnqcoyvoclmxdlxxc.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key-placeholder',
    EXPO_PUBLIC_SERVICE_API_URL: 'https://a-usta-test-api.example.invalid',
  });
  assert.notEqual(productionSupabase.status, 0);
  assert.match(productionSupabase.stderr, /verified A-USTA-TEST Supabase URL/);

  const productionApi = loadConfig({
    EXPO_PUBLIC_APP_ENV: 'test',
    EXPO_PUBLIC_SUPABASE_URL: TEST_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key-placeholder',
    EXPO_PUBLIC_SERVICE_API_URL: 'https://a-usta-webside.onrender.com',
  });
  assert.notEqual(productionApi.status, 0);
  assert.match(productionApi.stderr, /must not use the production Render API/);
});
