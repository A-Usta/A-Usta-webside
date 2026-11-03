import { authority, type Upload } from "./durable-quotas.js";
import { observe } from "./upload-reservations.js";

export type ReconcileIO = { rpc: typeof authority; observe: typeof observe; now:()=>number; alert:(id:string)=>void };
const defaults:ReconcileIO={rpc:authority,observe,now:()=>Date.now(),alert:()=>{console.warn(JSON.stringify({event:"managed_upload_operator_review"}));}};
export async function reconcileCycle(io:ReconcileIO=defaults) {
  const start=io.now();
  // Bound caller waits, never infer rollback from a deadline. Late RPC commits
  // remain protected by durable generations and claim leases.
  async function bounded<T>(pending:Promise<T>):Promise<T>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([pending,new Promise<T>((_resolve,reject)=>{
      timer=setTimeout(()=>reject(new Error("Reconciliation cycle deadline")),Math.max(1,60_000-(io.now()-start)));
    })]);}finally{if(timer)clearTimeout(timer);}
  }
  const rpc:typeof authority=(name,args)=>bounded(io.rpc(name,args));
  const batch=await rpc<Upload[]>("austa_e2b_claim_reconciliation",{});
  if(!Array.isArray(batch) || batch.length>20)throw new Error("Invalid reconciliation batch");
  let cursor=0;
  await Promise.all([0,1].map(async()=>{
    while(cursor<batch.length && io.now()-start<60_000){const r=batch[cursor++];
      if(r.alert)io.alert(r.reservation_id);
      let generation=r.generation;
      const heartbeat=setInterval(()=>{void rpc("austa_e2b_claim_reconciliation",{p_id:r.reservation_id,p_generation:generation}).catch(()=>{});},30_000);
      try {
        const args={p_actor_id:r.actor_id,p_id:r.reservation_id,p_generation:r.generation};
        if(r.state==="reserved") {await rpc("austa_e2b_release_evidence",args);continue;}
        const pending=await rpc<Upload>("austa_e2b_resolve_upload",args);
        if(pending.code)continue;
        generation=pending.generation;
        const found=await bounded(io.observe(pending));
        if(found && found.bytes===pending.candidate_bytes && found.sha256===pending.content_sha256)
          await rpc("austa_e2b_finalize_evidence",{...args,p_generation:pending.generation,p_bytes:found.bytes,p_sha256:found.sha256});
        // Missing/mismatching objects remain charged. No destructive compensation.
      } catch { /* Durable lease/backoff makes the next bounded cycle recoverable. */ }
      finally {clearInterval(heartbeat);}
    }
  }));
  return cursor;
}
