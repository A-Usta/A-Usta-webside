'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
test('server-only proxy: real persistent multi-process budgets and offline security contracts',()=>{
 const result=spawnSync('python3',['-B','-m','unittest','discover','-s','tests/geoapify','-p','test_proxy.py','-v'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:30000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stderr,/Ran 18 tests/);
 assert.match(result.stderr,/\nOK\n/);
});
