const {test}=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const cases={limit:'create 59/60/61',actor:'actor live cap',assignment:'unsettled assignment',finalize:'finalize once',release:'safe release',bytes:'oversized',uncertain:'uncertainty never refunds',idempotency:'state/nonnegative',path:'state/nonnegative',generation:'uncertainty never refunds',grants:'private data',lock:'lock order'};
for(const [name,contract]of Object.entries(cases))test('E2B mutation detected: '+name,()=>{
 const env={...process.env,E2B_MUTATION:name};delete env.NODE_TEST_CONTEXT;
 const run=spawnSync(process.execPath,['--test','--test-reporter=tap',require.resolve('./durable-quotas.test.cjs')],{env,encoding:'utf8',maxBuffer:2e6});
 assert.notEqual(run.status,0,'mutant survived: '+name);assert.ok(!run.stdout.includes('mutation target '+name),'missing mutation target');
 const failed=[...run.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(x=>x[1]);assert.ok(failed.some(x=>x.includes(contract)),name+': expected contract failure '+contract+'; actual '+failed.join(', '));
});
