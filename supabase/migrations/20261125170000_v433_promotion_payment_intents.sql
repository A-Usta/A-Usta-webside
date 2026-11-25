-- V4.3.3: provider-neutral payment intent preparation. This migration does not
-- call a payment provider or activate a listing; only a verified provider event
-- may be added in a later server-side integration.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('austa_private.v36_listing_exists(text,uuid,boolean)') IS NULL THEN
    RAISE EXCEPTION 'V4.3.3 requires the V3.6 listing ownership contract';
  END IF;
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'V4.3.3 requires Supabase Auth';
  END IF;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS austa_private.promotion_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_source text NOT NULL CHECK (listing_source IN ('vehicle','marketplace','service_provider','auto_dealer')),
  listing_id uuid NOT NULL,
  plan_code text NOT NULL CHECK (plan_code IN (
    'boost_3','boost_9','boost_15','boost_30',
    'vip_1d','vip_5d','vip_15d','vip_30d',
    'premium_1d','premium_5d','premium_15d','premium_30d'
  )),
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL DEFAULT 'AZN' CHECK (currency='AZN'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled','refunded')),
  provider text,
  provider_payment_id text,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  paid_at timestamptz,
  UNIQUE(owner_id,request_id),
  UNIQUE(provider,provider_payment_id),
  CHECK ((status='paid')=(paid_at IS NOT NULL))
);
ALTER TABLE austa_private.promotion_payment_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON austa_private.promotion_payment_intents FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.austa_create_promotion_payment_intent(
  p_source text,p_listing_id uuid,p_plan_code text,p_request_id uuid
)
RETURNS TABLE(intent_id uuid,amount_minor integer,currency text,status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
  actor uuid:=auth.uid();
  plan_amount integer;
  listing_owner uuid;
  existing austa_private.promotion_payment_intents%ROWTYPE;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Ödəniş sorğusu üçün hesabınıza daxil olun' USING ERRCODE='28000'; END IF;
  IF p_request_id IS NULL OR p_listing_id IS NULL OR p_source NOT IN ('vehicle','marketplace','service_provider','auto_dealer') THEN
    RAISE EXCEPTION 'Ödəniş sorğusunun məlumatları yanlışdır' USING ERRCODE='22023';
  END IF;
  plan_amount:=CASE p_plan_code
    WHEN 'boost_3' THEN 99 WHEN 'boost_9' THEN 149 WHEN 'boost_15' THEN 199 WHEN 'boost_30' THEN 299
    WHEN 'vip_1d' THEN 149 WHEN 'vip_5d' THEN 399 WHEN 'vip_15d' THEN 799 WHEN 'vip_30d' THEN 1299
    WHEN 'premium_1d' THEN 249 WHEN 'premium_5d' THEN 699 WHEN 'premium_15d' THEN 1499 WHEN 'premium_30d' THEN 2499
    ELSE NULL END;
  IF plan_amount IS NULL THEN RAISE EXCEPTION 'Tarif seçimi yanlışdır' USING ERRCODE='22023'; END IF;
  SELECT l.owner_id INTO listing_owner FROM austa_private.v36_listing_exists(p_source,p_listing_id,true) l;
  IF listing_owner IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Aktiv elan sizə məxsus deyil' USING ERRCODE='42501'; END IF;
  INSERT INTO austa_private.promotion_payment_intents(owner_id,listing_source,listing_id,plan_code,amount_minor,request_id)
    VALUES(actor,p_source,p_listing_id,p_plan_code,plan_amount,p_request_id)
    ON CONFLICT(owner_id,request_id) DO NOTHING;
  SELECT i.* INTO existing FROM austa_private.promotion_payment_intents i WHERE i.owner_id=actor AND i.request_id=p_request_id;
  IF existing.listing_source<>p_source OR existing.listing_id<>p_listing_id OR existing.plan_code<>p_plan_code OR existing.amount_minor<>plan_amount THEN
    RAISE EXCEPTION 'Sorğu identifikatoru başqa tarif üçün istifadə olunub' USING ERRCODE='22023';
  END IF;
  -- Intent is always pending here. No client-callable RPC confirms payment or
  -- mutates listing promotion fields; provider verification is not configured.
  RETURN QUERY SELECT existing.id,existing.amount_minor,existing.currency,existing.status;
END;
$fn$;

REVOKE ALL ON FUNCTION public.austa_create_promotion_payment_intent(text,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.austa_create_promotion_payment_intent(text,uuid,text,uuid) TO authenticated;

COMMIT;
