const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourceRoot = path.resolve(__dirname, '../src');
const supportedRoles = new Set([
  'none', 'button', 'link', 'search', 'image', 'keyboardkey', 'text', 'adjustable',
  'imagebutton', 'header', 'summary', 'alert', 'checkbox', 'combobox', 'menu',
  'menubar', 'menuitem', 'progressbar', 'radio', 'radiogroup', 'scrollbar',
  'spinbutton', 'switch', 'tab', 'tablist', 'timer', 'toolbar',
]);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(item) : /\.tsx?$/.test(entry.name) ? [item] : [];
  });
}

function hasTypeAssertion(node) {
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) return true;
  return node.forEachChild(child => hasTypeAssertion(child)) || false;
}

test('all mobile accessibilityRole values are native-supported and cannot bypass prop typing with casts', () => {
  for (const file of sourceFiles(sourceRoot)) {
    const source = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'accessibilityRole' && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          assert.ok(supportedRoles.has(node.initializer.text), `${path.relative(sourceRoot, file)} uses unsupported role ${node.initializer.text}`);
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          const expression = node.initializer.expression;
          assert.equal(hasTypeAssertion(expression), false, `${path.relative(sourceRoot, file)} casts accessibilityRole and can bypass React Native's role type`);
          assert.doesNotMatch(expression.getText(ast), /(?:^|[^\w$])status(?:$|[^\w$])/, `${path.relative(sourceRoot, file)} dynamically passes the unsupported status role`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});

test('settings announcements use a polite live region; themed Text preserves native Text prop types', () => {
  const settings = fs.readFileSync(path.join(sourceRoot, 'components/SettingsScreen.tsx'), 'utf8');
  assert.match(settings, /<Text accessibilityLiveRegion="polite" style=\{s\.notice\}>/);
  assert.doesNotMatch(settings, /accessibilityRole\s*=\s*["']status["']/);

  const themed = fs.readFileSync(path.join(sourceRoot, 'lib/themed-native.tsx'), 'utf8');
  assert.match(themed, /export function Text\(props: ComponentProps<typeof NativeText>\)/);
  assert.match(themed, /<NativeText \{\.\.\.props\} style=\{themedStyle\(props\.style, colorScheme, 'text'\)\} \/>/);
});
