// Independently runnable: node dist/authority/worker.js. Never launched by web startup.
import { reconcileCycle } from "./reconcile-uploads.js";
let stopping=false;
process.once("SIGTERM",()=>{stopping=true;});process.once("SIGINT",()=>{stopping=true;});
while(!stopping){try{await reconcileCycle();}catch{console.warn(JSON.stringify({event:"managed_reconciler_unavailable"}));}
 if(!stopping)await new Promise(resolve=>setTimeout(resolve,10_000));}
