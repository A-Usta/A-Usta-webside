const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const marketplace = read('src/lib/marketplace.ts');
const videoScreen = read('src/components/VideoFeedScreen.tsx');
const detail = read('src/components/MarketplaceScreens.tsx');
const migration = fs.readFileSync(path.resolve(root, '../supabase/migrations/20261125153000_v43_video_engagement.sql'), 'utf8');
const policies = fs.readFileSync(path.resolve(root, '../supabase/migrations/20261125160000_v43_video_engagement_rls_policies.sql'), 'utf8');

test('video engagement client uses the real secured RPC contracts and contains no fabricated counters', () => {
  for (const rpc of ['austa_get_video_engagement','austa_record_video_view','austa_toggle_video_like','austa_list_video_comments','austa_add_video_comment','austa_delete_video_comment']) assert.match(marketplace, new RegExp(`rpc\\('${rpc}'`));
  assert.match(marketplace, /export async function getVideoEngagement/);
  assert.match(marketplace, /export async function recordVideoView/);
  assert.match(marketplace, /export async function toggleVideoLike/);
  assert.match(videoScreen, /recordVideoView\(client,row,visitor\)/);
  assert.match(videoScreen, /engagement\?\.view_count\?\?'—'/);
  assert.doesNotMatch(videoScreen, /Video bəyənmə xidməti hazırda backend-də yoxdur/);
  assert.doesNotMatch(videoScreen, /Video şərhləri üçün mobil backend xidməti mövcud deyil/);
});

test('video engagement database functions validate active video listings and keep raw rows private', () => {
  assert.match(migration, /v43_has_public_video/);
  assert.match(migration, /v36_listing_exists\(p_source,p_listing_id,true\)/);
  assert.match(migration, /m\.media_type='video'/);
  assert.match(migration, /REVOKE ALL ON austa_private\.listing_video_views,austa_private\.listing_video_likes,austa_private\.listing_video_comments FROM PUBLIC,anon,authenticated/);
  assert.match(migration, /IF actor IS NULL THEN RAISE EXCEPTION 'Bəyənmək üçün hesabınıza daxil olun'/);
  assert.match(migration, /IF actor IS NULL THEN RAISE EXCEPTION 'Şərh yazmaq üçün hesabınıza daxil olun'/);
  assert.match(migration, /WHERE id=p_comment_id AND user_id=actor/);
  assert.match(policies, /FOR INSERT TO authenticated WITH CHECK \(user_id=\(SELECT auth\.uid\(\)\)\)/);
  assert.match(policies, /FOR DELETE TO authenticated USING \(user_id=\(SELECT auth\.uid\(\)\)\)/);
});

test('video screen exposes native play/pause, real seek progress, sound, sharing, likes and comments', () => {
  assert.match(videoScreen, /p\.timeUpdateEventInterval=\.25/);
  assert.match(videoScreen, /player\.addListener\('timeUpdate'/);
  assert.match(videoScreen, /player\.addListener\('playingChange'/);
  assert.match(videoScreen, /player\.currentTime=seconds/);
  assert.match(videoScreen, /Videonu dayandır/);
  assert.match(videoScreen, /Səsi aç/);
  assert.match(videoScreen, /Share\.share/);
  assert.match(videoScreen, /onLike=\{\(\)=>void like\(item\)\}/);
  assert.match(videoScreen, /onComments=\{\(\)=>void showComments\(item\)\}/);
  assert.match(videoScreen, /austa:video:visitor:v1/);
  assert.match(videoScreen, /const newVisitorId=\(\)=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'/);
  assert.match(migration, /p_visitor_id uuid DEFAULT NULL/);
  assert.match(videoScreen, /accessibilityLabel="Şərh yaz"/);
});

test('listing marketplace cards use four-to-three imagery and detail exposes freeform seller questions', () => {
  assert.match(detail, /media:\{aspectRatio:4\/3/);
  assert.match(detail, /item\.engine_volume!=null\?`\$\{item\.engine_volume\} L`/);
  assert.match(detail, /item\.horsepower!=null\?`\$\{item\.horsepower\} a\.g\.`/);
  assert.doesNotMatch(detail, /item\.engine\|\|item\.engine_volume/);
  assert.match(detail, /accessibilityLabel="Satıcıya mesaj yaz"/);
  assert.match(detail, /accessibilityLabel="Satıcıya mesaj göndər"/);
  assert.match(detail, /sendSellerQuestion\(message\.trim\(\)\)/);
  assert.match(detail, /p_client_message_id:requestId/);
  assert.match(detail, /const sellerQuestions=item\._category/);
});

test('promotions rank only after start and before expiry in all marketplace queries', () => {
  assert.match(marketplace, /Date\.parse\(String\(row\.promotion_started_at/);
  assert.match(marketplace, /starts>current \|\| ends<=current/);
  assert.match(marketplace, /rpc\('austa_public_listing_page'/);
  const feed=fs.readFileSync(path.resolve(root,'../supabase/migrations/20261128140000_v4322_public_feed_cursor.sql'),'utf8');
  assert.match(feed, /promotion_started_at<=statement_timestamp\(\)/);
  assert.match(feed, /promotion_until>statement_timestamp\(\)/);
});
