const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/listing-card-layout.ts'), 'utf8');
const body = source.match(/export function listingCardWidth[\s\S]*?\n}/)?.[0];
assert.ok(body, 'listingCardWidth must be exported');
const listingCardWidth = new Function('viewportWidth', 'horizontalPadding = 12', 'columnGap = 10', `${body.replace('export function listingCardWidth(viewportWidth: number, horizontalPadding = 12, columnGap = 10): number {', '').replace(/\n}$/, '')}`);

test('listing cards fit two equal columns on supported phone widths', () => {
  for (const width of [320, 360, 390, 412]) {
    const card = listingCardWidth(width);
    assert.equal(card, Math.floor((width - 24 - 10) / 2));
    assert.equal(card * 2 + 10 + 24 <= width, true);
  }
});

test('listing card keeps 4:3 media and Turbo.az content order', () => {
  const screen = fs.readFileSync(path.join(__dirname, '../src/components/MarketplaceScreens.tsx'), 'utf8');
  assert.match(screen, /media:\{aspectRatio:4\/3/);
  assert.match(screen, /<View style=\{styles\.priceRow\}>[\s\S]*?<Text style=\{styles\.price\}/);
  assert.match(screen, /<Text style=\{styles\.title\}/);
  assert.match(screen, /videoCover:\{width:'100%',aspectRatio:9\/16/);
  assert.match(screen, /\['boost','vip','premium'\] as PromotionType\[\]/);
});
