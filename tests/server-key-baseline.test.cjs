const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');const {assertConfig}=require('./helpers/server-key-baseline.cjs'),root=path.resolve(__dirname,'..');
test('historical scope permits only exact server key transport correction',()=>assertConfig());
test('unknown privileged client or transport mutation fails historical gate',()=>{for(const target of ['backend/a-usta56/src/config/supabase.ts','backend/a-usta56/src/config/privileged-fetch.ts','backend/a-usta56/tests/privileged-fetch.test.ts'])assert.throws(()=>assertConfig(f=>{const b=fs.readFileSync(path.join(root,f));return f===target?Buffer.concat([b,Buffer.from('\n/* unintended change */')]):b}),/exact server-key/)});

test('all three historical guards reject mutations of either exact approved new file',()=>{
 const cp=require('node:child_process');
 for(const target of ['backend/a-usta56/src/config/privileged-fetch.ts','backend/a-usta56/tests/privileged-fetch.test.ts']){
  const bootstrap=`const fs=require('node:fs'),path=require('node:path'),read=fs.readFileSync;
  fs.readFileSync=function(file,...args){const value=read.call(this,file,...args);if(path.resolve(String(file))===path.resolve(${JSON.stringify(target)})){return typeof value==='string'?value+'\\n/* unauthorized */':Buffer.concat([value,Buffer.from('\\n/* unauthorized */')]);}return value;};
  require('./tests/listing-validation.test.cjs');require('./tests/listing-metadata-partial.test.cjs');require('./tests/db/seller-eligibility.test.cjs');`;
  const env={...process.env,P2A_CHILD:'1'};delete env.NODE_TEST_CONTEXT;
  const run=cp.spawnSync(process.execPath,['--test-reporter=tap','--test-name-pattern=protected runtime assets|protected scripts and modules|migration is functions-only','-e',bootstrap],{cwd:root,env,encoding:'utf8',maxBuffer:2e6});
  assert.equal(run.signal,null,run.stderr);assert.notEqual(run.status,0);assert.match(run.stdout,/# fail 3/);assert.match(run.stdout,/exact server-key compatibility correction/);assert.doesNotMatch(run.stdout+run.stderr,/Cannot find (?:module|package)|SyntaxError/);
 }
});
