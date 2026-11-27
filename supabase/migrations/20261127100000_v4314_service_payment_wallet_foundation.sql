-- V4.3.14 payment foundation. No tariff or provider is enabled by this migration.
-- All money-moving entry points are service-role only; the mobile app can read its own wallet snapshot.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.service_orders') IS NULL OR to_regclass('public.service_order_assignments') IS NULL THEN
    RAISE EXCEPTION 'V4.3.14 requires the existing service-order tables';
  END IF;
  IF to_regclass('austa_private.promotion_payment_intents') IS NULL THEN
    RAISE EXCEPTION 'V4.3.14 requires the existing private payment-intent schema';
  END IF;
END;
$preflight$;

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unconfigured';
DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.service_orders'::regclass AND conname='service_orders_payment_method_check') THEN
    ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_payment_method_check CHECK (payment_method IN ('card','cash')) NOT VALID;
    ALTER TABLE public.service_orders VALIDATE CONSTRAINT service_orders_payment_method_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.service_orders'::regclass AND conname='service_orders_payment_status_check') THEN
    ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_payment_status_check CHECK (payment_status IN ('unconfigured','pending','paid','failed','cancelled','refunded')) NOT VALID;
    ALTER TABLE public.service_orders VALIDATE CONSTRAINT service_orders_payment_status_check;
  END IF;
END;
$constraints$;

CREATE TABLE IF NOT EXISTS austa_private.service_commission_tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_category text NOT NULL CHECK (service_category IN ('mechanic_service','tow_service','cargo_service')),
  commission_bps integer NOT NULL CHECK (commission_bps BETWEEN 0 AND 10000),
  currency text NOT NULL DEFAULT 'AZN' CHECK (currency='AZN'),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CHECK (NOT active OR commission_bps > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS service_commission_one_active_per_category
  ON austa_private.service_commission_tariffs(service_category) WHERE active;

CREATE TABLE IF NOT EXISTS austa_private.provider_wallets (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  balance_minor bigint NOT NULL DEFAULT 0 CHECK (balance_minor >= 0),
  reserved_minor bigint NOT NULL DEFAULT 0 CHECK (reserved_minor >= 0 AND reserved_minor <= balance_minor),
  currency text NOT NULL DEFAULT 'AZN' CHECK (currency='AZN'),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE austa_private.provider_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_wallets_owner_read ON austa_private.provider_wallets FOR SELECT TO authenticated USING (owner_id=auth.uid());
REVOKE ALL ON austa_private.provider_wallets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON austa_private.provider_wallets TO authenticated;

CREATE TABLE IF NOT EXISTS austa_private.service_financial_records (
  order_id uuid PRIMARY KEY REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  payment_method text NOT NULL CHECK (payment_method IN ('card','cash')),
  gross_minor bigint NOT NULL CHECK (gross_minor > 0),
  provider_earning_minor bigint NOT NULL CHECK (provider_earning_minor >= 0),
  commission_minor bigint NOT NULL CHECK (commission_minor > 0),
  currency text NOT NULL DEFAULT 'AZN' CHECK (currency='AZN'),
  status text NOT NULL CHECK (status IN ('reserved','settled','released','payment_pending','paid','failed','refunded')),
  tariff_id uuid NOT NULL REFERENCES austa_private.service_commission_tariffs(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (gross_minor=provider_earning_minor+commission_minor)
);

CREATE TABLE IF NOT EXISTS austa_private.provider_wallet_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('commission_reserved','commission_released','commission_debited','topup_pending','topup_credited','payout_pending','payout_completed','refund')),
  amount_delta_minor bigint NOT NULL,
  reserved_delta_minor bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AZN' CHECK (currency='AZN'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(owner_id,request_id,entry_type)
);
ALTER TABLE austa_private.provider_wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_wallet_ledger_owner_read ON austa_private.provider_wallet_ledger FOR SELECT TO authenticated USING (owner_id=auth.uid());
REVOKE ALL ON austa_private.provider_wallet_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON austa_private.provider_wallet_ledger TO authenticated;

CREATE OR REPLACE FUNCTION austa_private.reject_wallet_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'wallet ledger is append-only' USING ERRCODE='55000'; END;
$$;
DROP TRIGGER IF EXISTS provider_wallet_ledger_immutable ON austa_private.provider_wallet_ledger;
CREATE TRIGGER provider_wallet_ledger_immutable BEFORE UPDATE OR DELETE ON austa_private.provider_wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION austa_private.reject_wallet_ledger_mutation();

CREATE TABLE IF NOT EXISTS austa_private.payment_topup_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 100 AND 100000000),
  currency text NOT NULL DEFAULT 'AZN' CHECK (currency='AZN'),
  provider text,
  provider_payment_id text,
  request_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending_provider' CHECK (status IN ('pending_provider','paid','failed','cancelled','refunded')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(owner_id,request_id),
  UNIQUE(provider,provider_payment_id)
);

CREATE TABLE IF NOT EXISTS austa_private.saved_payment_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_token text NOT NULL,
  brand text,
  last4 char(4),
  exp_month smallint CHECK (exp_month BETWEEN 1 AND 12),
  exp_year smallint CHECK (exp_year BETWEEN 2020 AND 2200),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(provider,provider_token)
);
ALTER TABLE austa_private.saved_payment_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_payment_tokens_owner_read ON austa_private.saved_payment_tokens FOR SELECT TO authenticated USING (owner_id=auth.uid());
REVOKE ALL ON austa_private.saved_payment_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT ON austa_private.saved_payment_tokens TO authenticated;

CREATE TABLE IF NOT EXISTS austa_private.payment_provider_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  event_type text NOT NULL,
  processed_at timestamptz,
  result text NOT NULL DEFAULT 'received' CHECK (result IN ('received','processed','ignored','failed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(provider,provider_event_id)
);
REVOKE ALL ON austa_private.payment_provider_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.austa_get_my_wallet_snapshot()
RETURNS TABLE(balance_minor bigint,reserved_minor bigint,currency text,ledger jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT COALESCE(w.balance_minor,0), COALESCE(w.reserved_minor,0), COALESCE(w.currency,'AZN'),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'entry_type',l.entry_type,'amount_delta_minor',l.amount_delta_minor,'reserved_delta_minor',l.reserved_delta_minor,'currency',l.currency,'order_id',l.order_id,'created_at',l.created_at) ORDER BY l.id DESC) FROM (SELECT * FROM austa_private.provider_wallet_ledger WHERE owner_id=auth.uid() ORDER BY id DESC LIMIT 50) l),'[]'::jsonb)
  FROM (SELECT auth.uid() AS owner_id) actor
  LEFT JOIN austa_private.provider_wallets w ON w.owner_id=actor.owner_id
  WHERE actor.owner_id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.austa_get_my_wallet_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.austa_get_my_wallet_snapshot() TO authenticated;

-- Reservation is serialized on both the service order and wallet. It refuses to run
-- unless a real tariff and a server-owned agreed/final amount exist. No tariff is seeded.
CREATE OR REPLACE FUNCTION public.austa_reserve_service_commission(p_order_id uuid,p_provider_id uuid,p_request_id uuid)
RETURNS TABLE(result text,commission_minor bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.service_orders%ROWTYPE; a public.service_order_assignments%ROWTYPE; t austa_private.service_commission_tariffs%ROWTYPE;
  gross bigint; fee bigint; delta bigint; w austa_private.provider_wallets%ROWTYPE; old austa_private.service_financial_records%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.service_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR o.status NOT IN ('accepted','in_progress') THEN RAISE EXCEPTION 'order is not reservable' USING ERRCODE='PT002'; END IF;
  SELECT * INTO a FROM public.service_order_assignments WHERE order_id=p_order_id AND provider_id=p_provider_id AND status IN ('accepted','in_progress') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'provider assignment is not active' USING ERRCODE='PT002'; END IF;
  SELECT * INTO t FROM austa_private.service_commission_tariffs WHERE service_category=o.service_category AND active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'commission tariff is not configured' USING ERRCODE='PT001'; END IF;
  IF o.payment_method='card' THEN RAISE EXCEPTION 'card settlement provider is not configured' USING ERRCODE='PT001'; END IF;
  gross:=round(COALESCE(o.final_price,o.proposed_price,o.estimated_price_max)*100)::bigint;
  IF gross IS NULL OR gross<=0 THEN RAISE EXCEPTION 'agreed service price is required' USING ERRCODE='PT002'; END IF;
  fee:=ceil(gross*t.commission_bps/10000.0)::bigint;
  IF fee<=0 OR fee>=gross THEN RAISE EXCEPTION 'configured commission is not valid for this amount' USING ERRCODE='PT002'; END IF;
  SELECT * INTO old FROM austa_private.service_financial_records WHERE order_id=p_order_id FOR UPDATE;
  IF FOUND AND old.request_id=p_request_id THEN RETURN QUERY SELECT old.status,old.commission_minor; RETURN; END IF;
  IF FOUND AND old.status<>'reserved' THEN RAISE EXCEPTION 'non-reserved financial records cannot be repriced' USING ERRCODE='PT003'; END IF;
  IF FOUND AND old.provider_id<>p_provider_id THEN RAISE EXCEPTION 'provider cannot change while a reservation exists' USING ERRCODE='PT003'; END IF;
  IF FOUND AND old.gross_minor=gross AND old.tariff_id=t.id THEN RETURN QUERY SELECT old.status,old.commission_minor; RETURN; END IF;
  INSERT INTO austa_private.provider_wallets(owner_id) VALUES(p_provider_id) ON CONFLICT(owner_id) DO NOTHING;
  SELECT * INTO w FROM austa_private.provider_wallets WHERE owner_id=p_provider_id FOR UPDATE;
  delta:=CASE WHEN old.order_id IS NULL THEN fee ELSE fee-old.commission_minor END;
  IF w.balance_minor-w.reserved_minor<delta THEN RAISE EXCEPTION 'insufficient provider wallet balance' USING ERRCODE='PT004'; END IF;
  UPDATE austa_private.provider_wallets SET reserved_minor=reserved_minor+delta,updated_at=clock_timestamp() WHERE owner_id=p_provider_id;
  IF old.order_id IS NULL THEN
    INSERT INTO austa_private.service_financial_records(order_id,customer_id,provider_id,payment_method,gross_minor,provider_earning_minor,commission_minor,status,tariff_id,request_id)
      VALUES(p_order_id,o.customer_id,p_provider_id,o.payment_method,gross,gross-fee,fee,'reserved',t.id,p_request_id);
  ELSE
    UPDATE austa_private.service_financial_records SET gross_minor=gross,provider_earning_minor=gross-fee,commission_minor=fee,tariff_id=t.id,request_id=p_request_id,updated_at=clock_timestamp() WHERE order_id=p_order_id;
  END IF;
  INSERT INTO austa_private.provider_wallet_ledger(owner_id,order_id,request_id,entry_type,amount_delta_minor,reserved_delta_minor,metadata)
    VALUES(p_provider_id,p_order_id,p_request_id,'commission_reserved',0,delta,jsonb_build_object('commission_minor',fee,'previous_commission_minor',CASE WHEN old.order_id IS NULL THEN 0 ELSE old.commission_minor END,'gross_minor',gross,'tariff_id',t.id));
  RETURN QUERY SELECT 'reserved'::text,fee;
END;
$$;

CREATE OR REPLACE FUNCTION public.austa_settle_service_commission(p_order_id uuid,p_request_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r austa_private.service_financial_records%ROWTYPE; w austa_private.provider_wallets%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.service_orders WHERE id=p_order_id AND status='completed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'service order is not completed' USING ERRCODE='PT002'; END IF;
  SELECT * INTO r FROM austa_private.service_financial_records WHERE order_id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'commission reservation not found' USING ERRCODE='PT002'; END IF;
  IF r.status='settled' THEN RETURN 'settled'; END IF;
  IF r.status<>'reserved' THEN RAISE EXCEPTION 'commission is not reserved' USING ERRCODE='PT002'; END IF;
  SELECT * INTO w FROM austa_private.provider_wallets WHERE owner_id=r.provider_id FOR UPDATE;
  IF NOT FOUND OR w.balance_minor<r.commission_minor OR w.reserved_minor<r.commission_minor THEN RAISE EXCEPTION 'wallet reservation is inconsistent' USING ERRCODE='PT004'; END IF;
  UPDATE austa_private.provider_wallets SET balance_minor=balance_minor-r.commission_minor,reserved_minor=reserved_minor-r.commission_minor,updated_at=clock_timestamp() WHERE owner_id=r.provider_id;
  UPDATE austa_private.service_financial_records SET status='settled',updated_at=clock_timestamp() WHERE order_id=p_order_id;
  INSERT INTO austa_private.provider_wallet_ledger(owner_id,order_id,request_id,entry_type,amount_delta_minor,reserved_delta_minor,metadata)
    VALUES(r.provider_id,p_order_id,p_request_id,'commission_debited',-r.commission_minor,-r.commission_minor,jsonb_build_object('commission_minor',r.commission_minor));
  RETURN 'settled';
END;
$$;

CREATE OR REPLACE FUNCTION public.austa_release_service_commission(p_order_id uuid,p_request_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r austa_private.service_financial_records%ROWTYPE; w austa_private.provider_wallets%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.service_orders WHERE id=p_order_id AND status='cancelled' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'service order is not cancelled' USING ERRCODE='PT002'; END IF;
  SELECT * INTO r FROM austa_private.service_financial_records WHERE order_id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_reserved'; END IF;
  IF r.status='released' THEN RETURN 'released'; END IF;
  IF r.status<>'reserved' THEN RAISE EXCEPTION 'settled commission cannot be released' USING ERRCODE='PT002'; END IF;
  SELECT * INTO w FROM austa_private.provider_wallets WHERE owner_id=r.provider_id FOR UPDATE;
  IF NOT FOUND OR w.reserved_minor<r.commission_minor THEN RAISE EXCEPTION 'wallet reservation is inconsistent' USING ERRCODE='PT004'; END IF;
  UPDATE austa_private.provider_wallets SET reserved_minor=reserved_minor-r.commission_minor,updated_at=clock_timestamp() WHERE owner_id=r.provider_id;
  UPDATE austa_private.service_financial_records SET status='released',updated_at=clock_timestamp() WHERE order_id=p_order_id;
  INSERT INTO austa_private.provider_wallet_ledger(owner_id,order_id,request_id,entry_type,amount_delta_minor,reserved_delta_minor,metadata)
    VALUES(r.provider_id,p_order_id,p_request_id,'commission_released',0,-r.commission_minor,jsonb_build_object('commission_minor',r.commission_minor));
  RETURN 'released';
END;
$$;

REVOKE ALL ON FUNCTION public.austa_reserve_service_commission(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.austa_settle_service_commission(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.austa_release_service_commission(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.austa_reserve_service_commission(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.austa_settle_service_commission(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.austa_release_service_commission(uuid,uuid) TO service_role;

COMMIT;
