-- ISOLATED TEST FIXTURE, NOT A PRODUCTION MIGRATION.
-- Minimal synthetic tables/RLS/grants model the audited contract; not a schema dump.
-- Trigger/review function bodies and trigger definitions below are transcribed from
-- user-supplied production metadata libfile_0380acf276e48191b6d843a53618b03e
-- and libfile_af6fa60524608191af6fb6b8ca767f3b. No production rows/files are included.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
CREATE TABLE public.seller_profiles (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL, business_type text NOT NULL,
 display_name text, country_code text, status text NOT NULL, verification_status text NOT NULL,
 official_status text DEFAULT 'none', official_scope text,
 verified_at timestamptz, verified_by uuid, official_reviewed_at timestamptz,
 official_reviewed_by uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
 UNIQUE(id,owner_id)
);
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_profiles_owner_select ON public.seller_profiles FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE POLICY seller_profiles_public_select ON public.seller_profiles FOR SELECT TO anon,authenticated USING(status='active' AND verification_status='verified');
GRANT SELECT(id,business_type,display_name,country_code,status,verification_status,official_status,official_scope,created_at,updated_at) ON public.seller_profiles TO authenticated,anon;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text,is_active boolean);
CREATE TABLE public.seller_verification_applications (
 id uuid PRIMARY KEY,seller_profile_id uuid,owner_id uuid,status text,
 submitted_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz,
 reviewed_at timestamptz,reviewed_by uuid,rejection_reason text
);
CREATE TABLE public.seller_profile_events (
 id uuid DEFAULT gen_random_uuid(),seller_profile_id uuid,event_type text,
 previous_status text,new_status text,previous_verification_status text,new_verification_status text,
 previous_official_status text,new_official_status text,official_scope text,actor_id uuid
);
CREATE TABLE public.vehicle_listings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL,
 seller_profile_id uuid,status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','sold','rented','archived')),
 note text,has_video boolean DEFAULT false,listing_type text,
 promotion_type text DEFAULT 'standard',promotion_started_at timestamptz,
 promotion_until timestamptz,last_boosted_at timestamptz,updated_at timestamptz DEFAULT now()
 , CONSTRAINT vehicle_listings_seller_owner_fkey FOREIGN KEY(seller_profile_id,owner_id)
 REFERENCES public.seller_profiles(id,owner_id) ON DELETE RESTRICT ON UPDATE NO ACTION
);
ALTER TABLE public.vehicle_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY listing_select ON public.vehicle_listings FOR SELECT TO authenticated USING(owner_id=auth.uid() OR status='active');
CREATE POLICY listing_insert ON public.vehicle_listings FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid());
CREATE POLICY listing_update ON public.vehicle_listings FOR UPDATE TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY listing_delete ON public.vehicle_listings FOR DELETE TO authenticated USING(owner_id=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.vehicle_listings TO authenticated;
CREATE TABLE public.marketplace_listings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL,
 seller_profile_id uuid,status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','sold','inactive','archived')),
 note text,has_video boolean DEFAULT false,listing_type text,
 promotion_type text DEFAULT 'standard',promotion_started_at timestamptz,
 promotion_until timestamptz,last_boosted_at timestamptz,updated_at timestamptz DEFAULT now()
 , CONSTRAINT marketplace_listings_seller_owner_fkey FOREIGN KEY(seller_profile_id,owner_id)
 REFERENCES public.seller_profiles(id,owner_id) ON DELETE RESTRICT ON UPDATE NO ACTION
);
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY listing_select ON public.marketplace_listings FOR SELECT TO authenticated USING(owner_id=auth.uid() OR status='active');
CREATE POLICY listing_insert ON public.marketplace_listings FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid());
CREATE POLICY listing_update ON public.marketplace_listings FOR UPDATE TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY listing_delete ON public.marketplace_listings FOR DELETE TO authenticated USING(owner_id=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.marketplace_listings TO authenticated;
CREATE TABLE public.service_provider_listings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL,
 seller_profile_id uuid,status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','inactive','archived')),
 note text,has_video boolean DEFAULT false,listing_type text,
 promotion_type text DEFAULT 'standard',promotion_started_at timestamptz,
 promotion_until timestamptz,last_boosted_at timestamptz,updated_at timestamptz DEFAULT now()
 , provider_type text NOT NULL CHECK(provider_type IN('service','usta')), CONSTRAINT service_provider_listings_seller_owner_fkey FOREIGN KEY(seller_profile_id,owner_id)
 REFERENCES public.seller_profiles(id,owner_id) ON DELETE RESTRICT ON UPDATE NO ACTION
);
ALTER TABLE public.service_provider_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY listing_select ON public.service_provider_listings FOR SELECT TO authenticated USING(owner_id=auth.uid() OR status='active');
CREATE POLICY listing_insert ON public.service_provider_listings FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid());
CREATE POLICY listing_update ON public.service_provider_listings FOR UPDATE TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY listing_delete ON public.service_provider_listings FOR DELETE TO authenticated USING(owner_id=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.service_provider_listings TO authenticated;
CREATE TABLE public.auto_dealer_listings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL,
 seller_profile_id uuid,status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','inactive','archived')),
 note text,has_video boolean DEFAULT false,listing_type text,
 promotion_type text DEFAULT 'standard',promotion_started_at timestamptz,
 promotion_until timestamptz,last_boosted_at timestamptz,updated_at timestamptz DEFAULT now()
 , CONSTRAINT auto_dealer_listings_seller_owner_fkey FOREIGN KEY(seller_profile_id,owner_id)
 REFERENCES public.seller_profiles(id,owner_id) ON DELETE RESTRICT ON UPDATE NO ACTION
);
ALTER TABLE public.auto_dealer_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY listing_select ON public.auto_dealer_listings FOR SELECT TO authenticated USING(owner_id=auth.uid() OR status='active');
CREATE POLICY listing_insert ON public.auto_dealer_listings FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid());
CREATE POLICY listing_update ON public.auto_dealer_listings FOR UPDATE TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY listing_delete ON public.auto_dealer_listings FOR DELETE TO authenticated USING(owner_id=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.auto_dealer_listings TO authenticated;

CREATE OR REPLACE FUNCTION public.austa_validate_auto_dealer_seller_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    v_business_type text;
BEGIN
    IF NEW.seller_profile_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT sp.business_type
    INTO v_business_type
    FROM public.seller_profiles AS sp
    WHERE sp.id = NEW.seller_profile_id
      AND sp.owner_id = NEW.owner_id;

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

CREATE OR REPLACE FUNCTION public.austa_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin

    new.updated_at = now();

    return new;

end;
$function$;

CREATE OR REPLACE FUNCTION public.austa_force_standard_promotion_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin

    if auth.uid() is not null then

        new.promotion_type :=
            'standard';

        new.promotion_started_at :=
            null;

        new.promotion_until :=
            null;

        new.last_boosted_at :=
            null;

    end if;

    return new;

end;
$function$;

CREATE OR REPLACE FUNCTION public.austa_protect_listing_promotion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin

    if auth.uid() is not null then

        if
            new.promotion_type
                is distinct from
                old.promotion_type

            or new.promotion_started_at
                is distinct from
                old.promotion_started_at

            or new.promotion_until
                is distinct from
                old.promotion_until

            or new.last_boosted_at
                is distinct from
                old.last_boosted_at
        then

            raise exception
                'A-USTA SECURITY: promotion yalnız təsdiqlənmiş server ödənişindən sonra dəyişdirilə bilər.';

        end if;

    end if;

    return new;

end;
$function$;

CREATE OR REPLACE FUNCTION public.austa_validate_marketplace_seller_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    v_business_type text;
BEGIN
    IF NEW.seller_profile_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT sp.business_type
    INTO v_business_type
    FROM public.seller_profiles AS sp
    WHERE sp.id = NEW.seller_profile_id
      AND sp.owner_id = NEW.owner_id;

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
 SET search_path TO ''
AS $function$
DECLARE
    v_business_type text;
BEGIN
    IF NEW.seller_profile_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT sp.business_type
    INTO v_business_type
    FROM public.seller_profiles AS sp
    WHERE sp.id = NEW.seller_profile_id
      AND sp.owner_id = NEW.owner_id;

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

CREATE OR REPLACE FUNCTION public.austa_vehicle_listings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin

    new.updated_at = now();

    return new;

end;
$function$;

CREATE OR REPLACE FUNCTION public.austa_validate_vehicle_seller_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    v_business_type text;
BEGIN
    IF NEW.seller_profile_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT sp.business_type
    INTO v_business_type
    FROM public.seller_profiles AS sp
    WHERE sp.id = NEW.seller_profile_id
      AND sp.owner_id = NEW.owner_id;

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

CREATE OR REPLACE FUNCTION public.admin_reject_seller_verification(p_seller_profile_id uuid, p_rejection_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_admin_id uuid;
    v_application_id uuid;
    v_reason text;
BEGIN
    v_admin_id := auth.uid();
    v_reason := NULLIF(
        pg_catalog.btrim(p_rejection_reason),
        ''
    );

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Giriş tələb olunur.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = v_admin_id
          AND role = 'admin'
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Admin icazəsi yoxdur.';
    END IF;

    IF v_reason IS NULL
       OR char_length(v_reason) < 3
       OR char_length(v_reason) > 1000
    THEN
        RAISE EXCEPTION
            'Rədd səbəbi 3-1000 simvol arasında olmalıdır.';
    END IF;


    -- -------------------------------------------------------
    -- Select and lock exact application
    -- -------------------------------------------------------

    SELECT
        sva.id
    INTO
        v_application_id
    FROM public.seller_verification_applications AS sva
    WHERE sva.seller_profile_id = p_seller_profile_id
      AND sva.status IN ('submitted', 'under_review')
    ORDER BY
        sva.submitted_at DESC NULLS LAST,
        sva.created_at DESC,
        sva.id DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Rədd edilə bilən seller müraciəti tapılmadı.';
    END IF;


    -- -------------------------------------------------------
    -- Authoritative internal rejection
    -- -------------------------------------------------------

    PERFORM private.reject_seller_verification_internal(
        p_seller_profile_id,
        v_application_id,
        v_admin_id
    );


    -- -------------------------------------------------------
    -- Required private rejection reason
    -- -------------------------------------------------------

    UPDATE public.seller_verification_applications
    SET
        rejection_reason = v_reason,
        updated_at = now()
    WHERE id = v_application_id
      AND seller_profile_id = p_seller_profile_id
      AND status = 'rejected';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Rədd səbəbi müraciətə yazıla bilmədi.';
    END IF;


    RETURN jsonb_build_object(
        'success', true,
        'decision', 'reject',
        'seller_profile_id', p_seller_profile_id,
        'application_id', v_application_id,
        'rejection_reason_saved', true
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_review_seller_profile(p_seller_profile_id uuid, p_decision text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_admin_id uuid;

    v_current_status text;
    v_current_verification_status text;
    v_current_official_status text;

    v_new_status text;
    v_new_verification_status text;
    v_new_official_status text;

    v_event_type text;

    v_application_id uuid;
    v_application_status text;
BEGIN
    v_admin_id := auth.uid();

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Giriş tələb olunur.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = v_admin_id
          AND role = 'admin'
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Admin icazəsi yoxdur.';
    END IF;


    -- ========================================================
    -- Direct reason-less rejection is forbidden
    -- ========================================================

    IF p_decision = 'reject' THEN
        RAISE EXCEPTION
            'Rədd qərarı səbəblə admin_reject_seller_verification funksiyası vasitəsilə verilməlidir.';
    END IF;


    -- ========================================================
    -- Lock seller
    -- ========================================================

    SELECT
        status,
        verification_status,
        official_status
    INTO
        v_current_status,
        v_current_verification_status,
        v_current_official_status
    FROM public.seller_profiles
    WHERE id = p_seller_profile_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Seller profili tapılmadı.';
    END IF;


    -- ========================================================
    -- APPROVE requires submitted/under_review application
    -- ========================================================

    IF p_decision = 'approve' THEN

        SELECT
            sva.id,
            sva.status
        INTO
            v_application_id,
            v_application_status
        FROM public.seller_verification_applications AS sva
        WHERE sva.seller_profile_id = p_seller_profile_id
          AND sva.status IN ('submitted', 'under_review')
        ORDER BY
            sva.submitted_at DESC NULLS LAST,
            sva.created_at DESC,
            sva.id DESC
        LIMIT 1
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Təsdiq üçün göndərilmiş seller müraciəti tapılmadı.';
        END IF;

        IF v_application_status = 'submitted' THEN
            UPDATE public.seller_verification_applications
            SET
                status = 'under_review',
                updated_at = now()
            WHERE id = v_application_id
              AND status = 'submitted';
        END IF;

        IF v_current_verification_status
            NOT IN ('unverified', 'pending', 'rejected')
        THEN
            RAISE EXCEPTION
                'Bu seller profili hazırkı statusdan təsdiqlənə bilməz.';
        END IF;

        UPDATE public.seller_profiles
        SET
            status = 'active',
            verification_status = 'verified',
            verified_at = now(),
            verified_by = v_admin_id,
            updated_at = now()
        WHERE id = p_seller_profile_id
        RETURNING
            status,
            verification_status,
            official_status
        INTO
            v_new_status,
            v_new_verification_status,
            v_new_official_status;

        UPDATE public.seller_verification_applications
        SET
            status = 'approved',
            reviewed_at = now(),
            reviewed_by = v_admin_id,
            rejection_reason = NULL,
            updated_at = now()
        WHERE id = v_application_id
          AND status = 'under_review';

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Seller müraciəti təsdiqlənə bilmədi.';
        END IF;

        v_event_type := 'verification_approved';


    -- ========================================================
    -- REVOKE verified seller
    -- ========================================================

    ELSIF p_decision = 'revoke' THEN

        IF v_current_verification_status <> 'verified' THEN
            RAISE EXCEPTION
                'Yalnız təsdiqlənmiş seller profilinin təsdiqi ləğv edilə bilər.';
        END IF;

        UPDATE public.seller_profiles
        SET
            status = 'suspended',
            verification_status = 'revoked',
            verified_at = NULL,
            verified_by = v_admin_id,

            official_status =
                CASE
                    WHEN official_status = 'approved'
                    THEN 'revoked'
                    ELSE official_status
                END,

            official_reviewed_at =
                CASE
                    WHEN official_status = 'approved'
                    THEN now()
                    ELSE official_reviewed_at
                END,

            official_reviewed_by =
                CASE
                    WHEN official_status = 'approved'
                    THEN v_admin_id
                    ELSE official_reviewed_by
                END,

            updated_at = now()
        WHERE id = p_seller_profile_id
        RETURNING
            status,
            verification_status,
            official_status
        INTO
            v_new_status,
            v_new_verification_status,
            v_new_official_status;

        v_event_type := 'verification_revoked';

    ELSE
        RAISE EXCEPTION
            'Qərar yalnız approve və ya revoke ola bilər.';
    END IF;


    -- ========================================================
    -- Immutable audit event
    -- ========================================================

    INSERT INTO public.seller_profile_events (
        seller_profile_id,
        event_type,

        previous_status,
        new_status,

        previous_verification_status,
        new_verification_status,

        previous_official_status,
        new_official_status,

        official_scope,
        actor_id
    )
    SELECT
        sp.id,
        v_event_type,

        v_current_status,
        v_new_status,

        v_current_verification_status,
        v_new_verification_status,

        v_current_official_status,
        v_new_official_status,

        sp.official_scope,
        v_admin_id
    FROM public.seller_profiles AS sp
    WHERE sp.id = p_seller_profile_id;


    RETURN jsonb_build_object(
        'success', true,
        'decision', p_decision,
        'seller_profile_id', p_seller_profile_id,
        'application_id', v_application_id
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_start_seller_verification_review(p_application_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_admin_id uuid;
    v_seller_profile_id uuid;
BEGIN
    v_admin_id := auth.uid();

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Giriş tələb olunur.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = v_admin_id
          AND role = 'admin'
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Admin icazəsi yoxdur.';
    END IF;

    SELECT
        sva.seller_profile_id
    INTO
        v_seller_profile_id
    FROM public.seller_verification_applications AS sva
    WHERE sva.id = p_application_id
      AND sva.status = 'submitted'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Review üçün submitted müraciət tapılmadı.';
    END IF;

    UPDATE public.seller_verification_applications
    SET
        status = 'under_review',
        updated_at = now()
    WHERE id = p_application_id
      AND status = 'submitted';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Müraciət review vəziyyətinə keçirilə bilmədi.';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'application_id', p_application_id,
        'seller_profile_id', v_seller_profile_id,
        'status', 'under_review'
    );
END;
$function$;

CREATE TRIGGER austa_auto_dealer_seller_profile_guard BEFORE INSERT OR UPDATE OF seller_profile_id, owner_id ON auto_dealer_listings FOR EACH ROW EXECUTE FUNCTION austa_validate_auto_dealer_seller_profile();

CREATE TRIGGER austa_auto_dealer_updated_at BEFORE UPDATE ON auto_dealer_listings FOR EACH ROW EXECUTE FUNCTION austa_set_updated_at();

CREATE TRIGGER austa_dealer_insert_promotion_guard BEFORE INSERT ON auto_dealer_listings FOR EACH ROW EXECUTE FUNCTION austa_force_standard_promotion_on_insert();

CREATE TRIGGER austa_dealer_promotion_guard BEFORE UPDATE ON auto_dealer_listings FOR EACH ROW EXECUTE FUNCTION austa_protect_listing_promotion();

CREATE TRIGGER austa_marketplace_insert_promotion_guard BEFORE INSERT ON marketplace_listings FOR EACH ROW EXECUTE FUNCTION austa_force_standard_promotion_on_insert();

CREATE TRIGGER austa_marketplace_promotion_guard BEFORE UPDATE ON marketplace_listings FOR EACH ROW EXECUTE FUNCTION austa_protect_listing_promotion();

CREATE TRIGGER austa_marketplace_seller_profile_guard BEFORE INSERT OR UPDATE OF seller_profile_id, owner_id ON marketplace_listings FOR EACH ROW EXECUTE FUNCTION austa_validate_marketplace_seller_profile();

CREATE TRIGGER marketplace_listings_updated_at BEFORE UPDATE ON marketplace_listings FOR EACH ROW EXECUTE FUNCTION austa_set_updated_at();

CREATE TRIGGER austa_provider_insert_promotion_guard BEFORE INSERT ON service_provider_listings FOR EACH ROW EXECUTE FUNCTION austa_force_standard_promotion_on_insert();

CREATE TRIGGER austa_provider_promotion_guard BEFORE UPDATE ON service_provider_listings FOR EACH ROW EXECUTE FUNCTION austa_protect_listing_promotion();

CREATE TRIGGER austa_service_seller_profile_guard BEFORE INSERT OR UPDATE OF seller_profile_id, owner_id, provider_type ON service_provider_listings FOR EACH ROW EXECUTE FUNCTION austa_validate_service_seller_profile();

CREATE TRIGGER service_provider_listings_updated_at BEFORE UPDATE ON service_provider_listings FOR EACH ROW EXECUTE FUNCTION austa_set_updated_at();

CREATE TRIGGER austa_vehicle_insert_promotion_guard BEFORE INSERT ON vehicle_listings FOR EACH ROW EXECUTE FUNCTION austa_force_standard_promotion_on_insert();

CREATE TRIGGER austa_vehicle_listings_updated_at_trigger BEFORE UPDATE ON vehicle_listings FOR EACH ROW EXECUTE FUNCTION austa_vehicle_listings_updated_at();

CREATE TRIGGER austa_vehicle_promotion_guard BEFORE UPDATE ON vehicle_listings FOR EACH ROW EXECUTE FUNCTION austa_protect_listing_promotion();

CREATE TRIGGER austa_vehicle_seller_profile_guard BEFORE INSERT OR UPDATE OF seller_profile_id, owner_id ON vehicle_listings FOR EACH ROW EXECUTE FUNCTION austa_validate_vehicle_seller_profile();
