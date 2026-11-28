-- Keep historical vehicle amounts as AZN (the legacy mobile form input was AZN).
-- New listings can persist their original AZN/USD/EUR currency without changing amounts.
ALTER TABLE public.vehicle_listings
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'AZN';

ALTER TABLE public.vehicle_listings
  DROP CONSTRAINT IF EXISTS vehicle_listings_currency_check;
ALTER TABLE public.vehicle_listings
  ADD CONSTRAINT vehicle_listings_currency_check CHECK (currency IN ('AZN', 'USD', 'EUR'));

ALTER TABLE public.marketplace_listings
  DROP CONSTRAINT IF EXISTS marketplace_listings_currency_check;
ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_currency_check CHECK (currency IN ('AZN', 'USD', 'EUR'));

CREATE OR REPLACE FUNCTION austa_private.v36_track_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s text; old_price numeric; new_price numeric; old_currency text; new_currency text; event_time timestamptz;
BEGIN
 s:=CASE TG_TABLE_NAME WHEN 'vehicle_listings' THEN 'vehicle' ELSE 'marketplace' END;
 IF s='vehicle' THEN
  old_price:=COALESCE(OLD.daily_price,OLD.price); new_price:=COALESCE(NEW.daily_price,NEW.price);
  old_currency:=COALESCE(OLD.currency,'AZN'); new_currency:=COALESCE(NEW.currency,'AZN');
 ELSE old_price:=OLD.price; new_price:=NEW.price; old_currency:=OLD.currency; new_currency:=NEW.currency; END IF;
 IF NEW.status<>'active' OR new_price IS NULL OR new_price<0 THEN RETURN NEW; END IF;
 event_time:=COALESCE(NEW.updated_at,clock_timestamp());
 IF TG_OP='INSERT' THEN
  INSERT INTO austa_private.listing_price_history(listing_source,listing_id,price,currency,changed_at,initial_known) VALUES(s,NEW.id,new_price,new_currency,event_time,true) ON CONFLICT DO NOTHING;
 ELSIF OLD.status<>'active' THEN
  INSERT INTO austa_private.listing_price_history(listing_source,listing_id,price,currency,changed_at,initial_known) VALUES(s,NEW.id,new_price,new_currency,event_time,true) ON CONFLICT DO NOTHING;
 ELSIF old_price IS DISTINCT FROM new_price OR old_currency IS DISTINCT FROM new_currency THEN
  INSERT INTO austa_private.listing_price_history(listing_source,listing_id,price,currency,changed_at,initial_known) VALUES(s,NEW.id,new_price,new_currency,event_time,false) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END;
$function$;
