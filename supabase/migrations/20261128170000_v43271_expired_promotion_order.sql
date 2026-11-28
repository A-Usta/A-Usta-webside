-- V4.3.27.1 follow-up: expired promotions return to publication-time order.
BEGIN;

-- Ordinary listings use publication time after any promotion expires.
CREATE OR REPLACE FUNCTION public.austa_listing_effective_sort_at(
  p_type text,p_started_at timestamptz,p_until timestamptz,p_boosted_at timestamptz,published_at timestamptz,created_at timestamptz
) RETURNS timestamptz
LANGUAGE sql STABLE PARALLEL SAFE SET search_path=''
AS $$
  SELECT CASE
    WHEN p_type IN ('premium','vip','top','standard')
      AND p_started_at<=statement_timestamp() AND p_until>statement_timestamp()
    THEN coalesce(p_boosted_at,p_started_at,published_at,created_at)
    ELSE coalesce(published_at,created_at)
  END
$$;
REVOKE ALL ON FUNCTION public.austa_listing_effective_sort_at(text,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.austa_listing_effective_sort_at(text,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz) TO anon,authenticated;

CREATE OR REPLACE VIEW public.austa_public_listing_feed
WITH (security_barrier=true, security_invoker=true) AS
SELECT
  'vehicle'::text AS source,
  CASE WHEN l.listing_type='rent' THEN 'rent' ELSE 'cars' END::text AS category,
  l.id,l.owner_id,l.status,l.created_at,l.published_at,l.updated_at,l.expires_at,
  l.promotion_type,l.promotion_started_at,l.promotion_until,l.last_boosted_at,
  CASE
    WHEN l.promotion_type='premium' AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() THEN 0
    WHEN l.promotion_type='vip' AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() THEN 1
    WHEN l.promotion_type IN ('top','standard') AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() AND l.last_boosted_at IS NOT NULL THEN 2
    ELSE 3
  END::integer AS sort_bucket,
  public.austa_listing_effective_sort_at(l.promotion_type,l.promotion_started_at,l.promotion_until,l.last_boosted_at,l.published_at,l.created_at) AS sort_at,
  jsonb_strip_nulls(jsonb_build_object(
    'id',l.id,'owner_id',l.owner_id,'listing_type',l.listing_type,'status',l.status,
    'brand',l.brand,'model',l.model,'year',l.year,'mileage',l.mileage,'body_type',l.body_type,
    'fuel_type',l.fuel_type,'transmission',l.transmission,'engine',l.engine,'color',l.color,
    'price',l.price,'daily_price',l.daily_price,'deposit',l.deposit,'currency',l.currency,
    'region',l.region,'district',l.district,'description',l.description,'phone',l.phone,
    'contact_name',l.contact_name,'vin_available',nullif(l.vin,'') IS NOT NULL,'has_video',l.has_video,
    'promotion_type',l.promotion_type,'promotion_started_at',l.promotion_started_at,
    'promotion_until',l.promotion_until,'last_boosted_at',l.last_boosted_at,
    'created_at',l.created_at,'updated_at',l.updated_at,'published_at',l.published_at,
    'expires_at',l.expires_at,'engine_volume',l.engine_volume,'horsepower',l.horsepower,
    'drivetrain',l.drivetrain,'vehicle_condition',l.vehicle_condition,'seats',l.seats,
    'damage_condition',l.damage_condition,'market',l.market,'barter_available',l.barter_available,
    'credit_available',l.credit_available,'seller_profile_id',l.seller_profile_id,
    'rental_type',l.rental_type,'details',public.austa_public_listing_details(l.details)
  )) AS payload
FROM public.vehicle_listings l
WHERE l.status='active' AND l.expires_at>statement_timestamp()

UNION ALL

SELECT
  'marketplace'::text,l.category,l.id,l.owner_id,l.status,l.created_at,l.published_at,l.updated_at,l.expires_at,
  l.promotion_type,l.promotion_started_at,l.promotion_until,l.last_boosted_at,
  CASE
    WHEN l.promotion_type='premium' AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() THEN 0
    WHEN l.promotion_type='vip' AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() THEN 1
    WHEN l.promotion_type IN ('top','standard') AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() AND l.last_boosted_at IS NOT NULL THEN 2
    ELSE 3
  END::integer,
  public.austa_listing_effective_sort_at(l.promotion_type,l.promotion_started_at,l.promotion_until,l.last_boosted_at,l.published_at,l.created_at),
  jsonb_strip_nulls(jsonb_build_object(
    'id',l.id,'owner_id',l.owner_id,'category',l.category,'status',l.status,
    'title',l.title,'description',l.description,'price',l.price,'currency',l.currency,
    'brand',l.brand,'model',l.model,'year',l.year,'condition',l.condition,
    'region',l.region,'district',l.district,'phone',l.phone,'has_video',l.has_video,
    'promotion_type',l.promotion_type,'promotion_started_at',l.promotion_started_at,
    'promotion_until',l.promotion_until,'last_boosted_at',l.last_boosted_at,
    'created_at',l.created_at,'updated_at',l.updated_at,'published_at',l.published_at,
    'expires_at',l.expires_at,'seller_profile_id',l.seller_profile_id,
    'details',public.austa_public_listing_details(l.details)
  ))
FROM public.marketplace_listings l
WHERE l.status='active' AND l.expires_at>statement_timestamp()

UNION ALL

SELECT
  'auto_dealer'::text,'dealer'::text,l.id,l.owner_id,l.status,l.created_at,l.published_at,l.updated_at,l.expires_at,
  l.promotion_type,l.promotion_started_at,l.promotion_until,l.last_boosted_at,
  CASE
    WHEN l.promotion_type='premium' AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() THEN 0
    WHEN l.promotion_type='vip' AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() THEN 1
    WHEN l.promotion_type IN ('top','standard') AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() AND l.last_boosted_at IS NOT NULL THEN 2
    ELSE 3
  END::integer,
  public.austa_listing_effective_sort_at(l.promotion_type,l.promotion_started_at,l.promotion_until,l.last_boosted_at,l.published_at,l.created_at),
  jsonb_strip_nulls(jsonb_build_object(
    'id',l.id,'owner_id',l.owner_id,'status',l.status,'dealer_name',l.dealer_name,
    'contact_name',l.contact_name,'phone',l.phone,'message_contact',l.message_contact,
    'region',l.region,'district',l.district,'working_hours',l.working_hours,'brands',l.brands,
    'vehicle_condition',l.vehicle_condition,'credit_available',l.credit_available,
    'leasing_available',l.leasing_available,'barter_available',l.barter_available,
    'delivery_available',l.delivery_available,'about',l.about,'details',public.austa_public_listing_details(l.details),
    'promotion_type',l.promotion_type,'promotion_started_at',l.promotion_started_at,
    'promotion_until',l.promotion_until,'last_boosted_at',l.last_boosted_at,
    'created_at',l.created_at,'updated_at',l.updated_at,'published_at',l.published_at,
    'expires_at',l.expires_at,'seller_profile_id',l.seller_profile_id
  ))
FROM public.auto_dealer_listings l
WHERE l.status='active' AND l.expires_at>statement_timestamp()

UNION ALL

SELECT
  'service_provider'::text,
  CASE WHEN p.provider_type='usta' THEN 'usta' ELSE coalesce(p.details->>'service_category','service') END::text,
  p.id,p.owner_id,p.status,p.created_at,p.published_at,p.updated_at,
  coalesce(p.published_at,p.created_at)+interval '30 days',
  p.promotion_type,p.promotion_started_at,p.promotion_until,p.last_boosted_at,
  CASE
    WHEN p.promotion_type='premium' AND p.promotion_started_at<=statement_timestamp() AND p.promotion_until>statement_timestamp() THEN 0
    WHEN p.promotion_type='vip' AND p.promotion_started_at<=statement_timestamp() AND p.promotion_until>statement_timestamp() THEN 1
    WHEN p.promotion_type IN ('top','standard') AND p.promotion_started_at<=statement_timestamp() AND p.promotion_until>statement_timestamp() AND p.last_boosted_at IS NOT NULL THEN 2
    ELSE 3
  END::integer,
  public.austa_listing_effective_sort_at(p.promotion_type,p.promotion_started_at,p.promotion_until,p.last_boosted_at,p.published_at,p.created_at),
  jsonb_strip_nulls(jsonb_build_object(
    'id',p.id,'owner_id',p.owner_id,'provider_type',p.provider_type,'status',p.status,
    'title',p.title,'name',p.name,'phone',p.phone,'message_contact',p.message_contact,
    'specialty',p.specialty,'services',p.services,'about',p.about,'experience',p.experience,
    'working_hours',p.working_hours,'region',p.region,'district',p.district,
    'rating',p.rating,'reviews_count',p.reviews_count,'promotion_type',p.promotion_type,
    'promotion_started_at',p.promotion_started_at,'promotion_until',p.promotion_until,
    'last_boosted_at',p.last_boosted_at,'created_at',p.created_at,'updated_at',p.updated_at,
    'published_at',p.published_at,'details',public.austa_public_listing_details(p.details),
    'seller_profile_id',p.seller_profile_id
  ))
FROM public.public_service_provider_listings p
WHERE p.status='active'
  AND coalesce(p.published_at,p.created_at)+interval '30 days'>statement_timestamp()
  AND public.v355_provider_public_visible(p.id);

REVOKE ALL ON public.austa_public_listing_feed FROM PUBLIC;
GRANT SELECT ON public.austa_public_listing_feed TO anon,authenticated;


COMMIT;
