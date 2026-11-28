const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../src');
const marketplace = fs.readFileSync(path.join(root, 'lib/marketplace.ts'), 'utf8');
const screens = fs.readFileSync(path.join(root, 'components/MarketplaceScreens.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/seller/[id].tsx'), 'utf8');

test('public seller profile reads only the approved DTO and verified active profiles', () => {
  const screen = screens.slice(screens.indexOf('export function MarketplaceSellerProfileScreen'), screens.indexOf('export function MarketplaceMessagesScreen'));
  assert.match(screen, /select\('id,business_type,display_name,status,verification_status,official_status'\)/);
  assert.match(screen, /\.eq\('status','active'\)\.eq\('verification_status','verified'\)/);
  assert.doesNotMatch(screen, /from\('profiles'\)|email|tax_id|documents/);
  assert.match(screen, /name="user"/);
  assert.match(marketplace, /listSellerProfileListings[\s\S]*?from\('austa_public_listing_feed'\)[\s\S]*?\.eq\('category',category\.key\)[\s\S]*?payload->>seller_profile_id/);
  assert.match(marketplace, /sort_bucket[\s\S]*?sort_at[\s\S]*?sortListings/);
  assert.match(route, /MarketplaceSellerProfileScreen/);
});
