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
  constructor(uri) { this.uri = uri; this.size = 4; }
  async bytes() { return new Uint8Array([1, 2, 3, 4]); }
}
vm.runInNewContext(`(function(exports,module,require){${js}\n})(module.exports,module,require)`, {
  module: testModule,
  require: name => name === 'expo-file-system' ? { File: FakeFile } : name === './listing-request' ? requestModule.exports : {},
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

test('empty and oversized assets are rejected before reading or sending', () => {
  assert.throws(() => describeListingMedia({ uri: 'file:///tmp/zero.jpg', fileName: 'zero.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: 0 }, 'cars'), /boş olmamalı/);
  assert.throws(() => describeListingMedia({ uri: 'file:///tmp/large.jpg', fileName: 'large.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: 50 * 1024 * 1024 + 1 }, 'cars'), /50 MiB/);
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
  }, 'cars', text => progress.push(text), async () => new Uint8Array([1, 2, 3, 4]));
  assert.equal(JSON.stringify(calls), JSON.stringify([{ bucket: 'listing-media', uploadPath: 'owner/listing/item.jpg', body: [1, 2, 3, 4], options: { contentType: 'image/jpeg', upsert: false } }]));
  assert.equal(descriptor.mediaType, 'image');
  assert.deepEqual(progress, ['Media faylı hazırlanır…', 'Media serverə yüklənir…']);
});

test('partial local reads and storage errors stay visible to the publish flow', async () => {
  const client = { storage: { from: () => ({ upload: async () => ({ data: null, error: new Error('Storage policy rejected upload') }) }) } };
  await assert.rejects(uploadListingMedia(client, 'listing-media', 'owner/listing/item.jpg', {
    uri: 'content://camera/item.jpg', fileName: 'item.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: 4,
  }, 'cars', undefined, async () => new Uint8Array([1, 2, 3])), /tam oxunmadı/);
  await assert.rejects(uploadListingMedia(client, 'listing-media', 'owner/listing/item.jpg', {
    uri: 'content://camera/item.jpg', fileName: 'item.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: 4,
  }, 'cars', undefined, async () => new Uint8Array([1, 2, 3, 4])), /Storage policy rejected upload/);
});
