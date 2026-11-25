-- V4.3.6: opt-in public business avatar. Does not change profiles or seller_profiles RLS.
BEGIN;

DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.seller_profiles'::regclass) THEN
    RAISE EXCEPTION 'V4.3.6 requires seller_profiles RLS to remain enabled';
  END IF;
END $$;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('seller-profile-avatars','seller-profile-avatars',false,2097152,ARRAY['image/jpeg']::text[])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=2097152,allowed_mime_types=ARRAY['image/jpeg']::text[];

CREATE TABLE public.seller_profile_public_avatars (
  seller_profile_id uuid PRIMARY KEY REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_consent boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_profile_avatar_path_guard CHECK (
    storage_path = owner_id::text || '/' || seller_profile_id::text || '/avatar.jpg'
  ),
  CONSTRAINT seller_profile_avatar_consent_guard CHECK (
    (public_consent AND consented_at IS NOT NULL) OR (NOT public_consent AND consented_at IS NULL)
  )
);
ALTER TABLE public.seller_profile_public_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profile_public_avatars FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_profile_public_avatars FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.seller_profile_public_avatars TO authenticated;
CREATE POLICY seller_profile_avatar_owner_select ON public.seller_profile_public_avatars
  FOR SELECT TO authenticated USING (owner_id=auth.uid());
CREATE POLICY seller_profile_avatar_owner_insert ON public.seller_profile_public_avatars
  FOR INSERT TO authenticated WITH CHECK (
    owner_id=auth.uid() AND EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.id=seller_profile_id AND sp.owner_id=auth.uid()
    )
  );
CREATE POLICY seller_profile_avatar_owner_update ON public.seller_profile_public_avatars
  FOR UPDATE TO authenticated USING (owner_id=auth.uid()) WITH CHECK (
    owner_id=auth.uid() AND EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.id=seller_profile_id AND sp.owner_id=auth.uid()
    )
  );
CREATE POLICY seller_profile_avatar_owner_delete ON public.seller_profile_public_avatars
  FOR DELETE TO authenticated USING (owner_id=auth.uid());

CREATE OR REPLACE FUNCTION public.austa_public_seller_avatar_visible(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
  SELECT p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar\.jpg$'
    AND EXISTS (
      SELECT 1 FROM public.seller_profile_public_avatars a
      JOIN public.seller_profiles sp ON sp.id=a.seller_profile_id AND sp.owner_id=a.owner_id
      WHERE a.storage_path=p_name AND a.public_consent AND a.consented_at IS NOT NULL
        AND sp.status='active' AND sp.verification_status='verified'
    );
$$;
REVOKE ALL ON FUNCTION public.austa_public_seller_avatar_visible(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.austa_public_seller_avatar_visible(text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.austa_get_public_seller_avatar(p_seller_profile_id uuid)
RETURNS TABLE(avatar_path text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
  SELECT a.storage_path FROM public.seller_profile_public_avatars a
  JOIN public.seller_profiles sp ON sp.id=a.seller_profile_id AND sp.owner_id=a.owner_id
  WHERE a.seller_profile_id=p_seller_profile_id AND a.public_consent AND a.consented_at IS NOT NULL
    AND sp.status='active' AND sp.verification_status='verified'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.austa_get_public_seller_avatar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.austa_get_public_seller_avatar(uuid) TO anon,authenticated;

CREATE POLICY seller_avatar_public_read ON storage.objects FOR SELECT TO anon,authenticated
  USING (bucket_id='seller-profile-avatars' AND public.austa_public_seller_avatar_visible(name));
CREATE POLICY seller_avatar_owner_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='seller-profile-avatars' AND split_part(name,'/',1)=auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.seller_profile_public_avatars a WHERE a.owner_id=auth.uid() AND a.storage_path=name));
CREATE POLICY seller_avatar_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='seller-profile-avatars'
    AND split_part(name,'/',1)=auth.uid()::text
    AND split_part(name,'/',3)='avatar.jpg'
    AND EXISTS (SELECT 1 FROM public.seller_profile_public_avatars a
      WHERE a.owner_id=auth.uid() AND a.storage_path=name));
CREATE POLICY seller_avatar_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='seller-profile-avatars' AND split_part(name,'/',1)=auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.seller_profile_public_avatars a WHERE a.owner_id=auth.uid() AND a.storage_path=name))
  WITH CHECK (bucket_id='seller-profile-avatars' AND split_part(name,'/',1)=auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.seller_profile_public_avatars a WHERE a.owner_id=auth.uid() AND a.storage_path=name));
CREATE POLICY seller_avatar_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='seller-profile-avatars' AND split_part(name,'/',1)=auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.seller_profile_public_avatars a WHERE a.owner_id=auth.uid() AND a.storage_path=name));

COMMENT ON TABLE public.seller_profile_public_avatars IS 'Private owner-controlled mapping for an explicitly consented public avatar on an active verified business profile.';
COMMIT;
