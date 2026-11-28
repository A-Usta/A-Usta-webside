-- V4.3.6: persist small, owner-scoped video posters beside listing media.
-- This migration adds nullable metadata and preserves every existing RLS policy.
BEGIN;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['listing_media','marketplace_listing_media','service_provider_media','auto_dealer_media'] LOOP
    IF to_regclass(format('public.%I',t)) IS NULL OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass(format('public.%I',t))) THEN
      RAISE EXCEPTION 'V4.3.6 requires the existing RLS-protected media table: %',t;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS poster_path text',t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass(format('public.%I',t)) AND conname=t||'_poster_path_guard') THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (poster_path IS NULL OR (media_type=''video'' AND poster_path = owner_id::text || ''/'' || listing_id::text || ''/'' || id::text || ''-poster.jpg'')) NOT VALID',
        t,t||'_poster_path_guard'
      );
    END IF;
    EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',t,t||'_poster_path_guard');
    EXECUTE format('GRANT SELECT (poster_path) ON public.%I TO anon,authenticated',t);
    EXECUTE format('GRANT UPDATE (poster_path) ON public.%I TO authenticated',t);
  END LOOP;
  IF to_regprocedure('public.v355_provider_media_visible(text)') IS NULL THEN
    RAISE EXCEPTION 'V4.3.6 requires the existing provider media visibility guard';
  END IF;
END $$;

-- Provider Storage remains private. Its existing guard now recognizes a poster
-- only when it is referenced by that active, publicly visible video row.
CREATE OR REPLACE FUNCTION public.v355_provider_media_visible(p_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_name !~ '[[:cntrl:]]'
 AND p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-][A-Za-z0-9._-]*$'
 AND EXISTS(
   SELECT 1 FROM public.service_provider_listings l
   WHERE l.id::text=split_part(p_name,'/',2)
     AND l.owner_id::text=split_part(p_name,'/',1)
     AND (
       l.owner_id=auth.uid()
       OR (
         public.v355_provider_public_visible(l.id)
         AND EXISTS(
           SELECT 1 FROM public.service_provider_media m
           WHERE m.listing_id=l.id AND m.owner_id=l.owner_id
             AND (m.storage_path=p_name OR (m.media_type='video' AND m.poster_path=p_name))
         )
       )
     )
 );
$$;
REVOKE ALL ON FUNCTION public.v355_provider_media_visible(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v355_provider_media_visible(text) TO anon,authenticated;

COMMENT ON COLUMN public.listing_media.poster_path IS 'Optional private Storage path of the small JPEG poster paired with this video row.';
COMMENT ON COLUMN public.marketplace_listing_media.poster_path IS 'Optional private Storage path of the small JPEG poster paired with this video row.';
COMMENT ON COLUMN public.service_provider_media.poster_path IS 'Optional private Storage path of the small JPEG poster paired with this video row.';
COMMENT ON COLUMN public.auto_dealer_media.poster_path IS 'Optional private Storage path of the small JPEG poster paired with this video row.';
COMMIT;
