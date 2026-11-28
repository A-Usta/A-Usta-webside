-- V4.3.22: shared server-side public listing page contract.
-- Reads the existing RLS-protected canonical feed and uses stable keyset paging.
BEGIN;

CREATE OR REPLACE FUNCTION public.austa_feed_filter_path(p_category text,p_key text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=''
AS $$
 SELECT CASE p_category
  WHEN 'cars' THEN CASE p_key WHEN 'brand' THEN 'brand' WHEN 'model' THEN 'model' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' WHEN 'year' THEN 'year' WHEN 'year_min' THEN 'year' WHEN 'year_max' THEN 'year' WHEN 'price_min' THEN 'price' WHEN 'price_max' THEN 'price' WHEN 'mileage' THEN 'mileage' WHEN 'mileage_min' THEN 'mileage' WHEN 'mileage_max' THEN 'mileage' WHEN 'engine_volume_min' THEN 'engine_volume' WHEN 'engine_volume_max' THEN 'engine_volume' WHEN 'horsepower_min' THEN 'horsepower' WHEN 'horsepower_max' THEN 'horsepower' WHEN 'condition' THEN 'condition' WHEN 'fuel_type' THEN 'details.fuel_type' WHEN 'transmission' THEN 'details.transmission' WHEN 'drivetrain' THEN 'details.drivetrain' WHEN 'body_type' THEN 'details.body_type' WHEN 'color' THEN 'details.color' WHEN 'vehicle_condition' THEN 'details.vehicle_condition' WHEN 'market' THEN 'details.market' WHEN 'credit_available' THEN 'details.credit_available' WHEN 'barter_available' THEN 'details.barter_available' ELSE NULL END
  WHEN 'rent' THEN CASE p_key WHEN 'brand' THEN 'brand' WHEN 'model' THEN 'model' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' WHEN 'year' THEN 'year' WHEN 'year_min' THEN 'year' WHEN 'year_max' THEN 'year' WHEN 'daily_price_min' THEN 'daily_price' WHEN 'daily_price_max' THEN 'daily_price' WHEN 'rental_type' THEN 'rental_type' WHEN 'fuel_type' THEN 'details.fuel_type' WHEN 'transmission' THEN 'details.transmission' WHEN 'body_type' THEN 'details.body_type' ELSE NULL END
  WHEN 'dealer' THEN CASE p_key WHEN 'dealer_name' THEN 'dealer_name' WHEN 'brands' THEN 'brands' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' WHEN 'vehicle_condition' THEN 'vehicle_condition' WHEN 'credit_available' THEN 'credit_available' WHEN 'leasing_available' THEN 'leasing_available' WHEN 'barter_available' THEN 'barter_available' WHEN 'delivery_available' THEN 'delivery_available' ELSE NULL END
  WHEN 'service' THEN CASE p_key WHEN 'specialty' THEN 'specialty' WHEN 'services' THEN 'services' WHEN 'brands' THEN 'details.brands' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' ELSE NULL END
  WHEN 'usta' THEN CASE p_key WHEN 'specialty' THEN 'specialty' WHEN 'services' THEN 'services' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' ELSE NULL END
  WHEN 'parts' THEN CASE p_key WHEN 'title' THEN 'title' WHEN 'brand' THEN 'brand' WHEN 'model' THEN 'model' WHEN 'condition' THEN 'condition' WHEN 'price_min' THEN 'price' WHEN 'price_max' THEN 'price' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' WHEN 'oem' THEN 'details.oem' ELSE NULL END
  WHEN 'accessories' THEN CASE p_key WHEN 'title' THEN 'title' WHEN 'brand' THEN 'brand' WHEN 'model' THEN 'model' WHEN 'condition' THEN 'condition' WHEN 'price_min' THEN 'price' WHEN 'price_max' THEN 'price' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' ELSE NULL END
  WHEN 'moto' THEN CASE p_key WHEN 'brand' THEN 'brand' WHEN 'model' THEN 'model' WHEN 'year' THEN 'year' WHEN 'year_min' THEN 'year' WHEN 'year_max' THEN 'year' WHEN 'price_min' THEN 'price' WHEN 'price_max' THEN 'price' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' WHEN 'condition' THEN 'condition' WHEN 'moto_type' THEN 'details.moto_type' ELSE NULL END
  WHEN 'special' THEN CASE p_key WHEN 'brand' THEN 'brand' WHEN 'model' THEN 'model' WHEN 'year' THEN 'year' WHEN 'year_min' THEN 'year' WHEN 'year_max' THEN 'year' WHEN 'price_min' THEN 'price' WHEN 'price_max' THEN 'price' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' WHEN 'condition' THEN 'condition' WHEN 'special_type' THEN 'details.special_type' WHEN 'sale_rent' THEN 'details.sale_rent' ELSE NULL END
  WHEN 'bus' THEN CASE p_key WHEN 'brand' THEN 'brand' WHEN 'model' THEN 'model' WHEN 'year' THEN 'year' WHEN 'year_min' THEN 'year' WHEN 'year_max' THEN 'year' WHEN 'price_min' THEN 'price' WHEN 'price_max' THEN 'price' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' WHEN 'condition' THEN 'condition' WHEN 'sale_rent' THEN 'details.sale_rent' ELSE NULL END
  WHEN 'trailer' THEN CASE p_key WHEN 'brand' THEN 'brand' WHEN 'model' THEN 'model' WHEN 'year' THEN 'year' WHEN 'year_min' THEN 'year' WHEN 'year_max' THEN 'year' WHEN 'price_min' THEN 'price' WHEN 'price_max' THEN 'price' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' WHEN 'condition' THEN 'condition' WHEN 'trailer_type' THEN 'details.trailer_type' ELSE NULL END
  WHEN 'water' THEN CASE p_key WHEN 'brand' THEN 'brand' WHEN 'model' THEN 'model' WHEN 'year' THEN 'year' WHEN 'year_min' THEN 'year' WHEN 'year_max' THEN 'year' WHEN 'price_min' THEN 'price' WHEN 'price_max' THEN 'price' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' WHEN 'condition' THEN 'condition' WHEN 'water_type' THEN 'details.water_type' WHEN 'engine' THEN 'details.engine' ELSE NULL END
  WHEN 'caravan' THEN CASE p_key WHEN 'brand' THEN 'brand' WHEN 'model' THEN 'model' WHEN 'year' THEN 'year' WHEN 'year_min' THEN 'year' WHEN 'year_max' THEN 'year' WHEN 'price_min' THEN 'price' WHEN 'price_max' THEN 'price' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' WHEN 'condition' THEN 'condition' WHEN 'caravan_type' THEN 'details.caravan_type' WHEN 'sale_rent' THEN 'details.sale_rent' ELSE NULL END
  WHEN 'plate' THEN CASE p_key WHEN 'price_min' THEN 'price' WHEN 'price_max' THEN 'price' WHEN 'region' THEN 'region' WHEN 'district' THEN 'district' WHEN 'plate_number' THEN 'details.plate_number' WHEN 'plate_series' THEN 'details.plate_series' ELSE NULL END
  WHEN 'insurance' THEN CASE p_key WHEN 'company_name' THEN 'details.company_name' WHEN 'city' THEN 'details.city' WHEN 'insurance_types' THEN 'details.insurance_types' WHEN 'payment_methods' THEN 'details.payment_methods' WHEN 'online_application' THEN 'details.online_application' WHEN 'service_area' THEN 'details.service_area' ELSE NULL END
  WHEN 'sober_driver' THEN CASE p_key WHEN 'company_name' THEN 'details.company_name' WHEN 'city' THEN 'details.city' WHEN 'service_24_7' THEN 'details.service_24_7' WHEN 'city_service' THEN 'details.city_service' WHEN 'intercity_service' THEN 'details.intercity_service' WHEN 'payment_methods' THEN 'details.payment_methods' WHEN 'service_area' THEN 'details.service_area' ELSE NULL END
  WHEN 'leasing' THEN CASE p_key WHEN 'company_name' THEN 'details.company_name' WHEN 'city' THEN 'details.city' WHEN 'vehicle_condition' THEN 'details.vehicle_condition' WHEN 'customer_types' THEN 'details.customer_types' WHEN 'currency' THEN 'details.currency' WHEN 'service_area' THEN 'details.service_area' ELSE NULL END
  ELSE NULL END
$$;
REVOKE ALL ON FUNCTION public.austa_feed_filter_path(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.austa_feed_filter_path(text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.austa_public_listing_page(
 p_category text DEFAULT NULL,
 p_after_bucket integer DEFAULT NULL,
 p_after_at timestamptz DEFAULT NULL,
 p_after_source text DEFAULT NULL,
 p_after_id uuid DEFAULT NULL,
 p_page_size integer DEFAULT 40,
 p_search text DEFAULT NULL,
 p_filters jsonb DEFAULT '{}'::jsonb,
 p_price_field text DEFAULT 'price',
 p_price_bounds jsonb DEFAULT '{}'::jsonb,
 p_promotions_only boolean DEFAULT false
)
RETURNS TABLE(source text,category text,id uuid,owner_id uuid,status text,created_at timestamptz,published_at timestamptz,updated_at timestamptz,expires_at timestamptz,promotion_type text,promotion_started_at timestamptz,promotion_until timestamptz,last_boosted_at timestamptz,sort_bucket integer,sort_at timestamptz,payload jsonb)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
DECLARE filter_key text; filter_value text;
BEGIN
 IF p_category IS NOT NULL AND p_category NOT IN ('cars','dealer','service','rent','parts','accessories','moto','special','bus','trailer','water','caravan','plate','usta','insurance','sober_driver','leasing') THEN
  RAISE EXCEPTION 'Unsupported listing category' USING ERRCODE='22023';
 END IF;
 IF jsonb_typeof(coalesce(p_filters,'{}'::jsonb))<>'object' OR jsonb_typeof(coalesce(p_price_bounds,'{}'::jsonb))<>'object' THEN
  RAISE EXCEPTION 'Filters must be JSON objects' USING ERRCODE='22023';
 END IF;
 IF p_price_field NOT IN ('price','daily_price') THEN RAISE EXCEPTION 'Unsupported price field' USING ERRCODE='22023'; END IF;
 FOR filter_key,filter_value IN SELECT key,value FROM jsonb_each_text(coalesce(p_filters,'{}'::jsonb)) LOOP
  IF public.austa_feed_filter_path(p_category,filter_key) IS NULL THEN RAISE EXCEPTION 'Unsupported filter for category' USING ERRCODE='22023'; END IF;
 END LOOP;
 RETURN QUERY
 SELECT f.source,f.category,f.id,f.owner_id,f.status,f.created_at,f.published_at,f.updated_at,f.expires_at,f.promotion_type,f.promotion_started_at,f.promotion_until,f.last_boosted_at,f.sort_bucket,f.sort_at,f.payload
 FROM public.austa_public_listing_feed f
 WHERE (p_category IS NULL OR f.category=p_category)
  AND (NOT coalesce(p_promotions_only,false) OR f.sort_bucket<3)
  AND (nullif(btrim(p_search),'') IS NULL OR f.payload::text ILIKE '%'||replace(replace(replace(btrim(p_search),'\','\\'),'%','\%'),'_','\_')||'%' ESCAPE '\')
  AND NOT EXISTS (
   SELECT 1 FROM jsonb_each_text(coalesce(p_filters,'{}'::jsonb)) kv
   CROSS JOIN LATERAL (SELECT f.payload #>> string_to_array(public.austa_feed_filter_path(p_category,kv.key),'.') AS actual) value_row
   WHERE CASE
    WHEN kv.key ~ '(_min|_max)$' OR kv.key IN ('year','mileage','engine_volume','horsepower') THEN
     CASE WHEN kv.value ~ '^-?[0-9]+(\.[0-9]+)?$' AND value_row.actual ~ '^-?[0-9]+(\.[0-9]+)?$'
       THEN CASE WHEN kv.key ~ '_max$' THEN value_row.actual::numeric<=kv.value::numeric ELSE value_row.actual::numeric>=kv.value::numeric END
       ELSE false END
    ELSE coalesce(value_row.actual ILIKE '%'||replace(replace(replace(kv.value,'\','\\'),'%','\%'),'_','\_')||'%' ESCAPE '\',false)
   END IS NOT TRUE
  )
  AND (
   coalesce(p_price_bounds,'{}'::jsonb)='{}'::jsonb OR EXISTS (
    SELECT 1 FROM jsonb_each(coalesce(p_price_bounds,'{}'::jsonb)) bounds(currency,range_value)
    CROSS JOIN LATERAL (SELECT f.payload #>> ARRAY[p_price_field] AS amount) price_row
    WHERE upper(bounds.currency)=upper(coalesce(f.payload->>'currency','AZN'))
     AND price_row.amount ~ '^-?[0-9]+(\.[0-9]+)?$'
     AND (NOT (bounds.range_value ? 'min') OR price_row.amount::numeric >= (bounds.range_value->>'min')::numeric)
     AND (NOT (bounds.range_value ? 'max') OR price_row.amount::numeric <= (bounds.range_value->>'max')::numeric)
   )
  )
  AND (
   p_after_bucket IS NULL OR f.sort_bucket>p_after_bucket OR
   (f.sort_bucket=p_after_bucket AND f.sort_at<p_after_at) OR
   (f.sort_bucket=p_after_bucket AND f.sort_at=p_after_at AND f.source>p_after_source) OR
   (f.sort_bucket=p_after_bucket AND f.sort_at=p_after_at AND f.source=p_after_source AND f.id<p_after_id)
  )
 ORDER BY f.sort_bucket ASC,f.sort_at DESC,f.source ASC,f.id DESC
 LIMIT greatest(1,least(coalesce(p_page_size,40),100))+1;
END
$$;
REVOKE ALL ON FUNCTION public.austa_public_listing_page(text,integer,timestamptz,text,uuid,integer,text,jsonb,text,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.austa_public_listing_page(text,integer,timestamptz,text,uuid,integer,text,jsonb,text,jsonb,boolean) TO anon,authenticated;

COMMIT;
