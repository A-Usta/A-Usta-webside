-- P1.2A: professional seller eligibility at the existing database boundary.
-- Prepared for manual review/application; NEVER applied automatically by the app.
-- Production evidence: libfile_0380acf276e48191b6d843a53618b03e.
-- Existing trigger names, event columns, OIDs, owner/FK/type checks and ACLs remain.
-- No row backfill, automatic detachment, RLS/grant/approval/promotion change.
-- SECURITY DEFINER is necessary because browser roles cannot SELECT seller owner_id.
-- Each guard returns only NEW; auth-owner validation precedes the private lookup.
BEGIN;

-- Abort on missing/drifted bindings or an unsuitable existing function owner.
-- CREATE OR REPLACE preserves ownership; this migration does not grant read access.
DO $preflight$
DECLARE
    expected record;
    fn_oid oid;
    owner_oid oid;
    actual_columns text[];
BEGIN
    FOR expected IN
        SELECT * FROM (VALUES
            ('auto_dealer_listings','austa_auto_dealer_seller_profile_guard','austa_validate_auto_dealer_seller_profile',ARRAY['seller_profile_id','owner_id']::text[],ARRAY['d143e904f6b6d3f93c9cd315a2194489','d0263fdc71ee49bcf9cbd330a41a598c']::text[]),
            ('marketplace_listings','austa_marketplace_seller_profile_guard','austa_validate_marketplace_seller_profile',ARRAY['seller_profile_id','owner_id']::text[],ARRAY['79c4ab73045aa939169840e958e5e90a','ae2c50140bb298424c2a1c4cba13781a']::text[]),
            ('service_provider_listings','austa_service_seller_profile_guard','austa_validate_service_seller_profile',ARRAY['seller_profile_id','owner_id','provider_type']::text[],ARRAY['cd831d154f5d3914baef06c76d750e3b','4853035cb06c5f88902adddfb4de27ab']::text[]),
            ('vehicle_listings','austa_vehicle_seller_profile_guard','austa_validate_vehicle_seller_profile',ARRAY['seller_profile_id','owner_id']::text[],ARRAY['86a88af9128f2fc8b8228c3bba22e5ed','c99606411617c3d4f095a93e3f656138']::text[])
        ) AS guards(table_name,trigger_name,function_name,update_columns,accepted_bodies)
    LOOP
        fn_oid := pg_catalog.to_regprocedure('public.' || expected.function_name || '()');
        IF fn_oid IS NULL OR NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_proc p
            WHERE p.oid=fn_oid AND p.prorettype='pg_catalog.trigger'::pg_catalog.regtype
              AND p.pronargs=0 AND p.prokind='f'
        ) THEN
            RAISE EXCEPTION 'P1.2A preflight: expected trigger function missing: %', expected.function_name;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=fn_oid
              AND pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc,'[[:space:]]+','','g'))=ANY(expected.accepted_bodies)
        ) THEN
            RAISE EXCEPTION 'P1.2A preflight: function body drifted: %', expected.function_name;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_trigger t
            WHERE t.tgrelid=pg_catalog.to_regclass('public.' || expected.table_name)
              AND t.tgname=expected.trigger_name AND t.tgfoid=fn_oid
              AND t.tgtype=23 AND NOT t.tgisinternal AND t.tgenabled='O'
              AND t.tgqual IS NULL
        ) THEN
            RAISE EXCEPTION 'P1.2A preflight: trigger binding/events drifted: %', expected.trigger_name;
        END IF;
        SELECT pg_catalog.array_agg(a.attname::text ORDER BY u.position)
        INTO actual_columns
        FROM pg_catalog.pg_trigger t
        CROSS JOIN LATERAL pg_catalog.unnest(t.tgattr::smallint[]) WITH ORDINALITY AS u(attnum,position)
        JOIN pg_catalog.pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=u.attnum
        WHERE t.tgrelid=pg_catalog.to_regclass('public.' || expected.table_name)
          AND t.tgname=expected.trigger_name;
        IF actual_columns IS DISTINCT FROM expected.update_columns THEN
            RAISE EXCEPTION 'P1.2A preflight: trigger UPDATE columns drifted: %', expected.trigger_name;
        END IF;
        SELECT p.proowner INTO owner_oid FROM pg_catalog.pg_proc p WHERE p.oid=fn_oid;
        IF NOT (
            pg_catalog.has_column_privilege(owner_oid,'public.seller_profiles','id','SELECT')
            AND pg_catalog.has_column_privilege(owner_oid,'public.seller_profiles','owner_id','SELECT')
            AND pg_catalog.has_column_privilege(owner_oid,'public.seller_profiles','business_type','SELECT')
            AND pg_catalog.has_column_privilege(owner_oid,'public.seller_profiles','status','SELECT')
            AND pg_catalog.has_column_privilege(owner_oid,'public.seller_profiles','verification_status','SELECT')
            AND EXISTS (
                SELECT 1 FROM pg_catalog.pg_roles r
                CROSS JOIN pg_catalog.pg_class c
                WHERE r.oid=owner_oid AND c.oid='public.seller_profiles'::pg_catalog.regclass
                  AND (r.rolsuper OR r.rolbypassrls OR (c.relowner=owner_oid AND NOT c.relforcerowsecurity))
            )
        ) THEN
            RAISE EXCEPTION 'P1.2A preflight: existing function owner lacks authoritative seller read: %', expected.function_name;
        END IF;
    END LOOP;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.austa_validate_auto_dealer_seller_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_business_type text;
    v_invoker_role text;
BEGIN
    IF NEW.seller_profile_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Preserve privileged SQL/service-role use without treating a missing JWT
    -- from an untrusted role as authority. current_user is the definer here;
    -- the role GUC (or session_user when SET ROLE is absent) identifies the caller.
    IF auth.uid() IS NULL THEN
        v_invoker_role := NULLIF(pg_catalog.current_setting('role',true),'none');
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_roles AS r
            WHERE r.rolname=COALESCE(v_invoker_role,session_user)
              AND (r.rolsuper OR r.rolbypassrls OR EXISTS (
                  SELECT 1 FROM pg_catalog.pg_class AS c
                  WHERE c.oid='public.seller_profiles'::pg_catalog.regclass
                    AND c.relowner=r.oid AND NOT c.relforcerowsecurity
              ))
        ) THEN
            RAISE EXCEPTION 'Giriş tələb olunur.';
        END IF;
    ELSIF NEW.owner_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Seller profili tapılmadı və ya elan sahibinə məxsus deyil.';
    END IF;

    SELECT sp.business_type
    INTO v_business_type
    FROM public.seller_profiles AS sp
    WHERE sp.id = NEW.seller_profile_id
      AND sp.owner_id = NEW.owner_id
      AND sp.status = 'active'
      AND sp.verification_status = 'verified';

    IF v_business_type IS NULL THEN
        RAISE EXCEPTION
            'Seller profili tapılmadı və ya elan sahibinə məxsus deyil.';
    END IF;

    IF v_business_type <> 'dealer' THEN
        RAISE EXCEPTION
            'Avtosalon elanı yalnız Avtosalon seller profilinə bağlana bilər.';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.austa_validate_marketplace_seller_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_business_type text;
    v_invoker_role text;
BEGIN
    IF NEW.seller_profile_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Preserve privileged SQL/service-role use without treating a missing JWT
    -- from an untrusted role as authority. current_user is the definer here;
    -- the role GUC (or session_user when SET ROLE is absent) identifies the caller.
    IF auth.uid() IS NULL THEN
        v_invoker_role := NULLIF(pg_catalog.current_setting('role',true),'none');
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_roles AS r
            WHERE r.rolname=COALESCE(v_invoker_role,session_user)
              AND (r.rolsuper OR r.rolbypassrls OR EXISTS (
                  SELECT 1 FROM pg_catalog.pg_class AS c
                  WHERE c.oid='public.seller_profiles'::pg_catalog.regclass
                    AND c.relowner=r.oid AND NOT c.relforcerowsecurity
              ))
        ) THEN
            RAISE EXCEPTION 'Giriş tələb olunur.';
        END IF;
    ELSIF NEW.owner_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Seller profili tapılmadı və ya elan sahibinə məxsus deyil.';
    END IF;

    SELECT sp.business_type
    INTO v_business_type
    FROM public.seller_profiles AS sp
    WHERE sp.id = NEW.seller_profile_id
      AND sp.owner_id = NEW.owner_id
      AND sp.status = 'active'
      AND sp.verification_status = 'verified';

    IF v_business_type IS NULL THEN
        RAISE EXCEPTION
            'Seller profili tapılmadı və ya elan sahibinə məxsus deyil.';
    END IF;

    IF v_business_type <> 'store' THEN
        RAISE EXCEPTION
            'Marketplace elanı yalnız Mağaza seller profilinə bağlana bilər.';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.austa_validate_service_seller_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_business_type text;
    v_invoker_role text;
BEGIN
    IF NEW.seller_profile_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Preserve privileged SQL/service-role use without treating a missing JWT
    -- from an untrusted role as authority. current_user is the definer here;
    -- the role GUC (or session_user when SET ROLE is absent) identifies the caller.
    IF auth.uid() IS NULL THEN
        v_invoker_role := NULLIF(pg_catalog.current_setting('role',true),'none');
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_roles AS r
            WHERE r.rolname=COALESCE(v_invoker_role,session_user)
              AND (r.rolsuper OR r.rolbypassrls OR EXISTS (
                  SELECT 1 FROM pg_catalog.pg_class AS c
                  WHERE c.oid='public.seller_profiles'::pg_catalog.regclass
                    AND c.relowner=r.oid AND NOT c.relforcerowsecurity
              ))
        ) THEN
            RAISE EXCEPTION 'Giriş tələb olunur.';
        END IF;
    ELSIF NEW.owner_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Seller profili tapılmadı və ya elan sahibinə məxsus deyil.';
    END IF;

    SELECT sp.business_type
    INTO v_business_type
    FROM public.seller_profiles AS sp
    WHERE sp.id = NEW.seller_profile_id
      AND sp.owner_id = NEW.owner_id
      AND sp.status = 'active'
      AND sp.verification_status = 'verified';

    IF v_business_type IS NULL THEN
        RAISE EXCEPTION
            'Seller profili tapılmadı və ya elan sahibinə məxsus deyil.';
    END IF;

    IF NEW.provider_type = 'service'
       AND v_business_type <> 'service' THEN
        RAISE EXCEPTION
            'Servis elanı yalnız Servis seller profilinə bağlana bilər.';
    END IF;

    IF NEW.provider_type = 'usta'
       AND v_business_type <> 'usta' THEN
        RAISE EXCEPTION
            'Usta elanı yalnız Usta seller profilinə bağlana bilər.';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.austa_validate_vehicle_seller_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_business_type text;
    v_invoker_role text;
BEGIN
    IF NEW.seller_profile_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Preserve privileged SQL/service-role use without treating a missing JWT
    -- from an untrusted role as authority. current_user is the definer here;
    -- the role GUC (or session_user when SET ROLE is absent) identifies the caller.
    IF auth.uid() IS NULL THEN
        v_invoker_role := NULLIF(pg_catalog.current_setting('role',true),'none');
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_roles AS r
            WHERE r.rolname=COALESCE(v_invoker_role,session_user)
              AND (r.rolsuper OR r.rolbypassrls OR EXISTS (
                  SELECT 1 FROM pg_catalog.pg_class AS c
                  WHERE c.oid='public.seller_profiles'::pg_catalog.regclass
                    AND c.relowner=r.oid AND NOT c.relforcerowsecurity
              ))
        ) THEN
            RAISE EXCEPTION 'Giriş tələb olunur.';
        END IF;
    ELSIF NEW.owner_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Seller profili tapılmadı və ya elan sahibinə məxsus deyil.';
    END IF;

    SELECT sp.business_type
    INTO v_business_type
    FROM public.seller_profiles AS sp
    WHERE sp.id = NEW.seller_profile_id
      AND sp.owner_id = NEW.owner_id
      AND sp.status = 'active'
      AND sp.verification_status = 'verified';

    IF v_business_type IS NULL THEN
        RAISE EXCEPTION
            'Seller profili tapılmadı və ya elan sahibinə məxsus deyil.';
    END IF;

    IF v_business_type <> 'dealer' THEN
        RAISE EXCEPTION
            'Avtomobil elanı yalnız Avtosalon seller profilinə bağlana bilər.';
    END IF;

    RETURN NEW;
END;
$function$;

COMMIT;
