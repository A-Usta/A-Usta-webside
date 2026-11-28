-- V4.3.14 reservation idempotency and no-op repricing correction.
BEGIN;
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
COMMIT;
