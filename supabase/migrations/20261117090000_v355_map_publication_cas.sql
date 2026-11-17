-- V3.5.5: database-enforced optimistic concurrency and idempotent publication RPC.
-- Hosted application requires separate owner approval. No production authorization.
-- Apply only after 20261114072012_v355_public_provider_discovery.sql
-- and 20261114132329_v355_provider_location_privacy.sql, after TEST approval.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.provider_map_publications') IS NULL
    OR to_regprocedure('public.v355_provider_public_visible(uuid)') IS NULL
    OR EXISTS (SELECT 1 FROM pg_attribute
               WHERE attrelid='public.provider_map_publications'::regclass
                 AND attname='revision' AND NOT attisdropped)
    OR to_regclass('public.v355_map_publication_receipts') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace
               AND proname='v355_apply_map_publication') THEN
    RAISE EXCEPTION 'V355 CAS prerequisite mismatch or object conflict';
  END IF;
END $$;

ALTER TABLE public.provider_map_publications
  ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0);

-- Exactly one durable outcome per (authenticated owner, client request UUID).
-- No direct application role access to receipt data.
CREATE TABLE public.v355_map_publication_receipts (
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  request_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  request_payload jsonb NOT NULL,
  result_revision bigint NOT NULL CHECK(result_revision >= 0),
  result_enabled boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id, request_id)
);
ALTER TABLE public.v355_map_publication_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.v355_map_publication_receipts FROM PUBLIC, anon, authenticated;

-- Moving all publication writes behind this RPC prevents callers from bypassing CAS.
REVOKE INSERT, UPDATE, DELETE ON public.provider_map_publications FROM authenticated;

CREATE FUNCTION public.v355_apply_map_publication(
  p_listing_id uuid,
  p_expected_revision bigint,
  p_request_id uuid,
  p_enabled boolean,
  p_consent boolean DEFAULT NULL,
  p_public_name text DEFAULT NULL,
  p_public_area text DEFAULT NULL,
  p_public_address text DEFAULT NULL,
  p_public_phone text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_location_kind text DEFAULT NULL,
  p_services text[] DEFAULT NULL
)
RETURNS TABLE(listing_id uuid, revision bigint, enabled boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '4000ms'
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_current_revision bigint;
  v_new_revision bigint;
  v_new_enabled boolean;
  v_receipt public.v355_map_publication_receipts%ROWTYPE;
  v_payload jsonb;
BEGIN
  IF v_owner IS NULL OR p_listing_id IS NULL OR p_request_id IS NULL
     OR p_expected_revision IS NULL OR p_expected_revision < 0 OR p_expected_revision > 9007199254740990
     OR p_enabled IS NULL THEN
    RAISE EXCEPTION 'Invalid map publication request' USING ERRCODE='22023';
  END IF;

  -- Serialize request replays (even when the same key targets different listings).
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_request_id::text, 0)
  );

  v_payload := pg_catalog.jsonb_build_object(
    'listing',p_listing_id, 'expected',p_expected_revision, 'enabled',p_enabled,
    'consent',p_consent, 'name',p_public_name, 'area',p_public_area,
    'address',p_public_address, 'phone',p_public_phone,
    'lat',p_latitude, 'lon',p_longitude,
    'kind',p_location_kind, 'services',p_services
  );

  -- Serialize all publication changes for the listing, including first insertion.
  PERFORM 1 FROM public.service_provider_listings l
   WHERE l.id=p_listing_id AND l.owner_id=v_owner FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Publication ownership required' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_receipt FROM public.v355_map_publication_receipts r
   WHERE r.owner_id=v_owner AND r.request_id=p_request_id;
  IF FOUND THEN
    IF v_receipt.listing_id IS DISTINCT FROM p_listing_id
       OR v_receipt.request_payload IS DISTINCT FROM v_payload THEN
      RAISE EXCEPTION 'Publication request UUID reused with different input'
        USING ERRCODE='22023';
    END IF;
    RETURN QUERY SELECT p_listing_id, v_receipt.result_revision, v_receipt.result_enabled;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.provider_map_publications m
    WHERE m.listing_id=p_listing_id AND m.consenting_owner<>v_owner) THEN
    RAISE EXCEPTION 'Prior owner consent cannot be reused' USING ERRCODE='42501';
  END IF;

  SELECT m.revision INTO v_current_revision
    FROM public.provider_map_publications m WHERE m.listing_id=p_listing_id FOR UPDATE;
  IF NOT FOUND THEN v_current_revision := 0; END IF;
  IF v_current_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'Map publication version conflict' USING ERRCODE='40001';
  END IF;

  IF p_enabled THEN
    IF p_consent IS DISTINCT FROM TRUE
       OR p_public_name IS NULL OR p_public_area IS NULL
       OR p_location_kind IS NULL OR p_services IS NULL THEN
      RAISE EXCEPTION 'Explicit publication consent and fields required' USING ERRCODE='22023';
    END IF;
    -- A provider can publish only while eligible; discovery checks eligibility again on read.
    PERFORM 1 FROM public.service_provider_listings l
      JOIN public.seller_profiles s ON s.id=l.seller_profile_id
        AND s.owner_id=l.owner_id AND s.business_type=l.provider_type
      JOIN public.profiles p ON p.id=l.owner_id
      WHERE l.id=p_listing_id AND l.owner_id=v_owner
        AND l.status='active' AND s.status='active'
        AND s.verification_status='verified' AND p.is_active
        AND ((l.provider_type='usta' AND p.role='mechanic')
          OR (l.provider_type='service' AND p.role='shop'))
      FOR SHARE OF s,p;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Provider not eligible for public map' USING ERRCODE='42501';
    END IF;
    IF v_current_revision=0 THEN
      INSERT INTO public.provider_map_publications (
        listing_id, consenting_owner, revision, enabled, consent, consent_version,
        public_name, public_area, public_address, public_phone,
        latitude, longitude, location_kind, services
      ) VALUES (
        p_listing_id, v_owner, 1, TRUE, TRUE, 'v355-1',
        p_public_name, p_public_area, p_public_address, p_public_phone,
        p_latitude, p_longitude, p_location_kind, p_services
      );
      v_new_revision := 1;
    ELSE
      UPDATE public.provider_map_publications m SET
        revision=m.revision+1,
        enabled=TRUE, consent=TRUE, consent_version='v355-1',
        public_name=p_public_name, public_area=p_public_area,
        public_address=p_public_address, public_phone=p_public_phone,
        latitude=p_latitude, longitude=p_longitude,
        location_kind=p_location_kind, services=p_services
      WHERE m.listing_id=p_listing_id
        AND m.consenting_owner=v_owner AND m.revision=v_current_revision
      RETURNING m.revision INTO v_new_revision;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Map publication ownership/version conflict' USING ERRCODE='40001';
      END IF;
    END IF;
    v_new_enabled := TRUE;
  ELSE
    -- Withdrawal cannot overwrite old content or supply an unrelated payload.
    IF p_consent IS NOT NULL OR p_public_name IS NOT NULL OR p_public_area IS NOT NULL
       OR p_public_address IS NOT NULL OR p_public_phone IS NOT NULL
       OR p_latitude IS NOT NULL OR p_longitude IS NOT NULL
       OR p_location_kind IS NOT NULL OR p_services IS NOT NULL THEN
      RAISE EXCEPTION 'Withdrawal accepts no publication fields' USING ERRCODE='22023';
    END IF;
    IF v_current_revision=0 THEN
      -- A disabled tombstone advances the version even if no prior publication exists.
      -- Otherwise publish(expected=0) could undo a concurrent successful withdrawal.
      INSERT INTO public.provider_map_publications
        (listing_id,consenting_owner,revision,enabled,consent,public_name,
         public_area,location_kind,services)
      VALUES (p_listing_id,v_owner,1,FALSE,FALSE,'Dərc edilməyib','--',
              'service_area',ARRAY['repair']::text[]);
      v_new_revision := 1;
    ELSE
      UPDATE public.provider_map_publications m
        SET revision=m.revision+1, enabled=FALSE, consent=FALSE
        WHERE m.listing_id=p_listing_id
          AND m.consenting_owner=v_owner AND m.revision=v_current_revision
        RETURNING m.revision INTO v_new_revision;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Map withdrawal ownership/version conflict' USING ERRCODE='40001';
      END IF;
    END IF;
    v_new_enabled := FALSE;
  END IF;

  INSERT INTO public.v355_map_publication_receipts
    (owner_id,request_id,listing_id,request_payload,result_revision,result_enabled)
  VALUES (v_owner,p_request_id,p_listing_id,v_payload,v_new_revision,v_new_enabled);

  RETURN QUERY SELECT p_listing_id, v_new_revision, v_new_enabled;
END;
$$;

REVOKE ALL ON FUNCTION public.v355_apply_map_publication(
  uuid,bigint,uuid,boolean,boolean,text,text,text,text,
  double precision,double precision,text,text[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v355_apply_map_publication(
  uuid,bigint,uuid,boolean,boolean,text,text,text,text,
  double precision,double precision,text,text[]
) TO authenticated;
-- Preserve the trigger body and owner; remove mutable schema lookup and public RPC access.
-- The existing body uses auth.uid() and NEW/OLD only. Stop on signature drift.
DO $$
BEGIN
 IF to_regprocedure('public.austa_protect_profile_security_fields()') IS NULL
 OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.austa_protect_profile_security_fields()'::regprocedure
                AND prosecdef AND prorettype='pg_catalog.trigger'::regtype) THEN
  RAISE EXCEPTION 'Inspect profile security trigger dependency';
 END IF;
END $$;
ALTER FUNCTION public.austa_protect_profile_security_fields() SET search_path='';
REVOKE ALL ON FUNCTION public.austa_protect_profile_security_fields() FROM PUBLIC,anon,authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
