const test = require('node:test');
const assert = require('node:assert/strict');

const helpers = () => import('../src/lib/service-attachments.ts');

test('service attachment accepts a complete PDF and normalizes its display name', async () => {
  const { attachmentExtension, safeAttachmentName, validateAttachmentBlob } = await helpers();
  const pdf = new Blob(['%PDF-1.7\n1 0 obj <<>> endobj\n%%EOF\n'], { type: 'application/pdf' });
  await validateAttachmentBlob('application/pdf', pdf, pdf.size);
  assert.equal(attachmentExtension('application/pdf'), 'pdf');
  assert.equal(safeAttachmentName('../servis\nqeyd.pdf', 'pdf'), '.._servisqeyd.pdf');
});

test('service attachment rejects fake, truncated and oversized PDFs', async () => {
  const { validateAttachmentBlob } = await helpers();
  await assert.rejects(validateAttachmentBlob('application/pdf', new Blob(['not a PDF']), 9), /məzmunu/);
  await assert.rejects(validateAttachmentBlob('application/pdf', new Blob(['%PDF-1.7\nbody']), 13), /natamam/);
  const oversized = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]);
  await assert.rejects(validateAttachmentBlob('application/pdf', oversized), /10 MB/);
});

test('service attachment rejects unsupported MIME and mismatched picked size', async () => {
  const { validateAttachmentBlob } = await helpers();
  const pdf = new Blob(['%PDF-1.7\n%%EOF']);
  await assert.rejects(validateAttachmentBlob('text/html', pdf), /dəstəklənir/);
  await assert.rejects(validateAttachmentBlob('application/pdf', pdf, pdf.size + 1), /ölçüsü/);
});
