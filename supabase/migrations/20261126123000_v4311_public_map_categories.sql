-- Expand only accepted public-discovery taxonomy values; the RPC still returns
-- consented, active, verified public business DTOs and retains its existing grants.
CREATE OR REPLACE FUNCTION public.discover_public_providers(
 south double precision, west double precision, north double precision, east double precision,
 query text DEFAULT '', area text DEFAULT '', countrywide boolean DEFAULT false,
 result_offset integer DEFAULT 0, category text DEFAULT 'all'
)
RETURNS TABLE(listing_id uuid, provider_type text, public_name text, public_area text,
 public_address text, public_phone text, latitude double precision, longitude double precision,
 location_kind text, services text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' SET statement_timeout TO '1000ms'
AS $function$
BEGIN
 IF countrywide IS NULL OR result_offset IS NULL OR result_offset NOT IN (0,40,80) OR category IS NULL OR category NOT IN (
  'all','usta','service','repair','wash','tyre','alignment','charging','fuel',
  'auto_service','vulcanization','car_wash','parts_shop','auto_electrician',
  'oil_change','diagnostics','inspection','towing','parking','other_auto'
 ) OR (countrywide AND length(trim(COALESCE(query,'')))<2) THEN RAISE EXCEPTION 'Invalid map scope' USING ERRCODE='22023'; END IF;
 IF south IS NULL OR west IS NULL OR north IS NULL OR east IS NULL OR NOT(
  south BETWEEN -90 AND 90 AND north BETWEEN -90 AND 90 AND west BETWEEN -180 AND 180 AND east BETWEEN -180 AND 180
  AND north>south AND east>west AND (countrywide OR (north-south<=0.5 AND east-west<=0.5))
 ) OR length(COALESCE(query,''))>120 OR length(COALESCE(area,''))>100 THEN RAISE EXCEPTION 'Invalid map query' USING ERRCODE='22023'; END IF;
 RETURN QUERY SELECT m.listing_id,l.provider_type,m.public_name,m.public_area,m.public_address,m.public_phone,
  m.latitude,m.longitude,m.location_kind,m.services
 FROM public.provider_map_publications m
 JOIN public.service_provider_listings l ON l.id=m.listing_id AND l.owner_id=m.consenting_owner
 JOIN public.seller_profiles sp ON sp.id=l.seller_profile_id AND sp.owner_id=l.owner_id AND sp.business_type=l.provider_type
 JOIN public.profiles p ON p.id=l.owner_id
 WHERE m.enabled AND m.consent AND m.consent_at IS NOT NULL AND m.consent_version='v355-1'
  AND l.status='active' AND sp.status='active' AND sp.verification_status='verified' AND p.is_active
  AND ((l.provider_type='usta' AND p.role='mechanic') OR (l.provider_type='service' AND p.role='shop'))
  AND (COALESCE(query,'')='' OR position(lower(query) IN lower(m.public_name))>0)
  AND (category='all' OR l.provider_type=category OR category=ANY(m.services))
  AND ((countrywide AND (m.location_kind='service_area' OR (m.latitude BETWEEN 38.3 AND 41.95 AND m.longitude BETWEEN 44.7 AND 50.8)))
   OR (NOT countrywide AND ((m.location_kind='business' AND m.latitude BETWEEN south AND north AND m.longitude BETWEEN west AND east)
   OR (m.location_kind='service_area' AND length(trim(COALESCE(area,'')))>=2 AND lower(m.public_area)=lower(trim(area))))))
 ORDER BY m.listing_id LIMIT 40 OFFSET result_offset;
END $function$;
