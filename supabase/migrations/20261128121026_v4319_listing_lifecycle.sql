-- V4.3.19/V4.3.21: server-owned listing lifetime and one canonical public feed.
-- Existing publish dates are preserved; only active rows receive an expiry based
-- on their actual first publication date.
BEGIN;

ALTER TABLE public.vehicle_listings ADD COLUMN IF NOT EXISTS first_published_at timestamptz;
ALTER TABLE public.vehicle_listings ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS first_published_at timestamptz;
ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.service_provider_listings ADD COLUMN IF NOT EXISTS first_published_at timestamptz;
ALTER TABLE public.service_provider_listings ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.auto_dealer_listings ADD COLUMN IF NOT EXISTS first_published_at timestamptz;
ALTER TABLE public.auto_dealer_listings ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.vehicle_listings SET first_published_at=coalesce(published_at,created_at),expires_at=coalesce(published_at,created_at)+interval '30 days' WHERE status='active' AND expires_at IS NULL;
UPDATE public.marketplace_listings SET first_published_at=coalesce(published_at,created_at),expires_at=coalesce(published_at,created_at)+interval '30 days' WHERE status='active' AND expires_at IS NULL;
UPDATE public.service_provider_listings SET first_published_at=coalesce(published_at,created_at),expires_at=coalesce(published_at,created_at)+interval '30 days' WHERE status='active' AND expires_at IS NULL;
UPDATE public.auto_dealer_listings SET first_published_at=coalesce(published_at,created_at),expires_at=coalesce(published_at,created_at)+interval '30 days' WHERE status='active' AND expires_at IS NULL;

ALTER TABLE public.vehicle_listings DROP CONSTRAINT IF EXISTS vehicle_listings_status_check;
ALTER TABLE public.vehicle_listings ADD CONSTRAINT vehicle_listings_status_check CHECK (status=ANY(ARRAY['draft','active','sold','rented','expired','archived']::text[]));
ALTER TABLE public.marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_status_check;
ALTER TABLE public.marketplace_listings ADD CONSTRAINT marketplace_listings_status_check CHECK (status=ANY(ARRAY['draft','active','sold','inactive','expired','archived']::text[]));
ALTER TABLE public.service_provider_listings DROP CONSTRAINT IF EXISTS service_provider_status_check;
ALTER TABLE public.service_provider_listings ADD CONSTRAINT service_provider_status_check CHECK (status=ANY(ARRAY['draft','active','inactive','expired','archived']::text[]));
ALTER TABLE public.auto_dealer_listings DROP CONSTRAINT IF EXISTS auto_dealer_status_check;
ALTER TABLE public.auto_dealer_listings ADD CONSTRAINT auto_dealer_status_check CHECK (status=ANY(ARRAY['draft','active','inactive','expired','archived']::text[]));

CREATE INDEX IF NOT EXISTS vehicle_listing_expiry_idx ON public.vehicle_listings(expires_at,id) WHERE status='active' AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_listing_expiry_idx ON public.marketplace_listings(expires_at,id) WHERE status='active' AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS service_provider_listing_expiry_idx ON public.service_provider_listings(expires_at,id) WHERE status='active' AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS auto_dealer_listing_expiry_idx ON public.auto_dealer_listings(expires_at,id) WHERE status='active' AND expires_at IS NOT NULL;

-- Existing permissive policies are retained. This restrictive layer makes an
-- expired listing private even if an older permissive policy still says active.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['vehicle_listings','marketplace_listings','service_provider_listings','auto_dealer_listings'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS v4319_public_expiry_guard ON public.%I',t);
  EXECUTE format('CREATE POLICY v4319_public_expiry_guard ON public.%I AS RESTRICTIVE FOR SELECT TO anon,authenticated USING (owner_id=(SELECT auth.uid()) OR (status=''active'' AND expires_at>statement_timestamp()))',t);
 END LOOP;
END $$;

-- A renewal authorization is transaction-scoped and can only be inserted by
-- the SECURITY DEFINER RPC below. Clients cannot forge a status reactivation.
CREATE TABLE IF NOT EXISTS austa_private.listing_renewal_requests(
 owner_id uuid NOT NULL,
 request_id uuid NOT NULL,
 source text NOT NULL CHECK(source IN ('vehicle','marketplace','service_provider','auto_dealer')),
 listing_id uuid NOT NULL,
 result_status text NOT NULL DEFAULT 'active',
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(owner_id,request_id)
);
ALTER TABLE austa_private.listing_renewal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE austa_private.listing_renewal_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON austa_private.listing_renewal_requests FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS austa_private.listing_transition_grants(
 txid bigint NOT NULL,
 source text NOT NULL,
 listing_id uuid NOT NULL,
 PRIMARY KEY(txid,source,listing_id)
);
ALTER TABLE austa_private.listing_transition_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE austa_private.listing_transition_grants FORCE ROW LEVEL SECURITY;
REVOKE ALL ON austa_private.listing_transition_grants FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION austa_private.enforce_listing_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE src text; authorized boolean:=false; now_at timestamptz:=statement_timestamp();
BEGIN
 src:=TG_ARGV[0];
 IF TG_OP='INSERT' THEN
  IF NEW.status='active' THEN
   NEW.published_at:=now_at;
   NEW.first_published_at:=now_at;
   NEW.expires_at:=now_at+interval '30 days';
  ELSE NEW.first_published_at:=NULL; NEW.expires_at:=NULL;
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.status='active' AND OLD.status<>'active' THEN
  IF OLD.status='expired' THEN
   DELETE FROM austa_private.listing_transition_grants g WHERE g.txid=txid_current() AND g.source=src AND g.listing_id=OLD.id RETURNING true INTO authorized;
   IF coalesce(authorized,false)=false THEN RAISE EXCEPTION 'Expired listing must be renewed through the owner renewal RPC' USING ERRCODE='42501'; END IF;
  END IF;
  NEW.published_at:=now_at;
  NEW.first_published_at:=CASE WHEN OLD.first_published_at IS NOT NULL THEN OLD.first_published_at WHEN OLD.status='expired' THEN coalesce(OLD.published_at,OLD.created_at,now_at) ELSE now_at END;
  NEW.expires_at:=now_at+interval '30 days';
 ELSIF OLD.status='active' AND NEW.status<>'active' THEN
  -- Expiration never destroys listing content or media.
  NEW.expires_at:=coalesce(OLD.expires_at,coalesce(OLD.published_at,OLD.created_at)+interval '30 days');
 ELSE
  -- Client edits cannot extend or otherwise rewrite server-owned lifecycle dates.
  NEW.first_published_at:=OLD.first_published_at;
  NEW.expires_at:=OLD.expires_at;
  NEW.published_at:=OLD.published_at;
 END IF;
 NEW.updated_at:=now_at;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION austa_private.enforce_listing_lifecycle() FROM PUBLIC,anon,authenticated;

DO $$ DECLARE t text; src text; BEGIN
 FOREACH t IN ARRAY ARRAY['vehicle_listings','marketplace_listings','service_provider_listings','auto_dealer_listings'] LOOP
  src:=CASE t WHEN 'vehicle_listings' THEN 'vehicle' WHEN 'marketplace_listings' THEN 'marketplace' WHEN 'service_provider_listings' THEN 'service_provider' ELSE 'auto_dealer' END;
  EXECUTE format('DROP TRIGGER IF EXISTS v4319_listing_lifecycle ON public.%I',t);
  EXECUTE format('CREATE TRIGGER v4319_listing_lifecycle BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION austa_private.enforce_listing_lifecycle(%L)',t,src);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.austa_renew_listing(p_source text,p_listing_id uuid,p_request_id uuid)
RETURNS TABLE(listing_id uuid,status text,expires_at timestamptz,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); prior austa_private.listing_renewal_requests%ROWTYPE; changed integer; inserted integer; expiry timestamptz; oldstatus text; current_expiry timestamptz; table_name text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 IF p_request_id IS NULL OR p_listing_id IS NULL OR p_source NOT IN ('vehicle','marketplace','service_provider','auto_dealer') THEN RAISE EXCEPTION 'Invalid renewal request' USING ERRCODE='22023'; END IF;
 table_name:=CASE p_source WHEN 'vehicle' THEN 'vehicle_listings' WHEN 'marketplace' THEN 'marketplace_listings' WHEN 'service_provider' THEN 'service_provider_listings' ELSE 'auto_dealer_listings' END;
 INSERT INTO austa_private.listing_renewal_requests(owner_id,request_id,source,listing_id) VALUES(actor,p_request_id,p_source,p_listing_id) ON CONFLICT(owner_id,request_id) DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 SELECT * INTO prior FROM austa_private.listing_renewal_requests WHERE owner_id=actor AND request_id=p_request_id FOR UPDATE;
 IF prior.source<>p_source OR prior.listing_id<>p_listing_id THEN RAISE EXCEPTION 'Idempotency key reused for another listing' USING ERRCODE='23505'; END IF;
 IF prior.created_at < statement_timestamp()-interval '24 hours' THEN RAISE EXCEPTION 'Renewal request expired; use a new request id' USING ERRCODE='22023'; END IF;
 IF inserted=0 THEN
  EXECUTE format('SELECT status,expires_at FROM public.%I WHERE id=$1 AND owner_id=$2',table_name) INTO oldstatus,expiry USING p_listing_id,actor;
  IF oldstatus IS NULL THEN RAISE EXCEPTION 'Listing not found for this owner' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT p_listing_id,oldstatus,expiry,true; RETURN;
 END IF;
 EXECUTE format('SELECT status,expires_at FROM public.%I WHERE id=$1 AND owner_id=$2 FOR UPDATE',table_name) INTO oldstatus,current_expiry USING p_listing_id,actor;
 IF oldstatus='active' AND current_expiry<=statement_timestamp() THEN
  EXECUTE format('UPDATE public.%I SET status=''expired'' WHERE id=$1 AND owner_id=$2 AND status=''active'' AND expires_at<=statement_timestamp()',table_name) USING p_listing_id,actor;
  oldstatus:='expired';
 END IF;
 IF oldstatus IS DISTINCT FROM 'expired' THEN RAISE EXCEPTION 'Only an expired listing owned by the caller can be renewed' USING ERRCODE='42501'; END IF;
 INSERT INTO austa_private.listing_transition_grants(txid,source,listing_id) VALUES(txid_current(),p_source,p_listing_id) ON CONFLICT DO NOTHING;
 EXECUTE format('UPDATE public.%I SET status=''active'',promotion_type=CASE WHEN promotion_until>statement_timestamp() THEN promotion_type ELSE ''standard'' END,promotion_started_at=CASE WHEN promotion_until>statement_timestamp() THEN promotion_started_at ELSE NULL END,promotion_until=CASE WHEN promotion_until>statement_timestamp() THEN promotion_until ELSE NULL END WHERE id=$1 AND owner_id=$2 AND status=''expired'' RETURNING expires_at',table_name) INTO expiry USING p_listing_id,actor;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 OR expiry IS NULL THEN RAISE EXCEPTION 'Listing renewal did not complete' USING ERRCODE='40001'; END IF;
 RETURN QUERY SELECT p_listing_id,'active'::text,expiry,false;
END $$;
REVOKE ALL ON FUNCTION public.austa_renew_listing(text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.austa_renew_listing(text,uuid,uuid) TO authenticated;

-- Bounded, concurrency-safe batch worker. It is intentionally callable only by
-- service_role/pg_cron; deployments without pg_cron must schedule it externally.
CREATE TABLE IF NOT EXISTS austa_private.listing_expiry_outbox(
 source text NOT NULL,
 listing_id uuid NOT NULL,
 owner_id uuid NOT NULL,
 expired_at timestamptz NOT NULL,
 processed_at timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 PRIMARY KEY(source,listing_id)
);
ALTER TABLE austa_private.listing_expiry_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE austa_private.listing_expiry_outbox FORCE ROW LEVEL SECURITY;
REVOKE ALL ON austa_private.listing_expiry_outbox FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.austa_expire_listings_batch(p_limit integer DEFAULT 500)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE total integer:=0; n integer; src text; t text;
BEGIN
 IF p_limit<1 OR p_limit>5000 THEN RAISE EXCEPTION 'Batch limit must be 1..5000' USING ERRCODE='22023'; END IF;
 FOREACH src IN ARRAY ARRAY['vehicle','marketplace','service_provider','auto_dealer'] LOOP
  t:=CASE src WHEN 'vehicle' THEN 'vehicle_listings' WHEN 'marketplace' THEN 'marketplace_listings' WHEN 'service_provider' THEN 'service_provider_listings' ELSE 'auto_dealer_listings' END;
  EXECUTE format('WITH due AS (SELECT id,owner_id FROM public.%I WHERE status=''active'' AND expires_at<=statement_timestamp() ORDER BY expires_at,id FOR UPDATE SKIP LOCKED LIMIT $1), changed AS (UPDATE public.%I l SET status=''expired'' FROM due d WHERE l.id=d.id RETURNING l.id,l.owner_id) INSERT INTO austa_private.listing_expiry_outbox(source,listing_id,owner_id,expired_at) SELECT $2,id,owner_id,statement_timestamp() FROM changed ON CONFLICT(source,listing_id) DO NOTHING',t,t) USING p_limit,src;
  GET DIAGNOSTICS n=ROW_COUNT; total:=total+n;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.austa_expire_listings_batch(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.austa_expire_listings_batch(integer) TO service_role;

-- Provider cards, their safe view, and provider media all share this eligibility
-- predicate, so expiry takes effect immediately even before the batch runs.
CREATE OR REPLACE FUNCTION public.v355_provider_public_visible(p_listing_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(
  SELECT 1 FROM public.service_provider_listings l
  JOIN public.seller_profiles s ON s.id=l.seller_profile_id AND s.owner_id=l.owner_id AND s.business_type=l.provider_type
  JOIN public.profiles p ON p.id=l.owner_id
  WHERE l.id=p_listing_id AND l.status='active' AND l.expires_at>statement_timestamp()
   AND s.status='active' AND s.verification_status='verified' AND p.is_active
   AND ((l.provider_type='usta' AND p.role='mechanic') OR (l.provider_type='service' AND p.role='shop'))
 );
$$;
REVOKE ALL ON FUNCTION public.v355_provider_public_visible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v355_provider_public_visible(uuid) TO anon,authenticated;

-- Single, safe row contract and stable server-side ordering for web/mobile.
CREATE VIEW public.austa_public_listing_feed WITH (security_barrier=true,security_invoker=true) AS
 SELECT 'vehicle'::text AS source,CASE WHEN l.listing_type='rent' THEN 'rent' ELSE 'cars' END::text AS category,l.id,l.owner_id,l.status,l.created_at,l.published_at,l.updated_at,l.expires_at,l.promotion_type,l.promotion_started_at,l.promotion_until,l.last_boosted_at,
  CASE WHEN l.promotion_type='premium' AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() THEN 0 WHEN l.promotion_type='vip' AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() THEN 1 WHEN l.promotion_type IN ('top','standard') AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() AND l.last_boosted_at IS NOT NULL THEN 2 ELSE 3 END::integer AS sort_bucket,
  coalesce(l.last_boosted_at,l.promotion_started_at,l.published_at,l.created_at) AS sort_at,to_jsonb(l) AS payload
 FROM public.vehicle_listings l WHERE l.status='active' AND l.expires_at>statement_timestamp()
 UNION ALL
 SELECT 'marketplace',l.category,l.id,l.owner_id,l.status,l.created_at,l.published_at,l.updated_at,l.expires_at,l.promotion_type,l.promotion_started_at,l.promotion_until,l.last_boosted_at,
  CASE WHEN l.promotion_type='premium' AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() THEN 0 WHEN l.promotion_type='vip' AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() THEN 1 WHEN l.promotion_type IN ('top','standard') AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() AND l.last_boosted_at IS NOT NULL THEN 2 ELSE 3 END,
  coalesce(l.last_boosted_at,l.promotion_started_at,l.published_at,l.created_at),to_jsonb(l)
 FROM public.marketplace_listings l WHERE l.status='active' AND l.expires_at>statement_timestamp()
 UNION ALL
 SELECT 'auto_dealer','dealer',l.id,l.owner_id,l.status,l.created_at,l.published_at,l.updated_at,l.expires_at,l.promotion_type,l.promotion_started_at,l.promotion_until,l.last_boosted_at,
  CASE WHEN l.promotion_type='premium' AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() THEN 0 WHEN l.promotion_type='vip' AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() THEN 1 WHEN l.promotion_type IN ('top','standard') AND l.promotion_started_at<=statement_timestamp() AND l.promotion_until>statement_timestamp() AND l.last_boosted_at IS NOT NULL THEN 2 ELSE 3 END,
  coalesce(l.last_boosted_at,l.promotion_started_at,l.published_at,l.created_at),to_jsonb(l)
 FROM public.auto_dealer_listings l WHERE l.status='active' AND l.expires_at>statement_timestamp()
 UNION ALL
 SELECT 'service_provider',CASE WHEN p.provider_type='usta' THEN 'usta' ELSE coalesce(p.details->>'service_category','service') END,p.id,p.owner_id,p.status,p.created_at,p.published_at,p.updated_at,coalesce(p.published_at,p.created_at)+interval '30 days',p.promotion_type,p.promotion_started_at,p.promotion_until,p.last_boosted_at,
  CASE WHEN p.promotion_type='premium' AND p.promotion_started_at<=statement_timestamp() AND p.promotion_until>statement_timestamp() THEN 0 WHEN p.promotion_type='vip' AND p.promotion_started_at<=statement_timestamp() AND p.promotion_until>statement_timestamp() THEN 1 WHEN p.promotion_type IN ('top','standard') AND p.promotion_started_at<=statement_timestamp() AND p.promotion_until>statement_timestamp() AND p.last_boosted_at IS NOT NULL THEN 2 ELSE 3 END,
  coalesce(p.last_boosted_at,p.promotion_started_at,p.published_at,p.created_at),to_jsonb(p)
 FROM public.public_service_provider_listings p
 WHERE p.status='active' AND coalesce(p.published_at,p.created_at)+interval '30 days'>statement_timestamp() AND public.v355_provider_public_visible(p.id);
REVOKE ALL ON public.austa_public_listing_feed FROM PUBLIC;
GRANT SELECT ON public.austa_public_listing_feed TO anon,authenticated;

-- Supabase-hosted pg_cron runs bounded batches; no external service or paid
-- infrastructure is introduced. The outbox remains available for notifications.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
DO $$ DECLARE j record; BEGIN
 FOR j IN SELECT jobid FROM cron.job WHERE jobname='austa-listing-expiry' LOOP
  PERFORM cron.unschedule(j.jobid);
 END LOOP;
 PERFORM cron.schedule('austa-listing-expiry','*/5 * * * *','SELECT public.austa_expire_listings_batch(500);');
END $$;

COMMIT;
