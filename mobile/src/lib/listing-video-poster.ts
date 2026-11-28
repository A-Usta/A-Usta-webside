import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, Listing, Media } from './marketplace';

const MAX_POSTER_BYTES = 2 * 1024 * 1024;
const jpeg = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

/** Generate a real frame, reduce it to a compact 360px JPEG, store it, then link it to the owned video row. */
export async function storeVideoPoster(
  client: SupabaseClient,
  category: Category,
  ownerId: string,
  listingId: string,
  mediaId: string,
  videoUri: string,
  onUploaded?: (path: string) => void,
): Promise<string> {
  const posterPath = `${ownerId}/${listingId}/${mediaId}-poster.jpg`;
  let thumbnailUri = '';
  let optimizedUri = '';
  let uploaded = false;
  try {
    const frame = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 700, quality: 0.6 });
    thumbnailUri = frame.uri;
    const optimized = await ImageManipulator.manipulateAsync(
      frame.uri,
      [{ resize: { width: 360 } }],
      { compress: 0.68, format: ImageManipulator.SaveFormat.JPEG },
    );
    optimizedUri = optimized.uri;
    const file = new File(optimized.uri);
    if (!file.exists || !file.size || file.size > MAX_POSTER_BYTES) throw new Error('Video posteri 2 MiB həddinə sığmadı.');
    const bytes = await file.bytes();
    if (bytes.length > MAX_POSTER_BYTES || !jpeg(bytes)) throw new Error('Video posterinin JPEG formatı təsdiqlənmədi.');
    const object = await client.storage.from(category.bucket).upload(posterPath, bytes, {
      contentType: 'image/jpeg', upsert: true, cacheControl: '31536000',
    });
    if (object.error || object.data?.path !== posterPath) throw object.error || new Error('Poster Storage-da təsdiqlənmədi.');
    uploaded = true;
    onUploaded?.(posterPath);
    const linked = await client.from(category.mediaTable)
      .update({ poster_path: posterPath })
      .eq('id', mediaId).eq('listing_id', listingId).eq('owner_id', ownerId).eq('media_type', 'video')
      .is('poster_path', null).select('id').maybeSingle();
    if (linked.error) throw linked.error;
    if (!linked.data) {
      const current = await client.from(category.mediaTable).select('poster_path').eq('id', mediaId).eq('listing_id', listingId).eq('owner_id', ownerId).maybeSingle();
      if (current.error || current.data?.poster_path !== posterPath) throw current.error || new Error('Video posteri elana bağlanmadı.');
    }
    return posterPath;
  } catch (error) {
    if (uploaded) {
      const relation = await client.from(category.mediaTable).select('id').eq('id', mediaId).eq('owner_id', ownerId).eq('poster_path', posterPath).maybeSingle();
      if (!relation.error && !relation.data) await client.storage.from(category.bucket).remove([posterPath]);
    }
    throw error;
  } finally {
    for (const uri of new Set([thumbnailUri, optimizedUri].filter(Boolean))) {
      try { const file = new File(uri); if (file.exists) await file.delete(); } catch { /* Best-effort removal of the small temporary poster. */ }
    }
  }
}

/** Repair at most two old posters when their owner opens a listing; a failure never blocks viewing. */
export async function backfillOwnedVideoPosters(client: SupabaseClient, category: Category, listing: Listing): Promise<Listing> {
  const auth = await client.auth.getUser();
  if (auth.error) throw auth.error;
  const ownerId = auth.data.user?.id;
  if (!ownerId || ownerId !== listing.owner_id) return listing;
  let repaired = 0;
  for (const media of (listing._media || []).filter((row: Media) => row.media_type === 'video' && !row.poster_path && row.url).slice(0, 2)) {
    try {
      await storeVideoPoster(client, category, ownerId, listing.id, media.id, media.url!);
      repaired++;
    } catch { /* Incremental repair is best effort and does not interrupt playback. */ }
  }
  if (!repaired) return listing;
  const { attachMedia } = await import('./marketplace');
  return attachMedia(client, category, listing);
}
