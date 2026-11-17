-- PROPOSAL ONLY. Requires reviewed V355 map publication migration first.
-- No production or remote execution is authorized by this file.
BEGIN;
DO $$
BEGIN
 IF to_regclass('public.provider_map_publications') IS NULL OR to_regclass('public.public_service_provider_listings') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('v355_provider_public_visible','v355_provider_media_visible')) THEN RAISE EXCEPTION 'Provider privacy dependency/object conflict'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('public.profiles'::regclass,'public.seller_profiles'::regclass,'public.service_provider_listings'::regclass,'public.service_provider_media'::regclass,'public.provider_map_publications'::regclass) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'Provider privacy requires existing RLS'; END IF;
 IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.service_provider_listings'::regclass AND polcmd='r')<>2 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.service_provider_listings'::regclass AND polcmd IN ('r','*') AND polname NOT IN ('service_provider_active_public_select','service_provider_listings_public_select')) THEN RAISE EXCEPTION 'Inspect provider SELECT policy drift'; END IF;
 IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.service_provider_media'::regclass AND polcmd='r')<>1 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.service_provider_media'::regclass AND polcmd IN ('r','*') AND polname<>'service_provider_media_public_select') THEN RAISE EXCEPTION 'Inspect provider media SELECT policy drift'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='provider-media' AND NOT public) OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='storage.objects'::regclass AND polname='austa_provider_media_select_active_or_own' AND polcmd='r') THEN RAISE EXCEPTION 'Inspect private provider Storage dependency'; END IF;
END $$;
-- Public eligibility returns only a boolean, never private row content.
CREATE FUNCTION public.v355_provider_public_visible(p_listing_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.service_provider_listings l JOIN public.seller_profiles s ON s.id=l.seller_profile_id AND s.owner_id=l.owner_id AND s.business_type=l.provider_type JOIN public.profiles p ON p.id=l.owner_id WHERE l.id=p_listing_id AND l.status='active' AND s.status='active' AND s.verification_status='verified' AND p.is_active AND ((l.provider_type='usta' AND p.role='mechanic') OR (l.provider_type='service' AND p.role='shop')));
$$;
REVOKE ALL ON FUNCTION public.v355_provider_public_visible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v355_provider_public_visible(uuid) TO anon,authenticated;
-- Restrictive gate also defeats legacy/extra permissive SELECT policies.
CREATE POLICY v355_provider_raw_owner_gate ON public.service_provider_listings AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(owner_id=(SELECT auth.uid()));
-- Trusted-owner barrier view: explicit row visibility and column projection replace raw public reads.
-- Invoker mode cannot project private eligibility/consent while their tables stay owner-only.
CREATE VIEW public.public_service_provider_listings WITH(security_barrier=true,security_invoker=false) AS
SELECT l.id,
 CASE WHEN l.owner_id=auth.uid() THEN l.owner_id END AS owner_id,
 l.provider_type,l.status,l.title,l.name,
 CASE WHEN l.owner_id=auth.uid() THEN l.phone WHEN m.enabled AND m.consent AND m.consent_at IS NOT NULL THEN m.public_phone END AS phone,
 CASE WHEN l.owner_id=auth.uid() THEN l.message_contact END AS message_contact,
 l.specialty,l.services,l.about,l.experience,l.working_hours,
 CASE WHEN l.owner_id=auth.uid() THEN l.region WHEN m.enabled AND m.consent AND m.consent_at IS NOT NULL THEN m.public_area END AS region,
 CASE WHEN l.owner_id=auth.uid() THEN l.district END AS district,
 CASE WHEN l.owner_id=auth.uid() THEN l.address WHEN m.enabled AND m.consent AND m.consent_at IS NOT NULL AND m.location_kind='business' THEN m.public_address END AS address,
 CASE WHEN l.owner_id=auth.uid() THEN l.latitude WHEN m.enabled AND m.consent AND m.consent_at IS NOT NULL AND m.location_kind='business' THEN m.latitude END AS latitude,
 CASE WHEN l.owner_id=auth.uid() THEN l.longitude WHEN m.enabled AND m.consent AND m.consent_at IS NOT NULL AND m.location_kind='business' THEN m.longitude END AS longitude,
 l.rating,l.reviews_count,l.promotion_type,l.promotion_started_at,l.promotion_until,l.last_boosted_at,l.created_at,l.updated_at,l.published_at,
 CASE WHEN l.owner_id=auth.uid() THEN l.details ELSE jsonb_strip_nulls(jsonb_build_object('brands',CASE WHEN jsonb_typeof(l.details->'brands') IN ('string','number','boolean') THEN l.details->'brands' END,'price_policy',CASE WHEN jsonb_typeof(l.details->'price_policy') IN ('string','number','boolean') THEN l.details->'price_policy' END)) END AS details,
 l.seller_profile_id
FROM public.service_provider_listings l
LEFT JOIN public.provider_map_publications m ON m.listing_id=l.id AND m.consenting_owner=l.owner_id AND m.consent_version='v355-1'
WHERE l.owner_id=auth.uid() OR public.v355_provider_public_visible(l.id);
REVOKE ALL ON public.public_service_provider_listings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.public_service_provider_listings TO anon,authenticated;
-- Parent RLS is now owner-only. Media needs a narrow, explicit public eligibility path.
DROP POLICY service_provider_media_public_select ON public.service_provider_media;
CREATE FUNCTION public.v355_provider_media_visible(p_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_name !~ '[[:cntrl:]]' AND p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-][A-Za-z0-9._-]*$'
 AND EXISTS(SELECT 1 FROM public.service_provider_listings l WHERE l.id::text=split_part(p_name,'/',2) AND l.owner_id::text=split_part(p_name,'/',1) AND (l.owner_id=auth.uid() OR (public.v355_provider_public_visible(l.id) AND EXISTS(SELECT 1 FROM public.service_provider_media m WHERE m.listing_id=l.id AND m.owner_id=l.owner_id AND m.storage_path=p_name))));
$$;
REVOKE ALL ON FUNCTION public.v355_provider_media_visible(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v355_provider_media_visible(text) TO anon,authenticated;
CREATE POLICY v355_provider_media_read ON public.service_provider_media FOR SELECT TO anon,authenticated USING(owner_id=(SELECT auth.uid()) OR (listing_id::text=split_part(storage_path,'/',2) AND owner_id::text=split_part(storage_path,'/',1) AND public.v355_provider_media_visible(storage_path)));
ALTER POLICY service_provider_media_owner_update ON public.service_provider_media USING(owner_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.service_provider_listings l WHERE l.id=listing_id AND l.owner_id=(SELECT auth.uid()))) WITH CHECK(owner_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.service_provider_listings l WHERE l.id=listing_id AND l.owner_id=(SELECT auth.uid())));
ALTER POLICY austa_provider_media_select_active_or_own ON storage.objects USING(bucket_id='provider-media' AND public.v355_provider_media_visible(name));
CREATE POLICY v355_provider_storage_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(bucket_id<>'provider-media' OR public.v355_provider_media_visible(name));
COMMENT ON VIEW public.public_service_provider_listings IS 'V355 safe listing DTO; private fields owner-only; public location/contact only current consent, active verified eligibility; never raw private GPS';
COMMIT;
