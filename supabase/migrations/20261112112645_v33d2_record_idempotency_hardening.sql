-- Depends on reviewed 20261111235300_v33d2_personal_vehicle_history.sql.
-- TEST/REVIEW ONLY. Production application requires separate owner authorization.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.vehicle_service_records') IS NULL OR to_regclass('public.vehicles') IS NULL THEN RAISE EXCEPTION 'Reviewed Phase 2 schema required'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.vehicle_service_records'::regclass) THEN RAISE EXCEPTION 'Service record RLS must remain enabled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.vehicles'::regclass AND tgname='v33d2_vehicle_guard' AND NOT tgisinternal) OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.vehicle_service_records'::regclass AND tgname='v33d2_record_guard' AND NOT tgisinternal) THEN RAISE EXCEPTION 'Reviewed ownership/provenance guards required'; END IF;
END $$;
-- Private request ledger, not a second vehicle ownership/history model.
CREATE TABLE austa_private.vehicle_record_requests (
 owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 payload_hash bytea NOT NULL CHECK(octet_length(payload_hash)=32),
 record_id uuid REFERENCES public.vehicle_service_records(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,request_id)
);
CREATE INDEX vehicle_record_requests_record ON austa_private.vehicle_record_requests(record_id);
ALTER TABLE austa_private.vehicle_record_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON austa_private.vehicle_record_requests FROM PUBLIC,anon,authenticated;
-- Narrow definer boundary is necessary: browser roles cannot write the private ledger
-- or create records directly. Identity is derived from auth.uid(), never JSON/user metadata.
CREATE FUNCTION public.create_vehicle_service_record(p_request_id uuid,p_vehicle_id uuid,p_record jsonb)
RETURNS SETOF public.vehicle_service_records
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 actor uuid:=auth.uid(); v public.vehicle_service_records; canonical jsonb; fingerprint bytea;
 prior austa_private.vehicle_record_requests; created public.vehicle_service_records;
BEGIN
 IF actor IS NULL OR p_request_id IS NULL OR p_vehicle_id IS NULL THEN RAISE EXCEPTION 'Record unavailable' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_record) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_record) k WHERE k NOT IN ('service_date','mileage_km','category','work_performed','parts_replaced','cost_amount','currency','notes','next_service_date','next_service_mileage_km')) THEN RAISE EXCEPTION 'Invalid record fields' USING ERRCODE='22023'; END IF;
 -- Validate/normalize typed payload before comparing it. Existing constraints/triggers
 -- remain the authority for date, mileage, provenance, lengths and categories.
 v:=jsonb_populate_record(NULL::public.vehicle_service_records,p_record);
 v.parts_replaced:=coalesce(v.parts_replaced,''); v.notes:=coalesce(v.notes,''); v.currency:=coalesce(v.currency,'AZN');
 IF p_record->>'cost_amount' IS NOT NULL AND (p_record->>'cost_amount')::numeric<>v.cost_amount THEN RAISE EXCEPTION 'Cost requires at most two decimal places' USING ERRCODE='22023'; END IF;
 canonical:=jsonb_build_object('vehicle_id',p_vehicle_id,'service_date',v.service_date,'mileage_km',v.mileage_km,'category',v.category,'work_performed',v.work_performed,'parts_replaced',v.parts_replaced,'cost_amount',v.cost_amount,'currency',v.currency,'notes',v.notes,'next_service_date',v.next_service_date,'next_service_mileage_km',v.next_service_mileage_km);
 fingerprint:=sha256(convert_to(canonical::text,'UTF8'));
 -- Hash collisions only serialize unrelated requests; they cannot merge identities.
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_request_id::text,0));
 PERFORM 1 FROM public.vehicles WHERE id=p_vehicle_id AND user_id=actor FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Record unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO prior FROM austa_private.vehicle_record_requests WHERE owner_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF prior.payload_hash IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_CONFLICT' USING ERRCODE='PT409'; END IF;
  IF prior.record_id IS NULL THEN RAISE EXCEPTION 'IDEMPOTENT_RESULT_DELETED' USING ERRCODE='PT410'; END IF;
  RETURN QUERY SELECT r.* FROM public.vehicle_service_records r JOIN public.vehicles owned ON owned.id=r.vehicle_id WHERE r.id=prior.record_id AND owned.user_id=actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'IDEMPOTENT_RESULT_DELETED' USING ERRCODE='PT410'; END IF;
  RETURN;
 END IF;
 INSERT INTO public.vehicle_service_records(vehicle_id,service_date,mileage_km,category,work_performed,parts_replaced,cost_amount,currency,notes,next_service_date,next_service_mileage_km)
 VALUES(p_vehicle_id,v.service_date,v.mileage_km,v.category,v.work_performed,v.parts_replaced,v.cost_amount,v.currency,v.notes,v.next_service_date,v.next_service_mileage_km) RETURNING * INTO created;
 INSERT INTO austa_private.vehicle_record_requests(owner_id,request_id,payload_hash,record_id) VALUES(actor,p_request_id,fingerprint,created.id);
 RETURN NEXT created;
END $$;
ALTER FUNCTION public.create_vehicle_service_record(uuid,uuid,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_vehicle_service_record(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_vehicle_service_record(uuid,uuid,jsonb) TO authenticated;
-- Close legacy direct INSERT bypass; retain owner-scoped SELECT/UPDATE/DELETE.
REVOKE INSERT ON public.vehicle_service_records FROM authenticated;
REVOKE INSERT(vehicle_id,service_date,mileage_km,category,work_performed,parts_replaced,cost_amount,currency,notes,next_service_date,next_service_mileage_km) ON public.vehicle_service_records FROM authenticated;
COMMIT;
