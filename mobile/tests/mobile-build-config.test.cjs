const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const TEST_URL = 'https://xnhxneziasqthkhhntkv.supabase.co';
const TEST_API_URL = 'https://austa-v40-m7-test-api.onrender.com';
const serviceApi = fs.readFileSync(path.join(root, 'src/lib/service-orders.ts'), 'utf8');
const appConfig = fs.readFileSync(path.join(root, 'app.config.js'), 'utf8');

function loadConfig(env) {
  return spawnSync(process.execPath, ['-e', "require('./app.config.js')"], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('M6 EAS profiles are TEST-only, create Android APKs and provide iOS simulator and device builds', () => {
  assert.deepEqual(Object.keys(eas.build).sort(), [
    'development',
    'preview',
    'test-android',
    'test-ios-device',
    'test-ios-simulator',
  ]);
  for (const profile of Object.values(eas.build)) {
    assert.equal(profile.environment, 'preview');
    assert.equal(profile.env.EXPO_PUBLIC_APP_ENV, 'test');
    assert.equal(profile.distribution, 'internal');
  }
  assert.equal(eas.build.development.android.buildType, 'apk');
  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build['test-android'].android.buildType, 'apk');
  assert.equal(eas.build.development.ios.simulator, true);
  assert.equal(eas.build['test-ios-simulator'].ios.simulator, true);
  assert.notEqual(eas.build['test-ios-device'].ios?.simulator, true);
  assert.equal(app.owner, 'austa-az');
  assert.equal(app.slug, 'a-usta-mobile-fo0dl5bou9jy0p3h7snjv');
  assert.equal(app.extra.eas.projectId, '1b6dc2f0-e7df-4a1f-bc85-05c6a144101c');
  assert.equal(app.android.package, 'az.austa.mobile');
  assert.equal(app.ios.bundleIdentifier, 'az.austa.mobile');
  assert.equal(app.scheme, 'austa');
  assert.equal('production' in eas.build, false);
  assert.equal(JSON.stringify(eas).includes('SUPABASE_SERVICE_ROLE_KEY'), false);
});

test('TEST app config accepts only the separate Supabase project and rejects the known production API', () => {
  const valid = loadConfig({
    EXPO_PUBLIC_APP_ENV: 'test',
    EAS_BUILD_PLATFORM: 'android',
    EXPO_PUBLIC_SUPABASE_URL: TEST_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key-placeholder',
    EXPO_PUBLIC_SERVICE_API_URL: TEST_API_URL,
    GOOGLE_MAPS_ANDROID_API_KEY: 'test-only-map-key-sentinel',
  });
  assert.equal(valid.status, 0, valid.stderr);

  const productionSupabase = loadConfig({
    EXPO_PUBLIC_APP_ENV: 'test',
    EAS_BUILD_PLATFORM: 'android',
    EXPO_PUBLIC_SUPABASE_URL: 'https://yafpnqcoyvoclmxdlxxc.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key-placeholder',
    EXPO_PUBLIC_SERVICE_API_URL: TEST_API_URL,
    GOOGLE_MAPS_ANDROID_API_KEY: 'test-only-map-key-sentinel',
  });
  assert.notEqual(productionSupabase.status, 0);
  assert.match(productionSupabase.stderr, /verified A-USTA-TEST Supabase URL/);

  const productionApi = loadConfig({
    EXPO_PUBLIC_APP_ENV: 'test',
    EAS_BUILD_PLATFORM: 'android',
    EXPO_PUBLIC_SUPABASE_URL: TEST_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key-placeholder',
    EXPO_PUBLIC_SERVICE_API_URL: 'https://a-usta-webside.onrender.com',
    GOOGLE_MAPS_ANDROID_API_KEY: 'test-only-map-key-sentinel',
  });
  assert.notEqual(productionApi.status, 0);
  assert.match(productionApi.stderr, /verified TEST Render API origin/);

  const unknownTestApi = loadConfig({
    EXPO_PUBLIC_APP_ENV: 'test',
    EAS_BUILD_PLATFORM: 'android',
    EXPO_PUBLIC_SUPABASE_URL: TEST_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key-placeholder',
    EXPO_PUBLIC_SERVICE_API_URL: 'https://unverified-test-api.example.invalid',
    GOOGLE_MAPS_ANDROID_API_KEY: 'test-only-map-key-sentinel',
  });
  assert.notEqual(unknownTestApi.status, 0);
  assert.match(unknownTestApi.stderr, /verified TEST Render API origin/);
});

test('TEST Android EAS preview forwards the map key only to the native map plugin without printing it', () => {
  const script = [
    "const config=require('./app.config.js')({config:require('./app.json').expo});",
    "const maps=config.plugins.find(plugin=>Array.isArray(plugin)&&plugin[0]==='react-native-maps');",
    "if(!maps||maps[1]?.androidGoogleMapsApiKey!==process.env.GOOGLE_MAPS_ANDROID_API_KEY||config.extra.googleMapsAndroidConfigured!==true)process.exit(2);",
    "process.stdout.write('config-guard-passed');",
  ].join('');
  const configured = spawnSync(process.execPath, ['-e', script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      EXPO_PUBLIC_APP_ENV: 'test',
      EAS_BUILD_PLATFORM: 'android',
      EXPO_PUBLIC_SUPABASE_URL: TEST_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key-placeholder',
      EXPO_PUBLIC_SERVICE_API_URL: TEST_API_URL,
      GOOGLE_MAPS_ANDROID_API_KEY: 'test-only-map-key-sentinel',
    },
  });
  assert.equal(configured.status, 0, configured.stderr);
  assert.equal(configured.stdout, 'config-guard-passed');
  assert.equal(eas.build['test-android'].environment, 'preview');
  assert.equal(eas.build['test-android'].env.EXPO_PUBLIC_APP_ENV, 'test');

  const missing = spawnSync(process.execPath, ['-e', script], {
    cwd: root, encoding: 'utf8', env: {
      ...process.env, EXPO_PUBLIC_APP_ENV: 'test', EAS_BUILD_PLATFORM: 'android',
      EXPO_PUBLIC_SUPABASE_URL: TEST_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key-placeholder',
      EXPO_PUBLIC_SERVICE_API_URL: TEST_API_URL,
    },
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /requires GOOGLE_MAPS_ANDROID_API_KEY/);

  const ios = loadConfig({ EXPO_PUBLIC_APP_ENV: 'test', EAS_BUILD_PLATFORM: 'ios',
    EXPO_PUBLIC_SUPABASE_URL: TEST_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key-placeholder',
    EXPO_PUBLIC_SERVICE_API_URL: TEST_API_URL });
  assert.equal(ios.status, 0, ios.stderr);

  const preflightMissing = spawnSync(process.execPath, ['./scripts/require-android-maps-key.cjs'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, EXPO_PUBLIC_APP_ENV: 'test' },
  });
  assert.notEqual(preflightMissing.status, 0);
  const preflightConfigured = spawnSync(process.execPath, ['./scripts/require-android-maps-key.cjs'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, EXPO_PUBLIC_APP_ENV: 'test', GOOGLE_MAPS_ANDROID_API_KEY: 'sentinel' },
  });
  assert.equal(preflightConfigured.status, 0, preflightConfigured.stderr);
  assert.doesNotMatch(preflightConfigured.stdout, /sentinel/);

  const production = spawnSync(process.execPath, ['-e', script.replace(
    "if(!maps||maps[1]?.androidGoogleMapsApiKey!==process.env.GOOGLE_MAPS_ANDROID_API_KEY||config.extra.googleMapsAndroidConfigured!==true)process.exit(2);",
    "if((maps&&maps[1]?.androidGoogleMapsApiKey)||config.extra.googleMapsAndroidConfigured!==false)process.exit(2);",
  )], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      EXPO_PUBLIC_APP_ENV: 'production',
      GOOGLE_MAPS_ANDROID_API_KEY: 'must-not-enter-production-config',
    },
  });
  assert.equal(production.status, 0, production.stderr);
  assert.equal(production.stdout, 'config-guard-passed');
});

test('service-orders client allows the verified TEST host only in TEST runtime', () => {
  assert.match(serviceApi, /TEST_SERVICE_API_HOST = 'austa-v40-m7-test-api\.onrender\.com'/);
  assert.match(appConfig, /TEST_SERVICE_API_URL = 'https:\/\/austa-v40-m7-test-api\.onrender\.com'/);

  const output = ts.transpileModule(serviceApi, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, process: { env: {} }, URL });
  const resolveServiceApiBase = module.exports.resolveServiceApiBase;

  assert.equal(resolveServiceApiBase(TEST_API_URL, 'test'), TEST_API_URL);
  assert.equal(resolveServiceApiBase('https://a-usta-webside.onrender.com', 'production'), 'https://a-usta-webside.onrender.com');
  assert.throws(() => resolveServiceApiBase('https://a-usta-webside.onrender.com', 'test'), /təsdiqlənmiş A-USTA Render hostunda/);
  assert.throws(() => resolveServiceApiBase('https://a-usta-webside-test.onrender.com', 'test'), /təsdiqlənmiş A-USTA Render hostunda/);
  assert.throws(() => resolveServiceApiBase(TEST_API_URL, 'development'), /təsdiqlənmiş A-USTA Render hostunda/);
});
