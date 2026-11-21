export const SERVICE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export function attachmentExtension(mimeType: string): string {
  const extension = EXTENSIONS[mimeType.toLowerCase()];
  if (!extension) throw new Error('JPEG, PNG, WebP və PDF faylları dəstəklənir.');
  return extension;
}

export async function validateAttachmentBlob(
  mimeType: string,
  blob: Blob,
  expectedSize?: number | null,
): Promise<void> {
  const mime = mimeType.toLowerCase();
  attachmentExtension(mime);
  if (!Number.isSafeInteger(blob.size) || blob.size < 1 || blob.size > SERVICE_ATTACHMENT_MAX_BYTES) {
    throw new Error('Fayl boş ola bilməz və 10 MB həddini keçməməlidir.');
  }
  if (expectedSize != null && (!Number.isSafeInteger(expectedSize) || expectedSize !== blob.size)) {
    throw new Error('Fayl ölçüsü seçici məlumatı ilə uyğun gəlmir.');
  }

  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...head.slice(start, end));
  const valid = mime === 'image/jpeg'
    ? head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
    : mime === 'image/png'
      ? head[0] === 0x89 && ascii(1, 4) === 'PNG' && head[4] === 13 && head[5] === 10 && head[6] === 26 && head[7] === 10
      : mime === 'image/webp'
        ? ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
        : ascii(0, 5) === '%PDF-';
  if (!valid) throw new Error('Faylın məzmunu seçilmiş növə uyğun deyil.');

  if (mime === 'application/pdf') {
    const tail = new Uint8Array(await blob.slice(Math.max(0, blob.size - 1024)).arrayBuffer());
    if (!new TextDecoder().decode(tail).includes('%%EOF')) {
      throw new Error('PDF faylının sonu natamamdır. Başqa fayl seçin.');
    }
  }
}

export function safeAttachmentName(name: string | null | undefined, extension: string): string {
  const cleaned = (name || `servis-${Date.now()}.${extension}`)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, 200);
  return cleaned || `servis-${Date.now()}.${extension}`;
}
