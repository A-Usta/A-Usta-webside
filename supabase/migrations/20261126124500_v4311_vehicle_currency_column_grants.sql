-- Grant access only to the new currency column. Existing RLS owner checks remain authoritative.
GRANT SELECT (currency) ON TABLE public.vehicle_listings TO anon, authenticated;
GRANT INSERT (currency), UPDATE (currency) ON TABLE public.vehicle_listings TO authenticated;
