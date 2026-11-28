-- V4.3 video engagement: private interaction rows, narrow authenticated writes,
-- and public aggregate reads for active listings with a published video.
BEGIN;

DO $preflight$
DECLARE table_name text;
BEGIN
  IF pg_catalog.to_regprocedure('austa_private.v36_listing_exists(text,uuid,boolean)') IS NULL THEN
    RAISE EXCEPTION 'V4.3 video engagement requires the V3.6 public listing contract';
  END IF;
  FOREACH table_name IN ARRAY ARRAY['listing_media','marketplace_listing_media','service_provider_media','auto_dealer_media'] LOOP
    IF pg_catalog.to_regclass('public.'||table_name) IS NULL THEN
      RAISE EXCEPTION 'V4.3 video engagement prerequisite missing: public.%',table_name;
    END IF;
  END LOOP;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS austa_private.listing_video_views (
  listing_source text NOT NULL CHECK (listing_source IN ('vehicle','marketplace','service_provider','auto_dealer')),
  listing_id uuid NOT NULL,
  visitor_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  first_view_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_view_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (listing_source,listing_id,visitor_id)
);
CREATE TABLE IF NOT EXISTS austa_private.listing_video_likes (
  listing_source text NOT NULL CHECK (listing_source IN ('vehicle','marketplace','service_provider','auto_dealer')),
  listing_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (listing_source,listing_id,user_id)
);
CREATE TABLE IF NOT EXISTS austa_private.listing_video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_source text NOT NULL CHECK (listing_source IN ('vehicle','marketplace','service_provider','auto_dealer')),
  listing_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS listing_video_comments_recent_idx ON austa_private.listing_video_comments(listing_source,listing_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS listing_video_views_listing_idx ON austa_private.listing_video_views(listing_source,listing_id);
ALTER TABLE austa_private.listing_video_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE austa_private.listing_video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE austa_private.listing_video_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON austa_private.listing_video_views,austa_private.listing_video_likes,austa_private.listing_video_comments FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION austa_private.v43_has_public_video(p_source text,p_listing_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
  IF p_source NOT IN ('vehicle','marketplace','service_provider','auto_dealer') OR p_listing_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM austa_private.v36_listing_exists(p_source,p_listing_id,true)) THEN RETURN false; END IF;
  IF p_source='vehicle' THEN RETURN EXISTS(SELECT 1 FROM public.listing_media m WHERE m.listing_id=p_listing_id AND m.media_type='video' AND btrim(m.storage_path)<>''); END IF;
  IF p_source='marketplace' THEN RETURN EXISTS(SELECT 1 FROM public.marketplace_listing_media m WHERE m.listing_id=p_listing_id AND m.media_type='video' AND btrim(m.storage_path)<>''); END IF;
  IF p_source='service_provider' THEN RETURN EXISTS(SELECT 1 FROM public.service_provider_media m WHERE m.listing_id=p_listing_id AND m.media_type='video' AND btrim(m.storage_path)<>''); END IF;
  RETURN EXISTS(SELECT 1 FROM public.auto_dealer_media m WHERE m.listing_id=p_listing_id AND m.media_type='video' AND btrim(m.storage_path)<>'');
END;
$fn$;
REVOKE ALL ON FUNCTION austa_private.v43_has_public_video(text,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.austa_get_video_engagement(p_source text,p_listing_id uuid)
RETURNS TABLE(view_count bigint,like_count bigint,comment_count bigint,viewer_liked boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid();
BEGIN
  IF NOT austa_private.v43_has_public_video(p_source,p_listing_id) THEN RAISE EXCEPTION 'Video elan mövcud deyil' USING ERRCODE='22023'; END IF;
  RETURN QUERY SELECT
    (SELECT count(*) FROM austa_private.listing_video_views v WHERE v.listing_source=p_source AND v.listing_id=p_listing_id),
    (SELECT count(*) FROM austa_private.listing_video_likes l WHERE l.listing_source=p_source AND l.listing_id=p_listing_id),
    (SELECT count(*) FROM austa_private.listing_video_comments c WHERE c.listing_source=p_source AND c.listing_id=p_listing_id),
    (actor IS NOT NULL AND EXISTS(SELECT 1 FROM austa_private.listing_video_likes l WHERE l.listing_source=p_source AND l.listing_id=p_listing_id AND l.user_id=actor));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.austa_record_video_view(p_source text,p_listing_id uuid,p_visitor_id uuid DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid(); visitor uuid:=COALESCE(auth.uid(),p_visitor_id);
BEGIN
  IF visitor IS NULL THEN RAISE EXCEPTION 'Video baxışını qeyd etmək mümkün olmadı' USING ERRCODE='22023'; END IF;
  IF NOT austa_private.v43_has_public_video(p_source,p_listing_id) THEN RAISE EXCEPTION 'Video elan mövcud deyil' USING ERRCODE='22023'; END IF;
  INSERT INTO austa_private.listing_video_views(listing_source,listing_id,visitor_id,user_id)
    VALUES(p_source,p_listing_id,visitor,actor)
    ON CONFLICT(listing_source,listing_id,visitor_id) DO UPDATE SET last_view_at=clock_timestamp(),user_id=COALESCE(EXCLUDED.user_id,austa_private.listing_video_views.user_id)
    WHERE austa_private.listing_video_views.last_view_at < clock_timestamp()-interval '24 hours';
  RETURN (SELECT count(*) FROM austa_private.listing_video_views v WHERE v.listing_source=p_source AND v.listing_id=p_listing_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.austa_toggle_video_like(p_source text,p_listing_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Bəyənmək üçün hesabınıza daxil olun' USING ERRCODE='28000'; END IF;
  IF NOT austa_private.v43_has_public_video(p_source,p_listing_id) THEN RAISE EXCEPTION 'Video elan mövcud deyil' USING ERRCODE='22023'; END IF;
  DELETE FROM austa_private.listing_video_likes WHERE listing_source=p_source AND listing_id=p_listing_id AND user_id=actor;
  IF FOUND THEN RETURN false; END IF;
  INSERT INTO austa_private.listing_video_likes(listing_source,listing_id,user_id) VALUES(p_source,p_listing_id,actor) ON CONFLICT DO NOTHING;
  RETURN true;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.austa_list_video_comments(p_source text,p_listing_id uuid)
RETURNS TABLE(comment_id uuid,body text,created_at timestamptz,is_mine boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
  IF NOT austa_private.v43_has_public_video(p_source,p_listing_id) THEN RAISE EXCEPTION 'Video elan mövcud deyil' USING ERRCODE='22023'; END IF;
  RETURN QUERY SELECT c.id,c.body,c.created_at,(c.user_id=auth.uid()) FROM austa_private.listing_video_comments c
    WHERE c.listing_source=p_source AND c.listing_id=p_listing_id ORDER BY c.created_at DESC,c.id DESC LIMIT 100;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.austa_add_video_comment(p_source text,p_listing_id uuid,p_body text)
RETURNS TABLE(comment_id uuid,body text,created_at timestamptz,is_mine boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid(); clean_body text:=btrim(COALESCE(p_body,''));
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Şərh yazmaq üçün hesabınıza daxil olun' USING ERRCODE='28000'; END IF;
  IF char_length(clean_body) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Şərh 1–1000 simvol aralığında olmalıdır' USING ERRCODE='22023'; END IF;
  IF NOT austa_private.v43_has_public_video(p_source,p_listing_id) THEN RAISE EXCEPTION 'Video elan mövcud deyil' USING ERRCODE='22023'; END IF;
  RETURN QUERY INSERT INTO austa_private.listing_video_comments(listing_source,listing_id,user_id,body) VALUES(p_source,p_listing_id,actor,clean_body)
    RETURNING austa_private.listing_video_comments.id,austa_private.listing_video_comments.body,austa_private.listing_video_comments.created_at,true;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.austa_delete_video_comment(p_comment_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid(); affected integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Şərhi silmək üçün hesabınıza daxil olun' USING ERRCODE='28000'; END IF;
  DELETE FROM austa_private.listing_video_comments WHERE id=p_comment_id AND user_id=actor;
  GET DIAGNOSTICS affected=ROW_COUNT; RETURN affected=1;
END;
$fn$;

DO $grants$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.austa_get_video_engagement(text,uuid)','public.austa_record_video_view(text,uuid,uuid)',
    'public.austa_toggle_video_like(text,uuid)','public.austa_list_video_comments(text,uuid)',
    'public.austa_add_video_comment(text,uuid,text)','public.austa_delete_video_comment(uuid)'
  ] LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',sig); END LOOP;
  GRANT EXECUTE ON FUNCTION public.austa_get_video_engagement(text,uuid) TO anon,authenticated;
  GRANT EXECUTE ON FUNCTION public.austa_record_video_view(text,uuid,uuid) TO anon,authenticated;
  GRANT EXECUTE ON FUNCTION public.austa_toggle_video_like(text,uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.austa_list_video_comments(text,uuid) TO anon,authenticated;
  GRANT EXECUTE ON FUNCTION public.austa_add_video_comment(text,uuid,text) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.austa_delete_video_comment(uuid) TO authenticated;
END;
$grants$;

COMMIT;
