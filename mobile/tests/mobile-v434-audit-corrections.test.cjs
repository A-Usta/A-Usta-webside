const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/components/MarketplaceScreens.tsx'), 'utf8');

test('V4.3.4 unifies promotion icons, salon badges and compact service plans', () => {
  assert.match(source, /function PromotionIcon/);
  assert.match(source, /PromotionIcon type="premium"/);
  assert.match(source, /Premium tacı/);
  assert.match(source, /\}>Avtosalon<\/Text>/);
  assert.match(source, /flexDirection:'row',gap:7,marginTop:12/);
  assert.doesNotMatch(source, /name="award"/);
});

test('V4.3.4 keeps promotion ranks visible and shows Premium empty state', () => {
  assert.match(source, /title="Premium"/);
  assert.match(source, /Hazırda aktiv Premium elan yoxdur/);
  assert.match(source, /promotionRank\(item\)<2/);
  assert.match(source, /sortListings\(rows\.filter\(item=>promotionRank\(item\)<2\)\)/);
});

test('V4.3.4 sends seller questions through the message RPC for every category', () => {
  assert.match(source, /<Text style=\{styles\.heading\}>Satıcıdan soruşun/);
  assert.doesNotMatch(source, /item\._source==='vehicle'&&<View style=\{styles\.detailPad\}><Text style=\{styles\.heading\}>Satıcıdan soruşun/);
  assert.match(source, /austa_send_listing_message/);
  assert.match(source, /questionRequest\.current\?\.body===questionBody/);
  assert.match(source, /p_client_message_id:requestId/);
  assert.match(source, /questionSending\.current/);
  assert.match(source, /const sellerQuestions=item\._category/);
});

test('V4.3.4 ranks similar listings with category fields and excludes the current listing', () => {
  assert.match(source, /function similarityScore/);
  for (const field of ['brand', 'model', 'body_type', 'year']) assert.match(source, new RegExp(`\\['${field}'`));
  assert.match(source, /row\.id!==found\.id/);
  assert.match(source, /CATEGORY_FILTERS\[category\.key\]/);
});

test('V4.3.4 uses live video engagement counts and keeps 9:16 home cards', () => {
  assert.match(source, /getVideoEngagement/);
  assert.match(source, /videoEngagement\?\.view_count/);
  assert.match(source, /aspectRatio:9\/16/);
  assert.match(source, /Hamısı/);
});
