import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { supabase } from "../config/supabase.js";
import { admissionPolicy } from "../diagnostics/admission.js";
import { authority, authorityFailure, decision, uploadResponse, type Upload } from "./durable-quotas.js";

const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
export async function observe(r: Upload): Promise<{bytes:number;sha256:string}|null> {
  // Download is capped by the already reserved ceiling. Body streaming avoids
  // allocating an arbitrary direct-overwrite object as one unbounded Blob.
  const signed = await supabase.storage.from("service-evidence").createSignedUrl(r.path,60);
  if (signed.error || !signed.data?.signedUrl) return null;
  const response = await fetch(signed.data.signedUrl,{signal:AbortSignal.timeout(30_000)});
  if (!response.ok || !response.body) return null;
  const reader=response.body.getReader(),digest=createHash("sha256");let bytes=0;
  try { for (;;) {const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;
    if(bytes>admissionPolicy.multipart.fileSize){await reader.cancel();return null;}digest.update(item.value);}
  } finally {reader.releaseLock();}
  if (!bytes) return null;
  return {bytes,sha256:digest.digest("hex")};
}
export async function managedUpload(request: FastifyRequest, reply: FastifyReply, actor: string, assignment: string, stage: string): Promise<boolean> {
  let r: Upload|undefined; let issued=false;
  try {
    const reserved=await authority<Upload>("austa_e2b_reserve_evidence",{p_actor_id:actor,p_assignment_id:assignment,p_stage:stage,
      p_key:request.headers["idempotency-key"]??null,p_content_type:request.headers["x-evidence-content-type"]??null});
    if(reserved.enabled===false)return false; // Explicit DB-controlled pre-cutover compatibility only.
    if(decision(request,reply,reserved))return true;
    r=reserved;
    if(!r.reservation_id || !Number.isSafeInteger(r.generation))throw new Error("Invalid reservation response");
    if(r.replay){uploadResponse(reply,r);return true;}
    let buffer:Buffer|undefined;
    try {
      for await(const part of request.parts({limits:admissionPolicy.multipart})) {
        if(part.type!=="file" || buffer || part.mimetype!==r.content_type)throw new Error("Invalid multipart");
        buffer=await part.toBuffer();
      }
      if(!buffer?.length || buffer.length>admissionPolicy.multipart.fileSize)throw new Error("Invalid size");
    } catch {
      await authority("austa_e2b_release_evidence",{p_actor_id:actor,p_id:r.reservation_id,p_generation:r.generation});
      reply.code(400).send({error:"Bad Request",code:"invalid_evidence",message:"One bounded JPEG, PNG or WEBP photo is required",request_id:request.id});return true;
    }
    const started=await authority<Upload>("austa_e2b_begin_upload",{p_actor_id:actor,p_id:r.reservation_id,p_generation:r.generation,p_bytes:buffer.length,p_sha256:hash(buffer)});
    if(decision(request,reply,started))return true;r=started;
    issued=true; // From here every unknown error remains charged, including API errors.
    const upload=await supabase.storage.from("service-evidence").upload(r.path,buffer,{contentType:r.content_type,upsert:false});
    if(upload.error)throw new Error("Upload outcome not confirmed");
    const observation=await observe(r);
    if(!observation || observation.bytes!==buffer.length || observation.sha256!==hash(buffer))throw new Error("Object observation mismatch");
    const finalized=await authority<Upload>("austa_e2b_finalize_evidence",{p_actor_id:actor,p_id:r.reservation_id,p_generation:r.generation,p_bytes:observation.bytes,p_sha256:observation.sha256});
    if(decision(request,reply,finalized))return true;
    uploadResponse(reply,finalized);return true;
  } catch(error) {
    if(r && issued) {
      try { const pending=await authority<Upload>("austa_e2b_resolve_upload",{p_actor_id:actor,p_id:r.reservation_id,p_generation:r.generation});
        if(!pending.code){uploadResponse(reply,pending);return true;}
      } catch { /* A lost finalize response may have committed. Never delete/refund. */ }
    }
    authorityFailure(request,reply,error);return true;
  }
}
