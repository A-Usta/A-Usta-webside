import { File } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', gif: 'image/gif',
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime',
  webm: 'video/webm', '3gp': 'video/3gpp',
};

export type ListingMediaType = 'image' | 'video';
export type ListingMediaDescriptor = { mediaType: ListingMediaType; mimeType: string; extension: string; size: number | null };

function extensionOf(asset: Pick<ImagePickerAsset, 'fileName' | 'uri'>): string {
  const filename = asset.fileName || asset.uri.split(/[?#]/, 1)[0];
  return filename.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
}

/** Android camera and document-picker assets can omit MIME or fileSize; infer safely from URI/metadata. */
export function describeListingMedia(asset: Pick<ImagePickerAsset, 'fileName' | 'uri' | 'type' | 'mimeType' | 'fileSize'>, categoryKey: string): ListingMediaDescriptor {
  const extension = extensionOf(asset);
  const inferredMime = MIME_BY_EXTENSION[extension];
  const mimeType = (asset.mimeType || inferredMime || '').toLowerCase();
  const mediaType: ListingMediaType = asset.type === 'video' || mimeType.startsWith('video/') ? 'video' : 'image';
  const size = typeof asset.fileSize === 'number' && Number.isFinite(asset.fileSize) ? asset.fileSize : null;
  if (!mimeType.startsWith(`${mediaType}/`) || !/^[a-z0-9][a-z0-9.+-]*$/.test(mimeType.slice(mediaType.length + 1))) {
    throw new Error('Faylın formatını müəyyən etmək mümkün olmadı. Şəkil və ya videonu yenidən seçin.');
  }
  if (inferredMime && asset.mimeType && inferredMime !== mimeType) {
    throw new Error('Faylın adı ilə formatı uyğun gəlmir. Başqa media seçin.');
  }
  if (mediaType === 'video' && categoryKey === 'plate') throw new Error('Dövlət nişanları kateqoriyasında video qəbul edilmir.');
  if (size !== null && (size <= 0 || size > MAX_MEDIA_BYTES)) {
    throw new Error('Media boş olmamalı və 50 MiB-dan böyük ola bilməz.');
  }
  return { mediaType, mimeType, extension: extension || mimeType.split('/')[1]?.replace(/[^a-z0-9]/g, '') || (mediaType === 'video' ? 'mp4' : 'jpg'), size };
}

/** Upload byte data directly. React Native fetch(URI).blob() is unreliable for Android content:// camera assets. */
export async function uploadListingMedia(
  client: SupabaseClient,
  bucket: string,
  path: string,
  asset: ImagePickerAsset,
  categoryKey: string,
  onProgress?: (message: string) => void,
  readBytes: (uri: string) => Promise<Uint8Array> = async (uri) => new File(uri).bytes(),
) {
  const localFile = new File(asset.uri);
  const descriptor = describeListingMedia({ ...asset, fileSize: asset.fileSize ?? localFile.size ?? undefined }, categoryKey);
  onProgress?.('Media faylı hazırlanır…');
  const bytes = await readBytes(asset.uri);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES || (descriptor.size !== null && bytes.byteLength !== descriptor.size)) {
    throw new Error('Media faylı tam oxunmadı. Faylı yenidən seçib cəhd edin.');
  }
  onProgress?.('Media serverə yüklənir…');
  const { data, error } = await client.storage.from(bucket).upload(path, bytes, { contentType: descriptor.mimeType, upsert: false });
  if (error) throw error;
  if (!data?.path) throw new Error('Media serverdə saxlandığı təsdiqlənmədi. Təkrar cəhd edin.');
  return descriptor;
}
