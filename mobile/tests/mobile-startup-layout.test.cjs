const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('cold-start routes do not eagerly import the map and account native screens', () => {
  const startupFiles = [
    'src/app/_layout.tsx',
    'src/app/(drawer)/_layout.tsx',
    'src/app/(drawer)/(tabs)/_layout.tsx',
    'src/app/(drawer)/(tabs)/index.tsx',
  ];
  for (const file of startupFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /from ['"][^'"]*\/App['"]/);
    assert.doesNotMatch(source, /react-native-maps|ServiceScreens|AccountScreens/);
  }
  assert.match(read('src/app/(drawer)/_layout.tsx'), /components\/ServiceDrawer/);
  assert.match(read('src/app/(drawer)/(tabs)/index.tsx'), /components\/MarketplaceScreens/);
  assert.match(read('src/app/service/[key].tsx'), /components\/ServiceScreens/);
  assert.match(read('src/app/(drawer)/(tabs)/account.tsx'), /components\/AccountScreens/);
  assert.doesNotMatch(read('src/components/ServiceScreens.tsx'), /^import(?!\s+type)\s+.*react-native-maps/m);
  assert.match(read('src/components/ServiceScreens.tsx'), /require\('react-native-maps'\)/);
  assert.doesNotMatch(read('src/components/MarketplaceScreens.tsx'), /^import\s+.*expo-video/m);
  assert.match(read('src/components/MarketplaceScreens.tsx'), /require\('expo-video'\)/);
});

test('root route has a user-facing JS error recovery boundary without logging exception details', () => {
  const layout = read('src/app/_layout.tsx');
  assert.match(layout, /export function ErrorBoundary/);
  assert.match(layout, /A-USTA açıla bilmədi/);
  assert.match(layout, /onPress=\{retry\}/);
  assert.doesNotMatch(layout, /console\.(log|error)|error\.message/);
});

test('adaptive and launch wordmarks use the existing brand assets with a configured safe background', () => {
  const app = JSON.parse(read('app.json')).expo;
  assert.equal(app.android.adaptiveIcon.foregroundImage, './assets/android-icon-foreground.png');
  assert.equal(app.android.adaptiveIcon.backgroundColor, '#176244');
  assert.equal(app.icon, './assets/icon.png');
  assert.equal(app.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1].image, './assets/splash-icon.png');
  for (const relative of ['assets/android-icon-foreground.png', 'assets/android-icon-monochrome.png', 'assets/icon.png', 'assets/splash-icon.png']) {
    assert.ok(fs.statSync(path.join(root, relative)).size > 1000, `${relative} must be a real packaged image`);
  }
});

test('marketplace titles, prices, metadata and category labels are allowed to wrap instead of ellipsize', () => {
  const screens = read('src/components/MarketplaceScreens.tsx');
  assert.match(screens, /<Text style=\{styles\.price\}>/);
  assert.match(screens, /<Text style=\{styles\.title\}>/);
  assert.match(screens, /<Text style=\{styles\.meta\}>/);
  assert.doesNotMatch(screens, /numberOfLines=\{1\}/);
  assert.doesNotMatch(screens, /numberOfLines=\{2\}/);
  assert.match(screens, /flexBasis:'48%'/);
});
