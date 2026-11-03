const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
// F1 restores the original acceptance function; preserve its exact historical guard.
const acceptance="  async function acceptAssignment(\n    assignmentId\n  ) {\n\n    await apiRequest(\n      `/service-order-assignments/${encodeURIComponent(\n        assignmentId\n      )}/accept`,\n      {\n        method: \"PATCH\",\n        body: JSON.stringify({})\n      }\n    );\n\n    showStatus(\n      \"\u2713 Sifari\u015f q\u0259bul edildi. \u0130ndi BEFORE foto y\u00fckl\u0259yin.\",\n      \"success\"\n    );\n\n  }\n\n\n";
exports.normalize=s=>{const start=s.indexOf('  async function acceptAssignment('),end=s.indexOf('  async function rejectAssignment(',start);assert.ok(start>=0&&end>start,'acceptance boundaries');assert.equal(s.slice(start,end),acceptance,'exact restored acceptance contract');return s;};
const reviewed={
  "backend/a-usta56/src/authority/worker.ts": "7a14768af5c7637ebfc40882bf98ce389c4b576b215ab7b6db89d1c8c3825d8b",
  "backend/a-usta56/src/authority/reconcile-uploads.ts": "9e5ddaed9b7b6bda8950b69e9db4a7f622a619e55c01652c86006c17a4d4e5ba",
  "backend/a-usta56/src/authority/upload-reservations.ts": "ba406de82fd14cf4f4f34856cae32fc3e2957eb492c7b31f4ba8d14076e32d93",
  "backend/a-usta56/src/authority/durable-quotas.ts": "942a5294229d00fccac8120a6bb435e5701a061236c9a0a2e4a0519acc7b04a5",
  "backend/a-usta56/tests/durable-uploads.test.ts": "205c8dd09f0cab4e5817c0f39fceefefe7c05b25e193a3d8f79827cab997430a"
};
exports.assertScope=()=>{for(const [p,h]of Object.entries(reviewed))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),h,p);};
