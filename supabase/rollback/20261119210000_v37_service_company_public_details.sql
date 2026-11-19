-- Manual rollback for V3.7 public detail projection.
-- Restores the reviewed V3.5.5 public allowlist. No data or RLS policies are changed.
BEGIN;
CREATE OR REPLACE VIEW public.public_service_provider_listings WITH(security_barrier=true,security_invoker=false) AS
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
COMMENT ON VIEW public.public_service_provider_listings IS 'V3.5.5 privacy-safe public provider listing projection.';
COMMIT;
