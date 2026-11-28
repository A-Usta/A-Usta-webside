-- Attach cash wallet reservation/debit/release to the existing atomic order lifecycle.
-- Card orders are rejected by austa_reserve_service_commission until a split-settlement provider exists.
BEGIN;

CREATE OR REPLACE FUNCTION austa_private.apply_service_order_financial_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
  v_record austa_private.service_financial_records%ROWTYPE;
  v_provider uuid;
BEGIN
  IF TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='service_order_assignments' THEN
    IF NEW.status='accepted' AND OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM 1 FROM public.austa_reserve_service_commission(NEW.order_id,NEW.provider_id,gen_random_uuid());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status='cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO v_record FROM austa_private.service_financial_records WHERE order_id=NEW.id FOR UPDATE;
    IF FOUND AND v_record.status='reserved' THEN
      PERFORM public.austa_release_service_commission(NEW.id,gen_random_uuid());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO v_record FROM austa_private.service_financial_records WHERE order_id=NEW.id FOR UPDATE;
    IF FOUND AND v_record.status='reserved' THEN
      PERFORM public.austa_settle_service_commission(NEW.id,gen_random_uuid());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('accepted','in_progress')
    AND (NEW.proposed_price IS DISTINCT FROM OLD.proposed_price OR NEW.final_price IS DISTINCT FROM OLD.final_price) THEN
    SELECT fr.provider_id INTO v_provider
    FROM austa_private.service_financial_records fr
    WHERE fr.order_id=NEW.id AND fr.status='reserved'
    FOR UPDATE;
    IF FOUND THEN
      PERFORM 1 FROM public.austa_reserve_service_commission(NEW.id,v_provider,gen_random_uuid());
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION austa_private.apply_service_order_financial_lifecycle() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS service_order_assignment_wallet_reservation ON public.service_order_assignments;
CREATE TRIGGER service_order_assignment_wallet_reservation
  AFTER UPDATE OF status ON public.service_order_assignments
  FOR EACH ROW EXECUTE FUNCTION austa_private.apply_service_order_financial_lifecycle();
DROP TRIGGER IF EXISTS service_order_wallet_settlement ON public.service_orders;
CREATE TRIGGER service_order_wallet_settlement
  AFTER UPDATE OF status,proposed_price,final_price ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION austa_private.apply_service_order_financial_lifecycle();

COMMIT;
