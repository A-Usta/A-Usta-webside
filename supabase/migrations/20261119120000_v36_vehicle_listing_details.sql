-- Persist category-specific vehicle/rental equipment without changing ownership
-- or publication policy. The existing vehicle RLS policies remain authoritative.
ALTER TABLE public.vehicle_listings
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vehicle_listings'::regclass
      AND conname = 'vehicle_listings_details_object_check'
  ) THEN
    ALTER TABLE public.vehicle_listings
      ADD CONSTRAINT vehicle_listings_details_object_check
      CHECK (jsonb_typeof(details) = 'object');
  END IF;
END;
$$;
