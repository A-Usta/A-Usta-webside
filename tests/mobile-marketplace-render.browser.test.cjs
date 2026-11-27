const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mobile = path.join(root, 'mobile');
const requireMobile = name => require(require.resolve(name, { paths: [mobile] }));
const ts = requireMobile('typescript');
const React = requireMobile('react');
const ReactDOMServer = requireMobile('react-dom/server');
const RNW = requireMobile('react-native-web');

function transpileModule(file, customRequire) {
  const source = fs.readFileSync(file, 'utf8');
  const js = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true });
  const module = { exports: {} };
  vm.runInNewContext(`(function(exports,module,require){${js}\n})(module.exports,module,require)`, {
    module, exports: module.exports, require: customRequire, React, console, Intl, Date, Math, Number, String, Boolean, Object, Array, Set, Map, Promise, JSON, RegExp, Error, TypeError,
  }, { filename: file });
  return module.exports;
}

let routeKey = 'cars';
let homeFocused = true;
let viewportWidth = 390;
const currency = { getCurrencySnapshot: () => ({ currency: 'AZN', rates: null }) };
const actualMarketplace = transpileModule(path.join(mobile, 'src/lib/marketplace.ts'), name => name === './currency' ? currency : requireMobile(name));
const categories = actualMarketplace.CATEGORIES;
const categoryIndex = new Map(categories.map(category => [category.key, category]));

const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.map(flatten).filter(Boolean)) : style || {};
const View = props => {
  const style = flatten(props.style);
  const isFilterPanel = style.margin === 14 && style.padding === 13 && style.borderRadius === 13 && style.gap === 8;
  const view = React.createElement(RNW.View, props);
  return isFilterPanel ? React.createElement('div', { 'data-filter-panel': 'true' }, view) : view;
};
const themedNative = {
  ActivityIndicator: RNW.ActivityIndicator, Image: RNW.Image, KeyboardAvoidingView: View, Modal: RNW.Modal,
  Pressable: RNW.Pressable, RefreshControl: () => null, ScrollView: View, Text: RNW.Text,
  TextInput: RNW.TextInput, View, Feather: () => null, MaterialCommunityIcons: () => null,
};

const dependencies = {
  react: React,
  'react/jsx-runtime': requireMobile('react/jsx-runtime'),
  'react-native': { Alert: { alert() {} }, Linking: {}, Platform: { OS: 'web' }, Share: {}, StyleSheet: { ...RNW.StyleSheet, create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width: viewportWidth, height: 844 }) },
  '../lib/themed-native': themedNative,
  'expo-router': { useIsFocused: () => homeFocused, useLocalSearchParams: () => ({ key: routeKey, title: categoryIndex.get(routeKey)?.title }), useRouter: () => ({ push() {}, back() {} }) },
  'expo-image': { Image: RNW.Image },
  'expo-image-picker': {},
  '@react-native-async-storage/async-storage': { default: {} },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) },
  '../data/vehicle-catalog.json': JSON.parse(fs.readFileSync(path.join(mobile, 'src/data/vehicle-catalog.json'), 'utf8')),
  '../lib/supabase': { getSupabaseClient: () => null },
  '../lib/listing-media-upload': {}, '../lib/listing-video-poster': {}, '../lib/listing-equipment': {}, '../lib/listing-form-options': {},
  '../lib/user-error': { userErrorMessage: () => 'error' }, '../lib/listing-publish-error': {}, '../lib/listing-request': {},
  '../lib/marketplace': { ...actualMarketplace }, '../lib/currency': { formatListingPrice: () => '—' },
  '../lib/app-settings': { useAppSettings: () => ({ currency: 'AZN', exchangeRates: null }) },
  '../lib/marketTools': {}, '../lib/listing-card-layout': { listingCardWidth: value => value - 24 },
  './MarketTools': { HomeDirectoryCards: () => null, HomeQuickTools: () => null, HomeServiceCards: () => null },
};
const screenModule = transpileModule(path.join(mobile, 'src/components/MarketplaceScreens.tsx'), name => {
  if (Object.prototype.hasOwnProperty.call(dependencies, name)) return dependencies[name];
  return requireMobile(name);
});
const categoryRoute = transpileModule(path.join(mobile, 'src/app/category/[key].tsx'), name => {
  if (name === 'expo-router') return dependencies['expo-router'];
  if (name === '../../components/MarketplaceScreens') return screenModule;
  return requireMobile(name);
});

function renderCategoryScreens() {
  assert.equal(categories.length, 17, 'the live mobile category catalog is the audited source');
  return categories.map(category => {
    routeKey = category.key;
    const html = ReactDOMServer.renderToString(React.createElement(categoryRoute.default));
    return { category, html };
  });
}

test('runtime category component trees render one filter panel and trigger for each of 17 categories', () => {
  for (const { category, html } of renderCategoryScreens()) {
    assert.equal((html.match(/data-filter-panel="true"/g) || []).length, 1, `${category.key} runtime tree has one filter panel`);
    assert.equal((html.match(/Filtr/g) || []).length, 1, `${category.key} runtime tree has one filter trigger`);
  }
});

test('inactive marketplace home hides its filter when a category route is on top of the stack', () => {
  homeFocused = true;
  const home = ReactDOMServer.renderToString(React.createElement(screenModule.MarketplaceHomeScreen));
  assert.equal((home.match(/data-filter-panel="true"/g) || []).length, 1, 'focused home retains its single filter panel');
  homeFocused = false;
  const inactiveHome = ReactDOMServer.renderToString(React.createElement(screenModule.MarketplaceHomeScreen));
  routeKey = 'parts';
  const category = ReactDOMServer.renderToString(React.createElement(categoryRoute.default));
  assert.equal((inactiveHome + category).match(/data-filter-panel="true"/g)?.length || 0, 1, 'stacked home and active category show exactly one filter panel');
  homeFocused = true;
});

test('rendered category screens fit 320, 360, 390 and 412 dp without horizontal overflow', async t => {
  if (!process.env.CI && !fs.existsSync(chromium.executablePath())) return t.skip('Chromium is installed by the frontend CI job; this environment blocks the Playwright browser download.');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const width of [320, 360, 390, 412]) {
      viewportWidth = width;
      for (const { category, html } of renderCategoryScreens()) {
        await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"/><style>html,body{margin:0;width:100%;min-height:100%;}*{box-sizing:border-box}</style>${html}`);
        await page.setViewportSize({ width, height: 844 });
        const state = await page.evaluate(() => ({
          panels: document.querySelectorAll('[data-filter-panel="true"]').length,
          triggers: [...document.querySelectorAll('[role="button"]')].filter(node => /Filtr/.test(node.textContent || '')).length,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        assert.equal(state.panels, 1, `${category.key} must mount one filter panel at ${width}dp`);
        assert.equal(state.triggers, 1, `${category.key} must expose one working filter trigger at ${width}dp`);
        assert.ok(state.documentWidth <= state.viewportWidth, `${category.key} overflows horizontally at ${width}dp`);
      }
    }
  } finally {
    await browser.close();
  }
});
