-- PROPOSAL ONLY: separate owner authorization before any production application.
-- Never backfill GPS/contact/address from profiles or existing listing fields.
BEGIN;
DO $$ DECLARE r record; BEGIN
 IF to_regclass('public.provider_map_publications') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('discover_public_providers','v355_map_publication_guard')) THEN RAISE EXCEPTION 'V355 object conflict: inspect before applying'; END IF;
 FOR r IN SELECT * FROM (VALUES
 ('profiles','id','uuid'),('profiles','role','text'),('profiles','is_active','boolean'),
 ('seller_profiles','id','uuid'),('seller_profiles','owner_id','uuid'),('seller_profiles','business_type','text'),('seller_profiles','status','text'),('seller_profiles','verification_status','text'),
 ('service_provider_listings','id','uuid'),('service_provider_listings','owner_id','uuid'),('service_provider_listings','seller_profile_id','uuid'),('service_provider_listings','provider_type','text'),('service_provider_listings','status','text')
 ) AS required(table_name,column_name,column_type) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace AND c.relname=r.table_name AND c.relrowsecurity AND a.attname=r.column_name AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=r.column_type) THEN RAISE EXCEPTION 'V355 dependency mismatch: %.%',r.table_name,r.column_name; END IF;
 END LOOP;
END $$;
CREATE TABLE public.provider_map_publications(
 listing_id uuid PRIMARY KEY REFERENCES public.service_provider_listings(id) ON DELETE CASCADE,
 consenting_owner uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 enabled boolean NOT NULL DEFAULT false,
 public_name text NOT NULL CHECK(length(trim(public_name)) BETWEEN 2 AND 120),
 location_kind text NOT NULL CHECK(location_kind IN ('business','service_area')),
 public_area text NOT NULL CHECK(length(trim(public_area)) BETWEEN 2 AND 100),
 public_address text CHECK(length(public_address)<=200),
 public_phone text CHECK(public_phone IS NULL OR public_phone ~ '^[+0-9 ()-]{5,30}$'),
 latitude double precision,longitude double precision,
 services text[] NOT NULL CHECK(cardinality(services) BETWEEN 1 AND 8 AND services <@ ARRAY['repair','wash','tyre','alignment']::text[]),
 consent boolean NOT NULL DEFAULT false,
 consent_version text NOT NULL DEFAULT 'v355-1' CHECK(consent_version='v355-1'),
 consent_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT enabled OR consent),
 CHECK((location_kind='business' AND latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND public_address IS NOT NULL AND length(trim(public_address))>=2) OR (location_kind='service_area' AND latitude IS NULL AND longitude IS NULL AND public_address IS NULL))
);
ALTER TABLE public.provider_map_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_map_publications FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.provider_map_publications TO authenticated;
CREATE POLICY v355_map_owner ON public.provider_map_publications FOR ALL TO authenticated
 USING(consenting_owner=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.service_provider_listings l WHERE l.id=listing_id AND l.owner_id=(SELECT auth.uid())))
 WITH CHECK(consenting_owner=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.service_provider_listings l WHERE l.id=listing_id AND l.owner_id=(SELECT auth.uid())));
CREATE FUNCTION public.v355_map_publication_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.listing_id IS DISTINCT FROM OLD.listing_id OR NEW.consenting_owner IS DISTINCT FROM OLD.consenting_owner) THEN RAISE EXCEPTION 'Map identity is immutable'; END IF;
 NEW.updated_at=pg_catalog.now();NEW.consent_at=CASE WHEN NEW.enabled AND NEW.consent THEN pg_catalog.now() ELSE NULL END;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.v355_map_publication_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER v355_map_publication_guard BEFORE INSERT OR UPDATE ON public.provider_map_publications FOR EACH ROW EXECUTE FUNCTION public.v355_map_publication_guard();
CREATE INDEX v355_map_public_bounds ON public.provider_map_publications(latitude,longitude) WHERE enabled AND consent AND location_kind='business';
CREATE INDEX v355_map_public_area ON public.provider_map_publications(public_area) WHERE enabled AND consent AND location_kind='service_area';
-- Narrow read-only definer DTO: callers cannot read private profiles or opt-in rows.
CREATE FUNCTION public.discover_public_providers(south double precision,west double precision,north double precision,east double precision,query text DEFAULT '',area text DEFAULT '')
RETURNS TABLE(listing_id uuid,provider_type text,public_name text,public_area text,public_address text,public_phone text,latitude double precision,longitude double precision,location_kind text,services text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET statement_timeout='1000ms' AS $$
BEGIN
 IF south IS NULL OR west IS NULL OR north IS NULL OR east IS NULL OR NOT(south BETWEEN -90 AND 90 AND north BETWEEN -90 AND 90 AND west BETWEEN -180 AND 180 AND east BETWEEN -180 AND 180 AND north>south AND east>west AND north-south<=0.5 AND east-west<=0.5) OR length(COALESCE(query,''))>120 OR length(COALESCE(area,''))>100 THEN RAISE EXCEPTION 'Invalid map query' USING ERRCODE='22023'; END IF;
 RETURN QUERY SELECT m.listing_id,l.provider_type,m.public_name,m.public_area,m.public_address,m.public_phone,m.latitude,m.longitude,m.location_kind,m.services
 FROM public.provider_map_publications m
 JOIN public.service_provider_listings l ON l.id=m.listing_id AND l.owner_id=m.consenting_owner
 JOIN public.seller_profiles sp ON sp.id=l.seller_profile_id AND sp.owner_id=l.owner_id AND sp.business_type=l.provider_type
 JOIN public.profiles p ON p.id=l.owner_id
 WHERE m.enabled AND m.consent AND m.consent_at IS NOT NULL AND m.consent_version='v355-1'
 AND l.status='active' AND sp.status='active' AND sp.verification_status='verified' AND p.is_active
 AND ((l.provider_type='usta' AND p.role='mechanic') OR (l.provider_type='service' AND p.role='shop'))
 AND (COALESCE(query,'')='' OR position(lower(query) IN lower(m.public_name))>0)
 AND ((m.location_kind='business' AND m.latitude BETWEEN south AND north AND m.longitude BETWEEN west AND east)
 OR (m.location_kind='service_area' AND length(trim(COALESCE(area,'')))>=2 AND lower(m.public_area)=lower(trim(area))))
 ORDER BY m.listing_id LIMIT 40;
END $$;
REVOKE ALL ON FUNCTION public.discover_public_providers(double precision,double precision,double precision,double precision,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discover_public_providers(double precision,double precision,double precision,double precision,text,text) TO anon,authenticated;
COMMENT ON FUNCTION public.discover_public_providers(double precision,double precision,double precision,double precision,text,text) IS 'V355 opt-in public DTO only; never profiles GPS/contact; bounded; no automatic assignment';
COMMIT;
