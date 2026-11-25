const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const screen = read('src/components/MarketplaceScreens.tsx');
const marketplace = read('src/lib/marketplace.ts');
const poster = read('src/lib/listing-video-poster.ts');
const account = read('src/components/AccountScreens.tsx');
const avatarMigration = fs.readFileSync(path.resolve(root, '../supabase/migrations/20261125193000_v436_seller_public_avatar.sql'), 'utf8');
const posterMigration = fs.readFileSync(path.resolve(root, '../supabase/migrations/20261125190000_v436_video_posters.sql'), 'utf8');

test('video upload persists compact real-frame posters and keeps video publish best-effort', () => {
  assert.match(poster, /VideoThumbnails\.getThumbnailAsync\(videoUri/);
  assert.match(poster, /resize:\s*\{\s*width:\s*360\s*\}/);
  assert.match(poster, /client\.storage\.from\(category\.bucket\)\.upload/);
  assert.match(poster, /poster_path:\s*posterPath/);
  assert.match(screen, /storeVideoPoster\(sb,category,user\.id,id,row\.data\.id,file\.uri/);
  assert.match(screen, /Poster is best effort/);
  assert.match(marketplace, /select\('id,listing_id,storage_path,poster_path,media_type/);
  assert.match(marketplace, /createSignedUrl\(item\.poster_path,3600\)/);
  assert.match(screen, /VideoPoster url=\{video\.poster_url\}/);
  assert.match(screen, /backfillOwnedVideoPosters\(sb,category,found\)/);
  assert.match(poster, /\.slice\(0, 2\)/);
  assert.match(marketplace, /select\('id,storage_path,poster_path'\)/);
  assert.match(posterMigration, /poster_path text/);
  assert.match(posterMigration, /relrowsecurity/);
  assert.match(posterMigration, /m\.media_type='video' AND m\.poster_path=p_name/);
  assert.doesNotMatch(screen, /onFirstFrameRender=\{capturePoster\}/);
});

test('opt-in seller avatar uses a separate owner-RLS mapping and approved public visibility only', () => {
  assert.match(avatarMigration, /CREATE TABLE public\.seller_profile_public_avatars/);
  assert.match(avatarMigration, /ENABLE ROW LEVEL SECURITY[\s\S]*FORCE ROW LEVEL SECURITY/);
  assert.match(avatarMigration, /public_consent boolean NOT NULL DEFAULT false/);
  assert.match(avatarMigration, /sp\.status='active' AND sp\.verification_status='verified'/);
  assert.match(avatarMigration, /CREATE POLICY seller_avatar_public_read/);
  assert.match(avatarMigration, /CREATE POLICY seller_avatar_owner_insert/);
  assert.match(avatarMigration, /CREATE POLICY seller_avatar_owner_delete/);
  assert.doesNotMatch(avatarMigration, /ALTER TABLE public\.profiles|CREATE POLICY[^;]* ON public\.profiles/i);
  assert.match(account, /Avatar seç və ictimai paylaşmağa razı ol/);
  assert.match(account, /İctimai avatar razılığını ləğv et/);
  assert.match(account, /public_consent:true/);
  assert.match(account, /public_consent:false/);
  assert.match(screen, /austa_get_public_seller_avatar/);
});

test('all 17 category forms expose the newly reconciled public address and provider fields', () => {
  for (const field of ['address','message_contact','experience','working_hours']) assert.match(screen, new RegExp(`\\['${field}',`));
  for (const field of ['price_policy','service_area','brands']) assert.match(screen, new RegExp(`\\['${field}',`));
  for (const field of ['address','price_policy','part_name','original_paint']) assert.match(screen + read('src/lib/listing-form-options.ts'), new RegExp(field));
  assert.match(screen, /vehicle:\[[^\]]*'address'/s);
  assert.match(screen, /service_provider:\[[^\]]*'address'/s);
  assert.match(screen, /auto_dealer:\[[^\]]*'address'/s);
  assert.match(screen, /Object\.entries\(item\.details\|\|\{\}\)/);
  assert.match(screen, /data\.damage_condition&&typeof data\.damage_condition==='object'/);
  const labelsBlock=screen.slice(screen.indexOf('const DETAIL_LABELS'),screen.indexOf('function displayDetailValue'));
  const knownLabels=new Set([...labelsBlock.matchAll(/(?:^|[,{])([a-z][a-z0-9_]*):'/g)].map(match=>match[1]));
  const formBlock=screen.slice(screen.indexOf('const commonFields'),screen.indexOf('if(!userId)'));
  const formFields=new Set([...formBlock.matchAll(/\['([a-z][a-z0-9_]*)','/g)].map(match=>match[1]));
  assert.deepEqual([...formFields].filter(field=>!knownLabels.has(field)),[],'every field label is represented in the Azerbaijani detail label catalog');
});
