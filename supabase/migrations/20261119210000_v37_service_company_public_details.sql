-- V3.7: expose only the declared public fields for service-company subcategories.
-- The provider table, RLS policies, private media bucket and consent-gated phone/location stay unchanged.
BEGIN;
DO $$
BEGIN
 IF to_regclass('public.public_service_provider_listings') IS NULL
    OR to_regclass('public.service_provider_listings') IS NULL
    OR to_regprocedure('public.v355_provider_public_visible(uuid)') IS NULL THEN
   RAISE EXCEPTION 'V3.7 requires the reviewed V355 provider privacy view and eligibility function';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.service_provider_listings'::regclass AND relrowsecurity) THEN
   RAISE EXCEPTION 'Provider listing RLS is required';
 END IF;
END $$;
CREATE OR REPLACE VIEW public.public_service_provider_listings
WITH (security_barrier=true,security_invoker=false) AS
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
 CASE WHEN l.owner_id=auth.uid() THEN l.details ELSE
  jsonb_strip_nulls(
   jsonb_build_object(
    'brands',CASE WHEN jsonb_typeof(l.details->'brands') IN ('string','number','boolean') THEN l.details->'brands' END,
    'price_policy',CASE WHEN jsonb_typeof(l.details->'price_policy') IN ('string','number','boolean') THEN l.details->'price_policy' END,
    'service_category',CASE WHEN jsonb_typeof(l.details->'service_category')='string' AND l.details->>'service_category' IN ('leasing','insurance','sober_driver') THEN l.details->'service_category' END,
    'company_name',CASE WHEN jsonb_typeof(l.details->'company_name')='string' THEN l.details->'company_name' END,
    'tax_id',CASE WHEN jsonb_typeof(l.details->'tax_id')='string' THEN l.details->'tax_id' END,
    'legal_name',CASE WHEN jsonb_typeof(l.details->'legal_name')='string' THEN l.details->'legal_name' END,
    'email',CASE WHEN jsonb_typeof(l.details->'email')='string' THEN l.details->'email' END,
    'website',CASE WHEN jsonb_typeof(l.details->'website')='string' THEN l.details->'website' END,
    'city',CASE WHEN jsonb_typeof(l.details->'city')='string' THEN l.details->'city' END,
    'service_area',CASE WHEN jsonb_typeof(l.details->'service_area')='string' THEN l.details->'service_area' END,
    'vehicle_categories',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'vehicle_categories')='string' THEN l.details->'vehicle_categories' END,
    'vehicle_condition',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'vehicle_condition')='string' THEN l.details->'vehicle_condition' END,
    'customer_types',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'customer_types')='string' THEN l.details->'customer_types' END,
    'minimum_down_payment',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'minimum_down_payment') IN ('string','number') THEN l.details->'minimum_down_payment' END,
    'minimum_term',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'minimum_term') IN ('string','number') THEN l.details->'minimum_term' END,
    'maximum_term',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'maximum_term') IN ('string','number') THEN l.details->'maximum_term' END,
    'rate',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'rate') IN ('string','number') THEN l.details->'rate' END,
    'interest_type',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'interest_type')='string' THEN l.details->'interest_type' END,
    'currency',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'currency')='string' THEN l.details->'currency' END,
    'minimum_financing',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'minimum_financing') IN ('string','number') THEN l.details->'minimum_financing' END,
    'maximum_financing',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'maximum_financing') IN ('string','number') THEN l.details->'maximum_financing' END,
    'guarantor_required',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'guarantor_required')='string' THEN l.details->'guarantor_required' END,
    'income_proof_required',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'income_proof_required')='string' THEN l.details->'income_proof_required' END,
    'required_documents',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'required_documents')='string' THEN l.details->'required_documents' END,
    'terms',CASE WHEN l.details->>'service_category'='leasing' AND jsonb_typeof(l.details->'terms')='string' THEN l.details->'terms' END,
    'insurance_types',CASE WHEN l.details->>'service_category'='insurance' AND jsonb_typeof(l.details->'insurance_types')='string' THEN l.details->'insurance_types' END,
    'coverage',CASE WHEN l.details->>'service_category'='insurance' AND jsonb_typeof(l.details->'coverage')='string' THEN l.details->'coverage' END,
    'franchise',CASE WHEN l.details->>'service_category'='insurance' AND jsonb_typeof(l.details->'franchise')='string' THEN l.details->'franchise' END,
    'contract_months',CASE WHEN l.details->>'service_category'='insurance' AND jsonb_typeof(l.details->'contract_months') IN ('string','number') THEN l.details->'contract_months' END,
    'payment_methods',CASE WHEN l.details->>'service_category' IN ('insurance','sober_driver') AND jsonb_typeof(l.details->'payment_methods')='string' THEN l.details->'payment_methods' END,
    'installments_available',CASE WHEN l.details->>'service_category'='insurance' AND jsonb_typeof(l.details->'installments_available')='string' THEN l.details->'installments_available' END,
    'online_application',CASE WHEN l.details->>'service_category'='insurance' AND jsonb_typeof(l.details->'online_application')='string' THEN l.details->'online_application' END,
    'claims_support',CASE WHEN l.details->>'service_category'='insurance' AND jsonb_typeof(l.details->'claims_support')='string' THEN l.details->'claims_support' END,
    'repair_network',CASE WHEN l.details->>'service_category'='insurance' AND jsonb_typeof(l.details->'repair_network')='string' THEN l.details->'repair_network' END,
    'exclusions',CASE WHEN l.details->>'service_category'='insurance' AND jsonb_typeof(l.details->'exclusions')='string' THEN l.details->'exclusions' END,
    'license_reference',CASE WHEN l.details->>'service_category' IN ('leasing','insurance') AND jsonb_typeof(l.details->'license_reference')='string' THEN l.details->'license_reference' END,
    'license_disclosure',CASE WHEN l.details->>'service_category' IN ('leasing','insurance') AND jsonb_typeof(l.details->'license_disclosure')='string' THEN l.details->'license_disclosure' END,
    'service_24_7',CASE WHEN l.details->>'service_category'='sober_driver' AND jsonb_typeof(l.details->'service_24_7')='string' THEN l.details->'service_24_7' END,
    'minimum_order_price',CASE WHEN l.details->>'service_category'='sober_driver' AND jsonb_typeof(l.details->'minimum_order_price') IN ('string','number') THEN l.details->'minimum_order_price' END,
    'rate_per_km',CASE WHEN l.details->>'service_category'='sober_driver' AND jsonb_typeof(l.details->'rate_per_km') IN ('string','number') THEN l.details->'rate_per_km' END,
    'rate_per_hour',CASE WHEN l.details->>'service_category'='sober_driver' AND jsonb_typeof(l.details->'rate_per_hour') IN ('string','number') THEN l.details->'rate_per_hour' END,
    'night_rate',CASE WHEN l.details->>'service_category'='sober_driver' AND jsonb_typeof(l.details->'night_rate') IN ('string','number') THEN l.details->'night_rate' END,
    'city_service',CASE WHEN l.details->>'service_category'='sober_driver' AND jsonb_typeof(l.details->'city_service')='string' THEN l.details->'city_service' END,
    'intercity_service',CASE WHEN l.details->>'service_category'='sober_driver' AND jsonb_typeof(l.details->'intercity_service')='string' THEN l.details->'intercity_service' END,
    'advance_booking',CASE WHEN l.details->>'service_category'='sober_driver' AND jsonb_typeof(l.details->'advance_booking')='string' THEN l.details->'advance_booking' END,
    'urgent_service',CASE WHEN l.details->>'service_category'='sober_driver' AND jsonb_typeof(l.details->'urgent_service')='string' THEN l.details->'urgent_service' END,
    'driver_experience',CASE WHEN l.details->>'service_category'='sober_driver' AND jsonb_typeof(l.details->'driver_experience')='string' THEN l.details->'driver_experience' END,
    'waiting_fee',CASE WHEN l.details->>'service_category'='sober_driver' AND jsonb_typeof(l.details->'waiting_fee') IN ('string','number') THEN l.details->'waiting_fee' END,
    'special_conditions',CASE WHEN l.details->>'service_category'='sober_driver' AND jsonb_typeof(l.details->'special_conditions')='string' THEN l.details->'special_conditions' END,
    'description',CASE WHEN l.details->>'service_category' IN ('leasing','insurance','sober_driver') AND jsonb_typeof(l.details->'description')='string' THEN l.details->'description' END
   )
  )
 END AS details,
 l.seller_profile_id
FROM public.service_provider_listings l
LEFT JOIN public.provider_map_publications m ON m.listing_id=l.id AND m.consenting_owner=l.owner_id AND m.consent_version='v355-1'
WHERE l.owner_id=auth.uid() OR public.v355_provider_public_visible(l.id);
COMMENT ON VIEW public.public_service_provider_listings IS 'V3.7 safe public service-company fields; raw details, owner PII, and consent-gated phone/location remain protected.';
COMMIT;
