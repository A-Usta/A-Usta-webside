const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{createHash}=require('crypto');
const root=path.resolve(__dirname,'../..'),expected={
  "backend/a-usta56/src/config/supabase.ts": "3f72f8753c4590bc09a2d13149d9d769c1e7da66664598615acff32d9a3d116f",
  "backend/a-usta56/src/config/privileged-fetch.ts": "d6b0d12d6f3bb26c4c5bed2a9bbaca0c4fb9421d13549725fc5f61583c3b8dfe"
};
exports.assertConfig=(read=f=>fs.readFileSync(path.join(root,f)))=>{for(const[f,h]of Object.entries(expected))assert.equal(createHash('sha256').update(read(f)).digest('hex'),h,'exact server-key compatibility correction: '+f)};
