-- The website and mobile app persist vehicle equipment in vehicle_listings.details.
-- Keep column-level privileges narrow and leave the existing owner/public RLS
-- policies as the row-level authorization boundary.
GRANT SELECT (details)
  ON TABLE public.vehicle_listings
  TO anon;

GRANT SELECT (details), INSERT (details), UPDATE (details)
  ON TABLE public.vehicle_listings
  TO authenticated;
