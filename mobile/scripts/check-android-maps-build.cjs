const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
if (!key || !key.trim()) throw new Error('Google Maps Android TEST key is not configured.');
const expo = require('../app.json').expo;
const config = require('../app.config.js')({ config: expo });
const maps = config.plugins.find(item => Array.isArray(item) && item[0] === 'react-native-maps');
if (!maps || maps[1]?.androidGoogleMapsApiKey !== key || config.extra?.googleMapsAndroidConfigured !== true) {
  throw new Error('Android Maps plugin key and Expo runtime configured flag do not match.');
}

const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(manifestPath)) throw new Error('Native AndroidManifest.xml is missing; run Expo prebuild first.');
const manifest = fs.readFileSync(manifestPath, 'utf8');
const mapsMeta = manifest.match(/<meta-data\b(?=[^>]*android:name="com\.google\.android\.geo\.API_KEY")[^>]*\/?>(?:\s*<\/meta-data>)?/s)?.[0];
if (!mapsMeta || !new RegExp(`android:value="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(mapsMeta)) {
  throw new Error('Native Manifest Maps key does not match the configured TEST key.');
}

if (process.argv[2] === '--post') {
  const apkPath = path.resolve(process.argv[3] || path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'));
  if (!fs.existsSync(apkPath) || fs.statSync(apkPath).size < 1024) throw new Error('Release APK was not produced or is unexpectedly small.');
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk) throw new Error('Set ANDROID_HOME to inspect the packaged APK manifest.');
  const analyzer = path.join(sdk, 'cmdline-tools', 'latest', 'bin', process.platform === 'win32' ? 'apkanalyzer.bat' : 'apkanalyzer');
  const result = spawnSync(analyzer, ['manifest', 'print', apkPath], { encoding: 'utf8', windowsHide: true, shell: process.platform === 'win32' });
  if (result.error || result.status !== 0 || !result.stdout?.includes('com.google.android.geo.API_KEY') || !result.stdout.includes(key)) {
    throw new Error('Packaged APK Maps metadata does not match the configured Android key.');
  }
}
console.log(process.argv[2] === '--post' ? 'Android Maps config, source Manifest and packaged APK metadata verified.' : 'Android Maps config/Manifest verified.');
