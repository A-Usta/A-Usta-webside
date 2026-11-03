-- Additive only. NOT active until a separately reviewed production cutover.
-- Accounting covers backend-managed evidence, never physical whole-bucket usage.
BEGIN;
CREATE SCHEMA IF NOT EXISTS austa_authority;
REVOKE ALL ON SCHEMA austa_authority FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE austa_authority.control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 legacy_validated boolean NOT NULL DEFAULT false,
 policy_version integer NOT NULL DEFAULT 1 CHECK(policy_version=1),
 reconciler_seen_at timestamptz,
 cutover_at timestamptz,
 CHECK(NOT enabled OR (legacy_validated AND reconciler_seen_at IS NOT NULL AND cutover_at IS NOT NULL))
);
INSERT INTO austa_authority.control(singleton) VALUES(true);
CREATE TABLE austa_authority.quota_counters (
 operation text NOT NULL, scope_kind text NOT NULL CHECK(scope_kind IN ('actor','assignment')),
 scope_id uuid NOT NULL, window_start timestamptz NOT NULL, window_end timestamptz NOT NULL,
 policy_version integer NOT NULL DEFAULT 1 CHECK(policy_version>0),
 reserved_count bigint NOT NULL DEFAULT 0 CHECK(reserved_count>=0),
 consumed_count bigint NOT NULL DEFAULT 0 CHECK(consumed_count>=0),
 reserved_bytes bigint NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
 consumed_bytes bigint NOT NULL DEFAULT 0 CHECK(consumed_bytes>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(operation,scope_kind,scope_id,window_start), CHECK(window_end>window_start)
);
CREATE TABLE austa_authority.upload_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE RESTRICT,
 assignment_id uuid NOT NULL REFERENCES public.service_order_assignments(id) ON DELETE RESTRICT,
 stage text NOT NULL CHECK(stage IN ('before','after')), operation text NOT NULL DEFAULT 'managed_evidence' CHECK(operation='managed_evidence'),
 idempotency_key uuid NOT NULL, descriptor text NOT NULL CHECK(descriptor IN ('image/jpeg','image/png','image/webp')),
 bucket text NOT NULL DEFAULT 'service-evidence' CHECK(bucket='service-evidence'), path text NOT NULL UNIQUE,
 reserved_count integer NOT NULL DEFAULT 1 CHECK(reserved_count=1), reserved_bytes bigint NOT NULL DEFAULT 10485760 CHECK(reserved_bytes=10485760),
 actual_bytes bigint CHECK(actual_bytes>0 AND actual_bytes<=reserved_bytes),
 candidate_bytes bigint CHECK(candidate_bytes>0 AND candidate_bytes<=reserved_bytes), content_sha256 text CHECK(content_sha256 ~ '^[0-9a-f]{64}$'),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','uploading','reconciling','finalized','released','expired')),
 generation bigint NOT NULL DEFAULT 0 CHECK(generation>=0), policy_version integer NOT NULL DEFAULT 1 CHECK(policy_version>0),
 window_start timestamptz NOT NULL, window_end timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '5 minutes',
 upload_started_at timestamptz, finalized_at timestamptz, released_at timestamptz,
 next_reconcile_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '5 minutes',
 -- Only a privileged operator may record a reviewed provider terminal-no-write artifact.
 terminal_no_write_proof jsonb CHECK(terminal_no_write_proof IS NULL OR (jsonb_typeof(terminal_no_write_proof)='object' AND terminal_no_write_proof->>'outcome'='terminal_no_write' AND terminal_no_write_proof ?& ARRAY['outcome','provider_request_id','artifact_sha256','reviewed_by','reviewed_at'] AND terminal_no_write_proof->>'artifact_sha256' ~ '^[0-9a-f]{64}$')),
 lease_until timestamptz, attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), alerted_at timestamptz,
 UNIQUE(actor_id,operation,idempotency_key), CHECK(window_end>window_start),
 CHECK((state='finalized')=(finalized_at IS NOT NULL)),
 CHECK((state IN ('released','expired'))=(released_at IS NOT NULL)),
 CHECK(state<>'finalized' OR actual_bytes IS NOT NULL)
);
CREATE INDEX e2b_actor_active ON austa_authority.upload_reservations(actor_id,state);
CREATE INDEX e2b_assignment_active ON austa_authority.upload_reservations(assignment_id,stage,state);
CREATE INDEX e2b_order_fk ON austa_authority.upload_reservations(order_id);
CREATE INDEX e2b_reconcile ON austa_authority.upload_reservations(next_reconcile_at,id) WHERE state IN ('reserved','uploading','reconciling');
CREATE INDEX e2b_terminal ON austa_authority.upload_reservations(finalized_at,released_at) WHERE state IN ('finalized','released','expired');
-- Legacy references are inventoried without assuming caller-declared size is true.
CREATE TABLE austa_authority.legacy_evidence (
 order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE RESTRICT,
 path text NOT NULL, assignment_id uuid REFERENCES public.service_order_assignments(id) ON DELETE RESTRICT,
 stage text CHECK(stage IN ('before','after')), bytes bigint CHECK(bytes>0),
 verified boolean NOT NULL DEFAULT false, PRIMARY KEY(order_id,path),
 CHECK(NOT verified OR (assignment_id IS NOT NULL AND stage IS NOT NULL AND bytes IS NOT NULL))
);
CREATE INDEX e2b_legacy_assignment ON austa_authority.legacy_evidence(assignment_id);
INSERT INTO austa_authority.legacy_evidence(order_id,path,stage)
 SELECT DISTINCT o.id,e->>'path',e->>'category' FROM public.service_orders o,
 LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.evidence_files)='array' THEN o.evidence_files ELSE '[]'::jsonb END) e
 WHERE e->>'category' IN ('before','after') AND nullif(e->>'path','') IS NOT NULL;
ALTER TABLE austa_authority.control ENABLE ROW LEVEL SECURITY;
ALTER TABLE austa_authority.quota_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE austa_authority.upload_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE austa_authority.legacy_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA austa_authority FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION austa_authority.lock_quota(p_operation text,p_scope text,p_id uuid,p_start timestamptz,p_end timestamptz)
 RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN
 INSERT INTO austa_authority.quota_counters(operation,scope_kind,scope_id,window_start,window_end)
 VALUES(p_operation,p_scope,p_id,p_start,p_end) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM austa_authority.quota_counters WHERE operation=p_operation AND scope_kind=p_scope AND scope_id=p_id AND window_start=p_start FOR UPDATE;
END;$f$;
-- Every resolution discovers routing without a lock, then retains order -> assignment
-- -> canonical occupancy actor/assignment quota locks -> reservation. Never reverse.
CREATE FUNCTION austa_authority.lock_upload(p_id uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE r austa_authority.upload_reservations%ROWTYPE;
BEGIN
 SELECT * INTO STRICT r FROM austa_authority.upload_reservations WHERE id=p_id;
 PERFORM 1 FROM public.service_orders WHERE id=r.order_id FOR UPDATE;
 PERFORM 1 FROM public.service_order_assignments WHERE id=r.assignment_id AND order_id=r.order_id FOR UPDATE;
 PERFORM austa_authority.lock_quota('occupancy','actor',r.actor_id,'epoch','infinity');
 PERFORM austa_authority.lock_quota('occupancy','assignment',r.assignment_id,'epoch','infinity');
 PERFORM 1 FROM austa_authority.upload_reservations WHERE id=p_id FOR UPDATE;
END;$f$;
CREATE FUNCTION austa_authority.dto(r austa_authority.upload_reservations) RETURNS jsonb LANGUAGE sql SET search_path='' AS $f$
 SELECT jsonb_build_object('reservation_id',r.id,'actor_id',r.actor_id,'state',r.state,'generation',r.generation,'stage',r.stage,
 'assignment_id',r.assignment_id,'bucket',r.bucket,'path',r.path,'content_type',r.descriptor,
 'created_at',r.created_at,'candidate_bytes',r.candidate_bytes,'content_sha256',r.content_sha256);
$f$;
CREATE FUNCTION public.austa_e2b_admit_order_create(p_actor_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE start_at timestamptz:=date_trunc('day',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; n bigint;
BEGIN
 IF NOT (SELECT enabled FROM austa_authority.control) THEN RETURN '{"enabled":false}'::jsonb; END IF;
 IF p_actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor_id) THEN RAISE EXCEPTION 'Actor invalid' USING ERRCODE='42501'; END IF;
 PERFORM austa_authority.lock_quota('order_create','actor',p_actor_id,start_at,start_at+interval '1 day');
 UPDATE austa_authority.quota_counters SET consumed_count=consumed_count+1,updated_at=clock_timestamp()
 WHERE operation='order_create' AND scope_kind='actor' AND scope_id=p_actor_id AND window_start=start_at AND consumed_count<60 RETURNING consumed_count INTO n;
 IF NOT FOUND THEN RETURN jsonb_build_object('enabled',true,'code','quota_exhausted','retry_after_seconds',greatest(1,ceil(extract(epoch FROM start_at+interval '1 day'-clock_timestamp())))); END IF;
 RETURN '{"enabled":true,"code":"admitted"}'::jsonb;
END;$f$;
CREATE FUNCTION public.austa_e2b_reserve_evidence(p_actor_id uuid,p_assignment_id uuid,p_stage text,p_key text,p_content_type text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE o public.service_orders%ROWTYPE; a public.service_order_assignments%ROWTYPE; r austa_authority.upload_reservations%ROWTYPE;
 ts timestamptz:=clock_timestamp(); ws timestamptz; n bigint; b bigint; live_n bigint; risk bigint; folder text; rid uuid:=gen_random_uuid(); ext text;
BEGIN
 IF NOT (SELECT enabled FROM austa_authority.control) THEN RETURN '{"enabled":false}'::jsonb; END IF;
 SELECT * INTO a FROM public.service_order_assignments WHERE id=p_assignment_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment missing' USING ERRCODE='P0002'; END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=a.order_id FOR UPDATE;
 SELECT * INTO a FROM public.service_order_assignments WHERE id=p_assignment_id AND order_id=o.id FOR UPDATE;
 IF p_actor_id IS NULL OR a.provider_id<>p_actor_id THEN RAISE EXCEPTION 'Actor forbidden' USING ERRCODE='42501'; END IF;
 IF p_key IS NULL OR p_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR p_stage IS NULL OR p_stage NOT IN ('before','after') OR p_content_type NOT IN ('image/jpeg','image/png','image/webp') OR p_content_type IS NULL THEN RETURN '{"code":"validation_invalid"}'::jsonb; END IF;
 PERFORM austa_authority.lock_quota('occupancy','actor',p_actor_id,'epoch','infinity');
 PERFORM austa_authority.lock_quota('occupancy','assignment',a.id,'epoch','infinity');
 SELECT * INTO r FROM austa_authority.upload_reservations WHERE actor_id=p_actor_id AND operation='managed_evidence' AND idempotency_key=p_key::uuid;
 IF FOUND THEN
  IF r.assignment_id<>a.id OR r.stage<>p_stage OR r.descriptor<>p_content_type THEN RETURN '{"code":"idempotency_conflict"}'::jsonb; END IF;
  RETURN austa_authority.dto(r)||'{"enabled":true,"replay":true}'::jsonb;
 END IF;
 IF NOT (SELECT legacy_validated FROM austa_authority.control) OR (SELECT reconciler_seen_at FROM austa_authority.control)<ts-interval '3 minutes' OR (SELECT reconciler_seen_at FROM austa_authority.control) IS NULL THEN RETURN '{"code":"authority_unavailable"}'::jsonb; END IF;
 IF o.status<>(CASE WHEN p_stage='before' THEN 'accepted' ELSE 'in_progress' END) OR a.status<>o.status THEN RETURN '{"code":"state_conflict"}'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM austa_authority.legacy_evidence WHERE order_id=o.id AND NOT verified) THEN RETURN '{"code":"legacy_debt"}'::jsonb; END IF;
 SELECT count(*) FILTER(WHERE state IN ('reserved','uploading')),count(*) INTO live_n,risk FROM austa_authority.upload_reservations WHERE actor_id=p_actor_id AND state IN ('reserved','uploading','reconciling');
 IF live_n>=2 OR risk>=6 THEN RETURN '{"code":"quota_exhausted"}'::jsonb; END IF;
 SELECT count(*) FILTER(WHERE state IN ('reserved','uploading')),count(*) INTO live_n,risk FROM austa_authority.upload_reservations WHERE assignment_id=a.id AND state IN ('reserved','uploading','reconciling');
 IF live_n>=2 OR risk>=4 THEN RETURN '{"code":"quota_exhausted"}'::jsonb; END IF;
 SELECT count(*),coalesce(sum(CASE WHEN state='finalized' THEN actual_bytes ELSE reserved_bytes END),0) INTO n,b FROM austa_authority.upload_reservations WHERE assignment_id=a.id AND state NOT IN ('released','expired');
 SELECT n+count(*),b+coalesce(sum(bytes),0) INTO n,b FROM austa_authority.legacy_evidence WHERE assignment_id=a.id AND verified;
 IF n>=12 OR b+10485760>125829120 THEN RETURN '{"code":"quota_exhausted"}'::jsonb; END IF;
 SELECT count(*),coalesce(sum(CASE WHEN state='finalized' THEN actual_bytes ELSE reserved_bytes END),0) INTO n,b FROM austa_authority.upload_reservations WHERE assignment_id=a.id AND stage=p_stage AND state NOT IN ('released','expired');
 SELECT n+count(*),b+coalesce(sum(bytes),0) INTO n,b FROM austa_authority.legacy_evidence WHERE assignment_id=a.id AND stage=p_stage AND verified;
 IF n>=6 OR b+10485760>62914560 THEN RETURN '{"code":"quota_exhausted"}'::jsonb; END IF;
 ws:=date_trunc('hour',ts AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 PERFORM austa_authority.lock_quota('upload_attempt','actor',p_actor_id,ws,ws+interval '1 hour');
 UPDATE austa_authority.quota_counters SET consumed_count=consumed_count+1 WHERE operation='upload_attempt' AND scope_kind='actor' AND scope_id=p_actor_id AND window_start=ws AND consumed_count<60 RETURNING consumed_count INTO n;
 IF NOT FOUND THEN RETURN jsonb_build_object('code','quota_exhausted','retry_after_seconds',greatest(1,ceil(extract(epoch FROM ws+interval '1 hour'-ts)))); END IF;
 folder:=CASE WHEN nullif(btrim(o.client_order_id),'') IS NOT NULL THEN regexp_replace(btrim(o.client_order_id),'[^a-zA-Z0-9_-]','_','g') ELSE o.id::text END;
 ext:=CASE p_content_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' ELSE 'webp' END;
 INSERT INTO austa_authority.upload_reservations(id,actor_id,order_id,assignment_id,stage,idempotency_key,descriptor,path,window_start,window_end)
 VALUES(rid,p_actor_id,o.id,a.id,p_stage,p_key::uuid,p_content_type,o.customer_id::text||'/'||folder||'/'||p_stage||'/'||floor(extract(epoch FROM ts)*1000)::bigint::text||'-'||rid::text||'.'||ext,ws,ws+interval '1 hour') RETURNING * INTO r;
 UPDATE austa_authority.quota_counters SET reserved_count=reserved_count+1,reserved_bytes=reserved_bytes+10485760,updated_at=ts WHERE operation='occupancy' AND window_start='epoch' AND ((scope_kind='actor' AND scope_id=p_actor_id) OR (scope_kind='assignment' AND scope_id=a.id));
 RETURN austa_authority.dto(r)||'{"enabled":true,"replay":false}'::jsonb;
END;$f$;
CREATE FUNCTION public.austa_e2b_begin_upload(p_actor_id uuid,p_id uuid,p_generation bigint,p_bytes bigint,p_sha256 text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE r austa_authority.upload_reservations%ROWTYPE;
BEGIN
 PERFORM austa_authority.lock_upload(p_id); SELECT * INTO r FROM austa_authority.upload_reservations WHERE id=p_id;
 IF r.actor_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF r.state<>'reserved' OR r.generation<>p_generation OR r.expires_at<=clock_timestamp() THEN RETURN '{"code":"state_conflict"}'::jsonb; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.service_order_assignments a JOIN public.service_orders o ON o.id=a.order_id WHERE a.id=r.assignment_id AND a.order_id=r.order_id AND a.provider_id=r.actor_id AND a.status=o.status AND o.status=(CASE WHEN r.stage='before' THEN 'accepted' ELSE 'in_progress' END)) THEN RETURN '{"code":"state_conflict"}'::jsonb; END IF;
 IF p_bytes IS NULL OR p_bytes<=0 OR p_bytes>r.reserved_bytes OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' THEN RETURN '{"code":"size_invalid"}'::jsonb; END IF;
 UPDATE austa_authority.upload_reservations SET state='uploading',generation=generation+1,candidate_bytes=p_bytes,content_sha256=p_sha256,upload_started_at=clock_timestamp() WHERE id=p_id RETURNING * INTO r;
 RETURN austa_authority.dto(r);
END;$f$;
CREATE FUNCTION public.austa_e2b_finalize_evidence(p_actor_id uuid,p_id uuid,p_generation bigint,p_bytes bigint,p_sha256 text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE r austa_authority.upload_reservations%ROWTYPE; rec jsonb; result jsonb;
BEGIN
 PERFORM austa_authority.lock_upload(p_id); SELECT * INTO r FROM austa_authority.upload_reservations WHERE id=p_id;
 IF r.actor_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF r.state='finalized' THEN RETURN austa_authority.dto(r); END IF;
 IF r.state NOT IN ('uploading','reconciling') OR r.generation<>p_generation THEN RETURN '{"code":"state_conflict"}'::jsonb; END IF;
 IF p_bytes IS DISTINCT FROM r.candidate_bytes OR p_sha256 IS DISTINCT FROM r.content_sha256 OR p_bytes IS NULL THEN RETURN '{"code":"observation_mismatch"}'::jsonb; END IF;
 rec:=jsonb_build_object('bucket',r.bucket,'path',r.path,'category',r.stage,'content_type',r.descriptor,'uploaded_at',r.created_at::text,'assignment_id',r.assignment_id::text);
 result:=public.austa_p2c_append_evidence(r.order_id,r.assignment_id,r.actor_id,rec);
 UPDATE austa_authority.upload_reservations SET state='finalized',actual_bytes=p_bytes,finalized_at=clock_timestamp(),lease_until=NULL WHERE id=p_id RETURNING * INTO r;
 UPDATE austa_authority.quota_counters SET reserved_count=reserved_count-1,reserved_bytes=reserved_bytes-r.reserved_bytes,consumed_count=consumed_count+1,consumed_bytes=consumed_bytes+p_bytes WHERE operation='occupancy' AND window_start='epoch' AND ((scope_kind='actor' AND scope_id=r.actor_id) OR (scope_kind='assignment' AND scope_id=r.assignment_id));
 RETURN austa_authority.dto(r);
END;$f$;
CREATE FUNCTION public.austa_e2b_release_evidence(p_actor_id uuid,p_id uuid,p_generation bigint)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE r austa_authority.upload_reservations%ROWTYPE;
BEGIN
 PERFORM austa_authority.lock_upload(p_id); SELECT * INTO r FROM austa_authority.upload_reservations WHERE id=p_id;
 IF r.actor_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF r.state IN ('released','expired') THEN RETURN austa_authority.dto(r); END IF;
 IF EXISTS(SELECT 1 FROM public.service_orders o,LATERAL jsonb_array_elements(o.evidence_files) e WHERE o.id=r.order_id AND e->>'path'=r.path) THEN RETURN '{"code":"state_conflict"}'::jsonb; END IF;
 -- No caller-supplied proof flag: service_role cannot write the private proof.
 IF (r.state<>'reserved' AND NOT (r.state='reconciling' AND r.terminal_no_write_proof IS NOT NULL)) OR r.generation<>p_generation THEN RETURN '{"code":"state_conflict"}'::jsonb; END IF;
 UPDATE austa_authority.upload_reservations SET state=CASE WHEN expires_at<=clock_timestamp() THEN 'expired' ELSE 'released' END,generation=generation+1,released_at=clock_timestamp() WHERE id=p_id RETURNING * INTO r;
 UPDATE austa_authority.quota_counters SET reserved_count=reserved_count-1,reserved_bytes=reserved_bytes-r.reserved_bytes WHERE operation='occupancy' AND window_start='epoch' AND ((scope_kind='actor' AND scope_id=r.actor_id) OR (scope_kind='assignment' AND scope_id=r.assignment_id));
 RETURN austa_authority.dto(r);
END;$f$;
CREATE FUNCTION public.austa_e2b_get_upload(p_actor_id uuid,p_id uuid DEFAULT NULL,p_key text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE r austa_authority.upload_reservations%ROWTYPE;
BEGIN
 SELECT * INTO r FROM austa_authority.upload_reservations WHERE actor_id=p_actor_id AND ((p_id IS NOT NULL AND id=p_id) OR (p_id IS NULL AND idempotency_key::text=p_key));
 IF NOT FOUND THEN RETURN '{"code":"not_found"}'::jsonb; END IF;
 RETURN austa_authority.dto(r);
END;$f$;
CREATE FUNCTION public.austa_e2b_resolve_upload(p_actor_id uuid,p_id uuid,p_generation bigint)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE r austa_authority.upload_reservations%ROWTYPE;
BEGIN
 PERFORM austa_authority.lock_upload(p_id); SELECT * INTO r FROM austa_authority.upload_reservations WHERE id=p_id;
 IF r.actor_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF r.generation<>p_generation OR r.state NOT IN ('uploading','reconciling') THEN RETURN '{"code":"state_conflict"}'::jsonb; END IF;
 -- No boolean "proof" or administrative refund switch. Unknown always stays held.
 UPDATE austa_authority.upload_reservations SET state='reconciling',generation=generation+1,next_reconcile_at=greatest(next_reconcile_at,clock_timestamp()+interval '10 seconds') WHERE id=p_id RETURNING * INTO r;
 RETURN austa_authority.dto(r);
END;$f$;
CREATE FUNCTION public.austa_e2b_claim_reconciliation(p_id uuid DEFAULT NULL,p_generation bigint DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE result jsonb; ts timestamptz:=clock_timestamp();
BEGIN
 UPDATE austa_authority.control SET reconciler_seen_at=ts WHERE singleton;
 IF p_id IS NOT NULL THEN
  UPDATE austa_authority.upload_reservations SET lease_until=ts+interval '120 seconds' WHERE id=p_id AND generation=p_generation AND state='reconciling' AND lease_until>ts;
  RETURN jsonb_build_object('renewed',FOUND);
 END IF;
 -- Claim-only transaction; callers resolve business state in a later transaction.
 WITH candidates AS (SELECT id FROM austa_authority.upload_reservations WHERE state IN ('reserved','uploading','reconciling') AND next_reconcile_at<=ts AND (lease_until IS NULL OR lease_until<=ts) ORDER BY next_reconcile_at,id LIMIT 20 FOR UPDATE SKIP LOCKED),
 claimed AS (UPDATE austa_authority.upload_reservations r SET lease_until=ts+interval '120 seconds',generation=generation+1,attempts=attempts+1,
 next_reconcile_at=ts+CASE WHEN attempts=0 THEN interval '10 seconds' WHEN attempts=1 THEN interval '30 seconds' WHEN attempts=2 THEN interval '2 minutes' WHEN attempts=3 THEN interval '5 minutes' ELSE interval '15 minutes' END*(0.9+random()*0.2),
 alerted_at=CASE WHEN created_at<=ts-interval '15 minutes' THEN coalesce(alerted_at,ts) ELSE alerted_at END
 FROM candidates c WHERE r.id=c.id RETURNING r.*)
 SELECT coalesce(jsonb_agg(austa_authority.dto(claimed)||jsonb_build_object('alert',alerted_at IS NOT NULL)),'[]'::jsonb) INTO result FROM claimed;
 RETURN result;
END;$f$;
-- Controlled DB-observation seed. Never called by migration or HTTP handlers.
-- Run after all old instances stop writing; unknown references remain debt.
CREATE FUNCTION public.austa_e2b_validate_legacy() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE n bigint;
BEGIN
 IF (SELECT enabled FROM austa_authority.control) THEN RAISE EXCEPTION 'Seed requires pre-cutover' USING ERRCODE='40001'; END IF;
 INSERT INTO austa_authority.legacy_evidence(order_id,path,stage)
 SELECT DISTINCT o.id,e->>'path',e->>'category' FROM public.service_orders o,
 LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.evidence_files)='array' THEN o.evidence_files ELSE '[]'::jsonb END) e
 WHERE e->>'category' IN ('before','after') AND nullif(e->>'path','') IS NOT NULL ON CONFLICT DO NOTHING;
 UPDATE austa_authority.legacy_evidence l SET assignment_id=a.id,bytes=(obj.metadata->>'size')::bigint,verified=true
 FROM public.service_orders o,public.service_order_assignments a,storage.objects obj
 WHERE l.order_id=o.id AND a.order_id=o.id AND obj.bucket_id='service-evidence' AND obj.name=l.path
 AND obj.metadata->>'size' ~ '^[0-9]{1,12}$' AND (obj.metadata->>'size')::bigint>0
 AND split_part(l.path,'/',1)=o.customer_id::text
 AND split_part(l.path,'/',2)=CASE WHEN nullif(btrim(o.client_order_id),'') IS NOT NULL THEN regexp_replace(btrim(o.client_order_id),'[^a-zA-Z0-9_-]','_','g') ELSE o.id::text END
 AND split_part(l.path,'/',3)=l.stage AND array_length(string_to_array(l.path,'/'),1)=4
 AND split_part(l.path,'/',4) ~ '^[0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(o.evidence_files) e WHERE e->>'path'=l.path AND e->>'assignment_id'=a.id::text AND e->>'category'=l.stage AND e->>'bucket'='service-evidence');
 UPDATE austa_authority.control SET legacy_validated=true WHERE singleton;
 SELECT count(*) INTO n FROM austa_authority.legacy_evidence WHERE NOT verified;
 RETURN jsonb_build_object('unknown_legacy_references',n);
END;$f$;
-- Exact public surface only; helpers are not service-role APIs.
DO $security$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='austa_authority' OR (n.nspname='public' AND p.proname LIKE 'austa_e2b_%') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'austa_e2b_%' LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END;$security$;
COMMIT;
