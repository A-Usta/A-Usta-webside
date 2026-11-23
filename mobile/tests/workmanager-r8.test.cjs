'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { KEEP_RULES, mergeProguardRules } = require('../plugins/workmanager-proguard-rules');

const appConfig = fs.readFileSync(path.join(__dirname, '..', 'app.config.js'), 'utf8');
const plugin = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'with-workmanager-r8.js'), 'utf8');

test('R8 preserves constructors instantiated reflectively by Room and WorkManager', () => {
  assert.deepEqual(KEEP_RULES, [
    '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
    '-keep class * extends androidx.work.InputMerger { <init>(); }',
  ]);
});

test('existing ProGuard rules are preserved and constructor rules are appended idempotently', () => {
  const initial = '# existing A-USTA rule\n-keep class az.austa.** { *; }';
  const updated = mergeProguardRules(initial);
  assert.ok(updated.startsWith(initial));
  for (const rule of KEEP_RULES) assert.equal(updated.split(rule).length - 1, 1);
  assert.equal(mergeProguardRules(updated), updated);
  assert.equal(mergeProguardRules(`${KEEP_RULES.join('\n')}\n`), `${KEEP_RULES.join('\n')}\n`);
});

test('Expo config registers an Android CNG plugin that only merges the R8 rules', () => {
  assert.match(appConfig, /\.\/plugins\/with-workmanager-r8/);
  assert.match(plugin, /withDangerousMod\(config,\s*\[/);
  assert.match(plugin, /app['"]?,\s*'proguard-rules\.pro'/);
  assert.match(plugin, /mergeProguardRules\(existing\)/);
  assert.doesNotMatch(plugin, /androidx\.startup\.InitializationProvider|WorkManagerInitializer/);
});
