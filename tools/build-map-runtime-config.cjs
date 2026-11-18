'use strict';
// Artifact-only producer. No deploy, network, source-tree write or credential output.
const fs=require('node:fs'),path=require('node:path');
function build({output,key,proxyOrigin,origins,sourceRoot=path.resolve(__dirname,'..')}){
 if(typeof output!=='string'||!path.isAbsolute(output))throw Error('MAP_CONFIG_INPUT');
 const proxy=proxyOrigin!==undefined;
 if(proxy?(!['https://austa-map-test.austahelper.workers.dev','https://austa-map-api.austahelper.workers.dev'].includes(proxyOrigin)||key): (typeof key!=='string'||!/^[a-zA-Z0-9_-]{20,100}$/.test(key)||/^sb_(secret|publishable)/.test(key)))throw Error('MAP_CONFIG_INPUT');
 if(!Array.isArray(origins)||!origins.length||origins.length>10||origins.some(origin=>{try{return typeof origin!=='string'||new URL(origin).origin!==origin||new URL(origin).protocol!=='https:';}catch{return true;}}))throw Error('MAP_CONFIG_ORIGIN');
 const root=fs.realpathSync(output),source=fs.realpathSync(sourceRoot);
 if(root===source||root.startsWith(source+path.sep))throw Error('ARTIFACT_DIRECTORY_REQUIRED');
 let parent=root;for(const segment of ['assets','map']){parent=path.join(parent,segment);if(fs.existsSync(parent)){if(fs.lstatSync(parent).isSymbolicLink()||!fs.statSync(parent).isDirectory())throw Error('ARTIFACT_SYMLINK');}else fs.mkdirSync(parent);if(fs.realpathSync(parent)!==parent)throw Error('ARTIFACT_SYMLINK');}
 const file=path.join(parent,'runtime-config.json');fs.writeFileSync(file,JSON.stringify({...(proxy?{proxyOrigin,proxyPath:'/map-api'}:{geoapifyBrowserKey:key}),allowedOrigins:[...new Set(origins)]})+'\n',{flag:'wx',mode:0o600});return file;
}
if(require.main===module){try{if(process.argv.length!==3)throw Error();build({output:process.argv[2],key:process.env.GEOAPIFY_BROWSER_KEY,proxyOrigin:process.env.AUSTA_MAP_PROXY_ORIGIN,origins:JSON.parse(process.env.AUSTA_MAP_ALLOWED_ORIGINS||process.env.GEOAPIFY_ALLOWED_ORIGINS||'null')});process.stdout.write('PUBLIC_MAP_ARTIFACT_CONFIG_CREATED\n');}catch{process.stderr.write('PUBLIC_MAP_ARTIFACT_CONFIG_BLOCKED\n');process.exitCode=2;}}
module.exports={build};
