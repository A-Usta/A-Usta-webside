'use strict';
const fs=require('node:fs'),path=require('node:path');
function preview(output){
 const root=path.resolve(__dirname,'../..');fs.mkdirSync(output,{recursive:true});
 for(const folder of ['assets/map','assets/vendor/leaflet-1.9.4']){const target=path.join(output,folder);fs.mkdirSync(target,{recursive:true});for(const entry of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){if(!entry.isFile()||entry.name==='runtime-config.json')continue;fs.copyFileSync(path.join(root,folder,entry.name),path.join(target,entry.name));}}
 fs.writeFileSync(path.join(output,'index.html'),'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A-USTA isolated map preview</title><p>TEST PREVIEW · No live credential included. A-USTA database is disconnected.</p><main id="home"><div id="austaTopUrgentV24"></div></main><link rel="stylesheet" href="assets/map/map.css"><script>window.AUSTA_SUPABASE={rpc:async()=>({data:[]})};</script><script src="assets/map/config.js"></script><script src="assets/map/data.js"></script><script src="assets/map/publication.js"></script><script src="assets/map/map.js"></script>');
 fs.writeFileSync(path.join(output,'README.txt'),'Credential-free static map test artifact. No deployment, no database connection, no real browser key. Runtime configuration must be separately provisioned on an approved HTTPS origin; this ZIP does not certify live integration. Never upload a generated secret-bearing runtime-config.json.\n');
}
if(require.main===module){try{preview(process.argv[2]);console.log('KEY_FREE_PREVIEW_CREATED');}catch{console.error('PREVIEW_BLOCKED');process.exitCode=2;}}
module.exports={preview};
