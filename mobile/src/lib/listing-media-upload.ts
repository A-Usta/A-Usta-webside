import { File, Paths } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withListingTimeout } from './listing-request';

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', gif: 'image/gif',
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime',
  webm: 'video/webm', '3gp': 'video/3gpp',
};

export type ListingMediaType = 'image' | 'video';
export type ListingMediaDescriptor = { mediaType: ListingMediaType; mimeType: string; extension: string; size: number | null };
type ReadMediaResult = { bytes: Uint8Array; fileSize: number | null };

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
  return { mediaType, mimeType, extension: extension || mimeType.split('/')[1]?.replace(/[^a-z0-9]/g, '') || (mediaType === 'video' ? 'mp4' : 'jpg'), size };
}

/** Copy picker URIs (including Android SAF content://) into app cache before reading. */
async function readFromCache(uri: string, extension: string): Promise<ReadMediaResult> {
  const name = `austa-listing-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const cached = new File(Paths.cache, name);
  try {
    await new File(uri).copy(cached);
    if (!cached.exists) throw new Error('cache copy missing');
    const fileSize = cached.size;
    if (fileSize === 0 || (fileSize !== null && fileSize > MAX_MEDIA_BYTES)) {
      throw new Error('Media boş olmamalı və 50 MiB-dan böyük ola bilməz.');
    }
    const bytes = await cached.bytes();
    return { bytes, fileSize };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Media boş olmamalı')) throw error;
    throw new Error('Media faylı tam oxunmadı. Faylı yenidən seçib cəhd edin.');
  } finally {
    try {
      if (cached.exists) await cached.delete();
    } catch {
      // A failed cache cleanup must not replace the original read result.
    }
  }
}

function hasBytes(bytes: Uint8Array, offset: number, signature: number[]): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

/** Reject obvious truncation/corruption before Storage receives the bytes. */
function hasValidMediaSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') return hasBytes(bytes, 0, [0xff, 0xd8, 0xff]);
  if (mimeType === 'image/png') return hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === 'image/webp') return hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50]);
  if (mimeType === 'image/gif') return hasBytes(bytes, 0, [0x47, 0x49, 0x46, 0x38]) && [0x37, 0x39].includes(bytes[4] || 0) && bytes[5] === 0x61;
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    return hasBytes(bytes, 4, [0x66, 0x74, 0x79, 0x70]) && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(String.fromCharCode(...bytes.slice(8, 12)));
  }
  if (mimeType === 'video/webm') return hasBytes(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3]);
  if (['video/mp4', 'video/x-m4v', 'video/quicktime', 'video/3gpp'].includes(mimeType)) return hasBytes(bytes, 4, [0x66, 0x74, 0x79, 0x70]);
  return false;
}

/** Upload byte data directly. React Native fetch(URI).blob() is unreliable for Android content:// camera assets. */
export async function uploadListingMedia(
  client: SupabaseClient,
  bucket: string,
  path: string,
  asset: ImagePickerAsset,
  categoryKey: string,
  onProgress?: (message: string) => void,
  readBytes: (uri: string, extension: string) => Promise<ReadMediaResult> = readFromCache,
) {
  const descriptor = describeListingMedia(asset, categoryKey);
  onProgress?.('Media faylı hazırlanır…');
  const read = await withListingTimeout(readBytes(asset.uri, descriptor.extension), 60_000);
  const bytes = read.bytes;
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES || read.fileSize === 0 || (read.fileSize !== null && (read.fileSize > MAX_MEDIA_BYTES || bytes.byteLength !== read.fileSize))) {
    throw new Error('Media faylı tam oxunmadı. Faylı yenidən seçib cəhd edin.');
  }
  if (!hasValidMediaSignature(bytes, descriptor.mimeType)) throw new Error('Media faylı zədələnib və ya formatına uyğun deyil. Başqa fayl seçin.');
  onProgress?.('Media serverə yüklənir…');
  const upload = client.storage.from(bucket).upload(path, bytes, { contentType: descriptor.mimeType, upsert: false });
  const { data, error } = await withListingTimeout(upload, 60_000, async result => {
    if (result.data?.path && !result.error) await client.storage.from(bucket).remove([path]);
  });
  if (error) throw error;
  if (!data?.path) throw new Error('Media serverdə saxlandığı təsdiqlənmədi. Təkrar cəhd edin.');
  return descriptor;
}
