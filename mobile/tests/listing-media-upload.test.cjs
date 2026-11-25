const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/lib/listing-media-upload.ts'), 'utf8');
const js = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
const testModule = { exports: {} };
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const mp4Bytes = new Uint8Array([0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const cacheCopies = [];
const cacheDeletes = [];
const requestSource = fs.readFileSync(path.join(root, 'src/lib/listing-request.ts'), 'utf8');
const requestJs = ts.transpile(requestSource, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
const requestModule = { exports: {} };
vm.runInNewContext(`(function(exports,module,require){${requestJs}\n})(module.exports,module,require)`, {
  module: requestModule,
  setTimeout,
  clearTimeout,
  require: () => ({}),
});
class FakeFile {
  constructor(...parts) {
    this.uri = parts.join('/');
    this.size = this.uri.endsWith('.mp4') ? mp4Bytes.length : jpegBytes.length;
    this.exists = !this.uri.startsWith('file:///cache/');
    this.value = this.uri.endsWith('.mp4') ? mp4Bytes : jpegBytes;
  }
  async copy(destination) { cacheCopies.push(destination.uri); destination.size = destination.uri.endsWith('.mp4') ? mp4Bytes.length : jpegBytes.length; destination.exists = true; destination.value = destination.uri.endsWith('.mp4') ? mp4Bytes : jpegBytes; }
  async bytes() { return this.value; }
  async delete() { cacheDeletes.push(this.uri); this.exists = false; }
}
vm.runInNewContext(`(function(exports,module,require){${js}\n})(module.exports,module,require)`, {
  module: testModule,
  require: name => name === 'expo-file-system' ? { File: FakeFile, Paths: { cache: 'file:///cache' } } : name === './listing-request' ? requestModule.exports : {},
});
const { describeListingMedia, uploadListingMedia } = testModule.exports;

test('Android camera content URI works when picker omits MIME and size', () => {
  const result = describeListingMedia({ uri: 'content://media/camera/123/photo.jpg', fileName: null, type: 'image', mimeType: null, fileSize: null }, 'cars');
  assert.equal(result.mediaType, 'image');
  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(result.extension, 'jpg');
  assert.equal(result.size, null);
});

test('media type and file extension mismatches are rejected before upload', () => {
  assert.throws(() => describeListingMedia({ uri: 'file:///tmp/clip.mp4', fileName: 'clip.mp4', type: 'image', mimeType: 'image/jpeg', fileSize: 10 }, 'cars'), /formatı uyğun gəlmir/);
  assert.throws(() => describeListingMedia({ uri: 'file:///tmp/clip.mp4', fileName: 'clip.mp4', type: 'video', mimeType: 'video/mp4', fileSize: 10 }, 'plate'), /video qəbul edilmir/);
});

test('the shared media validator supports images across all active categories and preserves plate video restriction', () => {
  const keys = ['cars','rent','parts','accessories','moto','special','bus','water','caravan','trailer','plate','service','usta','dealer','leasing','insurance','sober_driver'];
  for (const key of keys) {
    assert.equal(describeListingMedia({ uri: 'content://picker/photo.jpg', fileName: 'photo.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: null }, key).mediaType, 'image', key);
  }
  assert.throws(() => describeListingMedia({ uri: 'content://picker/clip.mp4', fileName: 'clip.mp4', type: 'video', mimeType: 'video/mp4', fileSize: null }, 'plate'), /video qəbul edilmir/);
});

test('picker fileSize is advisory; actual cached bytes determine empty and oversized validation', async () => {
  const client = { storage: { from: () => ({ upload: async () => ({ data: { path: 'x' }, error: null }) }) } };
  const asset = { uri: 'content://provider/item.jpg', fileName: 'item.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: 999 };
  await uploadListingMedia(client, 'listing-media', 'x', asset, 'cars', undefined, async () => ({ bytes: jpegBytes, fileSize: jpegBytes.length }));
  await assert.rejects(uploadListingMedia(client, 'listing-media', 'x', asset, 'cars', undefined, async () => ({ bytes: new Uint8Array(), fileSize: 0 })), /tam oxunmadı/);
  await assert.rejects(uploadListingMedia(client, 'listing-media', 'x', asset, 'cars', undefined, async () => ({ bytes: new Uint8Array([1]), fileSize: 50 * 1024 * 1024 + 1 })), /tam oxunmadı/);
});

test('content and file URIs are copied to private cache and temp copies are cleaned after reading', async () => {
  const calls = [];
  const client = { storage: { from: () => ({ upload: async (_path, body) => { calls.push(Array.from(body)); return { data: { path: 'x' }, error: null }; } }) } };
  await uploadListingMedia(client, 'listing-media', 'x', {
    uri: 'content://media/camera/123/photo.jpg', fileName: 'photo.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: 400,
  }, 'cars');
  await uploadListingMedia(client, 'listing-media', 'y', {
    uri: 'file:///tmp/clip.mp4', fileName: 'clip.mp4', type: 'video', mimeType: 'video/mp4', fileSize: 400,
  }, 'cars');
  assert.deepEqual(calls, [Array.from(jpegBytes), Array.from(mp4Bytes)]);
  assert.equal(cacheCopies.length, cacheDeletes.length);
  assert.ok(cacheCopies.every(uri => cacheDeletes.includes(uri)));
});

test('upload sends byte data directly and reports localized progress phases', async () => {
  const calls = [];
  const client = { storage: { from: bucket => ({ upload: async (uploadPath, body, options) => {
    calls.push({ bucket, uploadPath, body: Array.from(body), options });
    return { data: { path: uploadPath }, error: null };
  } }) } };
  const progress = [];
  const descriptor = await uploadListingMedia(client, 'listing-media', 'owner/listing/item.jpg', {
    uri: 'content://camera/item.jpg', fileName: 'item.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: 4,
  }, 'cars', text => progress.push(text), async () => ({ bytes: jpegBytes, fileSize: jpegBytes.length }));
  assert.equal(JSON.stringify(calls), JSON.stringify([{ bucket: 'listing-media', uploadPath: 'owner/listing/item.jpg', body: Array.from(jpegBytes), options: { contentType: 'image/jpeg', upsert: false } }]));
  assert.equal(descriptor.mediaType, 'image');
  assert.deepEqual(progress, ['Media faylı hazırlanır…', 'Media serverə yüklənir…']);
});

test('partial local reads and storage errors stay visible to the publish flow', async () => {
  const client = { storage: { from: () => ({ upload: async () => ({ data: null, error: new Error('Storage policy rejected upload') }) }) } };
  await assert.rejects(uploadListingMedia(client, 'listing-media', 'owner/listing/item.jpg', {
    uri: 'content://camera/item.jpg', fileName: 'item.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: 4,
  }, 'cars', undefined, async () => ({ bytes: new Uint8Array([0xff, 0xd8, 0xff]), fileSize: 4 })), /tam oxunmadı/);
  await assert.rejects(uploadListingMedia(client, 'listing-media', 'owner/listing/item.jpg', {
    uri: 'content://camera/item.jpg', fileName: 'item.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: 4,
  }, 'cars', undefined, async () => ({ bytes: jpegBytes, fileSize: jpegBytes.length })), /Storage policy rejected upload/);
});

test('corrupt file signatures are rejected before Storage upload', async () => {
  let uploadCount = 0;
  const client = { storage: { from: () => ({ upload: async () => { uploadCount++; return { data: { path: 'x' }, error: null }; } }) } };
  await assert.rejects(uploadListingMedia(client, 'listing-media', 'x', {
    uri: 'file:///tmp/photo.jpg', fileName: 'photo.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: 4,
  }, 'cars', undefined, async () => ({ bytes: new Uint8Array([0, 1, 2, 3]), fileSize: 4 })), /zədələnib/);
  assert.equal(uploadCount, 0);
});
