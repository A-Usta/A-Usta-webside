-- V3.3D.2 Phase 2. REVIEW ONLY: never run against hosted projects without approval.
BEGIN;
-- Fail closed on an unexpected baseline; never replace an existing ownership model.
DO $$ BEGIN
 IF to_regclass('public.vehicles') IS NULL THEN RAISE EXCEPTION 'Canonical vehicles table required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.vehicles'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'vehicles RLS must already be enabled'; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS austa_private;
REVOKE ALL ON SCHEMA austa_private FROM PUBLIC;
GRANT USAGE ON SCHEMA austa_private TO authenticated;
CREATE FUNCTION austa_private.guard_personal_vehicle() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id,NEW.user_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.user_id,OLD.created_at) THEN RAISE EXCEPTION 'Vehicle identity is immutable' USING ERRCODE='42501'; END IF;
 IF char_length(trim(NEW.make)) NOT BETWEEN 1 AND 100 OR char_length(trim(NEW.model)) NOT BETWEEN 1 AND 100
 OR char_length(coalesce(NEW.plate_number,''))>30 OR char_length(coalesce(NEW.vin,''))>17
 OR char_length(coalesce(NEW.engine,''))>100 OR char_length(coalesce(NEW.fuel_type,''))>100 OR char_length(coalesce(NEW.transmission,''))>100 OR char_length(coalesce(NEW.color,''))>100 OR char_length(coalesce(NEW.notes,''))>4000 THEN RAISE EXCEPTION 'Invalid vehicle fields' USING ERRCODE='23514'; END IF;
 IF NEW.vin IS NOT NULL AND NEW.vin<>'' AND NEW.vin !~ '^[A-HJ-NPR-Z0-9]{17}$' THEN RAISE EXCEPTION 'Invalid VIN' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' AND (NEW.year IS NULL OR trim(coalesce(NEW.plate_number,''))='') THEN RAISE EXCEPTION 'Year and plate required for new vehicles' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN NEW.created_at:=now(); END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION austa_private.guard_personal_vehicle() FROM PUBLIC;
CREATE TRIGGER v33d2_vehicle_guard BEFORE INSERT OR UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION austa_private.guard_personal_vehicle();
-- Existing owner RLS is kept intact; additional restrictive guards also protect against future permissive policies.
CREATE POLICY v33d2_vehicle_owner_guard ON public.vehicles AS RESTRICTIVE FOR ALL TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
GRANT SELECT,DELETE ON public.vehicles TO authenticated;
GRANT INSERT(user_id,make,model,year,plate_number,vin,mileage,engine,fuel_type,transmission,color,notes,is_active) ON public.vehicles TO authenticated;
GRANT UPDATE(make,model,year,plate_number,vin,mileage,engine,fuel_type,transmission,color,notes,is_active) ON public.vehicles TO authenticated;
CREATE INDEX v33d2_vehicle_owner_active ON public.vehicles(user_id,is_active,created_at DESC,id);
CREATE TABLE public.vehicle_service_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
 service_date date NOT NULL,
 mileage_km integer NOT NULL CHECK(mileage_km>=0),
 category text NOT NULL CHECK(category IN ('oil_filters','tires_wheels','brakes','engine','transmission','battery_electrical','suspension','cooling','inspection','other')),
 work_performed text NOT NULL CHECK(char_length(trim(work_performed)) BETWEEN 1 AND 4000),
 parts_replaced text NOT NULL DEFAULT '' CHECK(char_length(parts_replaced)<=4000),
 cost_amount numeric(12,2) CHECK(cost_amount>=0),
 currency text NOT NULL DEFAULT 'AZN' CHECK(currency IN ('AZN','USD','EUR')),
 notes text NOT NULL DEFAULT '' CHECK(char_length(notes)<=4000),
 next_service_date date CHECK(next_service_date>=service_date),
 next_service_mileage_km integer CHECK(next_service_mileage_km>=mileage_km),
 source text NOT NULL DEFAULT 'user_entered' CHECK(source='user_entered'),
 confirmed_by uuid CHECK(confirmed_by IS NULL),
 confirmed_at timestamptz CHECK(confirmed_at IS NULL),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX v33d2_record_timeline ON public.vehicle_service_records(vehicle_id,service_date DESC,created_at DESC,id DESC);
ALTER TABLE public.vehicle_service_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY v33d2_records_owner ON public.vehicle_service_records FOR ALL TO authenticated
 USING(EXISTS(SELECT 1 FROM public.vehicles v WHERE v.id=vehicle_id AND v.user_id=(SELECT auth.uid())))
 WITH CHECK(EXISTS(SELECT 1 FROM public.vehicles v WHERE v.id=vehicle_id AND v.user_id=(SELECT auth.uid())));
REVOKE ALL ON public.vehicle_service_records FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.vehicle_service_records TO authenticated;
GRANT INSERT(vehicle_id,service_date,mileage_km,category,work_performed,parts_replaced,cost_amount,currency,notes,next_service_date,next_service_mileage_km) ON public.vehicle_service_records TO authenticated;
GRANT UPDATE(service_date,mileage_km,category,work_performed,parts_replaced,cost_amount,currency,notes,next_service_date,next_service_mileage_km) ON public.vehicle_service_records TO authenticated;
CREATE FUNCTION austa_private.guard_service_record() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id,NEW.vehicle_id,NEW.source,NEW.confirmed_by,NEW.confirmed_at,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.vehicle_id,OLD.source,OLD.confirmed_by,OLD.confirmed_at,OLD.created_at) THEN RAISE EXCEPTION 'Record provenance is immutable' USING ERRCODE='42501'; END IF;
 IF NEW.service_date>(current_timestamp AT TIME ZONE 'Asia/Baku')::date THEN RAISE EXCEPTION 'Service date cannot be in future' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN NEW.created_at:=now(); END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION austa_private.guard_service_record() FROM PUBLIC;
CREATE TRIGGER v33d2_record_guard BEFORE INSERT OR UPDATE ON public.vehicle_service_records FOR EACH ROW EXECUTE FUNCTION austa_private.guard_service_record();
CREATE TABLE public.vehicle_service_record_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 record_id uuid NOT NULL REFERENCES public.vehicle_service_records(id) ON DELETE RESTRICT,
 vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
 owner_id uuid NOT NULL,
 bucket_id text NOT NULL DEFAULT 'vehicle-service-evidence' CHECK(bucket_id='vehicle-service-evidence'),
 storage_path text NOT NULL UNIQUE,
 original_name text NOT NULL CHECK(char_length(original_name) BETWEEN 1 AND 200),
 mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp','application/pdf')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','deleting')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX v33d2_attachment_record ON public.vehicle_service_record_attachments(record_id,created_at,id);
ALTER TABLE public.vehicle_service_record_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY v33d2_attachment_read ON public.vehicle_service_record_attachments FOR SELECT TO authenticated USING(owner_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.vehicles v WHERE v.id=vehicle_id AND v.user_id=(SELECT auth.uid())));
CREATE POLICY v33d2_attachment_insert ON public.vehicle_service_record_attachments FOR INSERT TO authenticated WITH CHECK(owner_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.vehicle_service_records r JOIN public.vehicles v ON v.id=r.vehicle_id WHERE r.id=record_id AND r.vehicle_id=vehicle_service_record_attachments.vehicle_id AND v.user_id=(SELECT auth.uid())));
CREATE POLICY v33d2_attachment_update ON public.vehicle_service_record_attachments FOR UPDATE TO authenticated USING(owner_id=(SELECT auth.uid())) WITH CHECK(owner_id=(SELECT auth.uid()));
CREATE POLICY v33d2_attachment_delete ON public.vehicle_service_record_attachments FOR DELETE TO authenticated USING(owner_id=(SELECT auth.uid()) AND state='deleting' AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=vehicle_service_record_attachments.bucket_id AND o.name=storage_path));
REVOKE ALL ON public.vehicle_service_record_attachments FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.vehicle_service_record_attachments TO authenticated;
GRANT INSERT(record_id,original_name,mime_type,size_bytes) ON public.vehicle_service_record_attachments TO authenticated;
GRANT UPDATE(state) ON public.vehicle_service_record_attachments TO authenticated;
CREATE FUNCTION austa_private.guard_service_attachment() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE parent_vehicle uuid; extension text;
BEGIN
 IF TG_OP='INSERT' THEN
  -- Row lock serializes attachment reservations for the same record (maximum five, including pending cleanup).
  SELECT r.vehicle_id INTO parent_vehicle FROM public.vehicle_service_records r JOIN public.vehicles v ON v.id=r.vehicle_id WHERE r.id=NEW.record_id AND v.user_id=auth.uid() FOR UPDATE OF r;
  IF parent_vehicle IS NULL THEN RAISE EXCEPTION 'Record unavailable' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM public.vehicle_service_record_attachments a WHERE a.record_id=NEW.record_id)>=5 THEN RAISE EXCEPTION 'Maximum five attachments' USING ERRCODE='23514'; END IF;
  extension:=CASE NEW.mime_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' WHEN 'application/pdf' THEN 'pdf' ELSE NULL END;
  IF extension IS NULL THEN RAISE EXCEPTION 'Unsupported attachment type' USING ERRCODE='23514'; END IF;
  NEW.owner_id:=auth.uid(); NEW.vehicle_id:=parent_vehicle; NEW.state:='pending'; NEW.created_at:=now();
  NEW.storage_path:=NEW.owner_id::text||'/'||NEW.vehicle_id::text||'/'||NEW.record_id::text||'/'||NEW.id::text||'.'||extension;
 ELSE
  IF (NEW.id,NEW.record_id,NEW.vehicle_id,NEW.owner_id,NEW.bucket_id,NEW.storage_path,NEW.original_name,NEW.mime_type,NEW.size_bytes,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.record_id,OLD.vehicle_id,OLD.owner_id,OLD.bucket_id,OLD.storage_path,OLD.original_name,OLD.mime_type,OLD.size_bytes,OLD.created_at) THEN RAISE EXCEPTION 'Attachment identity immutable' USING ERRCODE='42501'; END IF;
  IF NOT (NEW.state=OLD.state OR NEW.state='deleting' OR (OLD.state='pending' AND NEW.state='ready')) THEN RAISE EXCEPTION 'Invalid attachment transition' USING ERRCODE='23514'; END IF;
  IF NEW.state='ready' AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=NEW.bucket_id AND o.name=NEW.storage_path AND (o.metadata->>'size')::bigint=NEW.size_bytes AND o.metadata->>'mimetype'=NEW.mime_type) THEN RAISE EXCEPTION 'Uploaded object metadata mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION austa_private.guard_service_attachment() FROM PUBLIC;
CREATE TRIGGER v33d2_attachment_guard BEFORE INSERT OR UPDATE ON public.vehicle_service_record_attachments FOR EACH ROW EXECUTE FUNCTION austa_private.guard_service_attachment();
-- Private bucket only. Existing conflicting bucket configuration aborts the migration.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='vehicle-service-evidence') THEN RAISE EXCEPTION 'Evidence bucket already exists; inspect before migration'; END IF; END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('vehicle-service-evidence','vehicle-service-evidence',false,10485760,ARRAY['image/jpeg','image/png','image/webp','application/pdf']);
CREATE FUNCTION austa_private.can_access_service_file(object_path text, operation text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.vehicle_service_record_attachments a JOIN public.vehicle_service_records r ON r.id=a.record_id AND r.vehicle_id=a.vehicle_id JOIN public.vehicles v ON v.id=r.vehicle_id
 WHERE a.storage_path=object_path AND a.owner_id=(SELECT auth.uid()) AND v.user_id=(SELECT auth.uid())
 AND object_path=a.owner_id::text||'/'||a.vehicle_id::text||'/'||a.record_id::text||'/'||a.id::text||CASE a.mime_type WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' WHEN 'image/webp' THEN '.webp' WHEN 'application/pdf' THEN '.pdf' END
 AND (operation='read' OR (operation='insert' AND a.state='pending') OR (operation='delete' AND a.state='deleting')))
$$;
REVOKE ALL ON FUNCTION austa_private.can_access_service_file(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION austa_private.can_access_service_file(text,text) TO authenticated;
CREATE POLICY v33d2_service_file_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='vehicle-service-evidence' AND austa_private.can_access_service_file(name,'read'));
CREATE POLICY v33d2_service_file_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='vehicle-service-evidence' AND austa_private.can_access_service_file(name,'insert'));
CREATE POLICY v33d2_service_file_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='vehicle-service-evidence' AND austa_private.can_access_service_file(name,'delete'));
-- No UPDATE/upsert policy: object paths are immutable. Restrictive policies prevent any existing broad policy from opening this bucket.
CREATE POLICY v33d2_service_file_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'vehicle-service-evidence' OR austa_private.can_access_service_file(name,'read'));
CREATE POLICY v33d2_service_file_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'vehicle-service-evidence' OR austa_private.can_access_service_file(name,'insert'));
CREATE POLICY v33d2_service_file_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'vehicle-service-evidence' OR austa_private.can_access_service_file(name,'delete'));
CREATE POLICY v33d2_service_file_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'vehicle-service-evidence') WITH CHECK(bucket_id<>'vehicle-service-evidence');
CREATE POLICY v33d2_service_file_no_anon ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'vehicle-service-evidence') WITH CHECK(bucket_id<>'vehicle-service-evidence');
COMMIT;
