-- P1.2A.1: authenticated owned eligible seller selector, not a public search.
-- Manual review/application only. No table grants, RLS or listing guard changes.
BEGIN;

DO $preflight$
DECLARE
    existing_oid oid;
    owner_oid oid;
BEGIN
    -- Refuse ambiguous/colliding names, including unexpected overloads.
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname='get_my_seller_profiles'
          AND (p.pronargs<>0 OR p.prokind<>'f')
    ) THEN
        RAISE EXCEPTION 'P1.2A.1 preflight: RPC name collision';
    END IF;
    existing_oid := pg_catalog.to_regprocedure('public.get_my_seller_profiles()');
    IF existing_oid IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_language l ON l.oid=p.prolang
        WHERE p.oid=existing_oid
          AND p.pronargs=0 AND p.prokind='f'
          AND p.prosecdef AND p.provolatile='s' AND l.lanname='plpgsql'
          AND NOT p.proleakproof AND NOT p.proisstrict
          AND p.proparallel='u' AND p.prosupport=0
          -- PostgreSQL stores SET search_path TO '' as search_path="".
          -- Require that sole explicit setting; NULL and every nonempty path fail.
          AND p.proconfig=ARRAY['search_path=""']::text[]
          AND p.proretset AND p.prorettype='pg_catalog.record'::pg_catalog.regtype
          AND p.proargnames=ARRAY['id','business_type','display_name','status',
              'verification_status','official_status','official_scope']::text[]
          AND p.proallargtypes=ARRAY['uuid'::regtype::oid,'text'::regtype::oid,
              'text'::regtype::oid,'text'::regtype::oid,'text'::regtype::oid,
              'text'::regtype::oid,'text'::regtype::oid]
          AND p.proargmodes=ARRAY['t','t','t','t','t','t','t']::"char"[]
          AND pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc,'[[:space:]]+','','g'))='d9879800f579559c93c10a9f724b8412'
    ) THEN
        RAISE EXCEPTION 'P1.2A.1 preflight: existing RPC contract/body drift';
    END IF;
    IF existing_oid IS NULL THEN
        SELECT oid INTO owner_oid FROM pg_catalog.pg_roles WHERE rolname=current_user;
    ELSE
        SELECT proowner INTO owner_oid FROM pg_catalog.pg_proc WHERE oid=existing_oid;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles r
        JOIN pg_catalog.pg_class c ON c.oid='public.seller_profiles'::regclass
        WHERE r.oid=owner_oid
          AND (r.rolsuper OR r.rolbypassrls
               OR (c.relowner=owner_oid AND NOT c.relforcerowsecurity))
    ) OR EXISTS (
        SELECT 1 FROM pg_catalog.unnest(ARRAY['id','owner_id','business_type',
            'display_name','status','verification_status','official_status','official_scope']) AS required(column_name)
        WHERE NOT pg_catalog.has_column_privilege(owner_oid,
            'public.seller_profiles',required.column_name,'SELECT')
    ) THEN
        RAISE EXCEPTION 'P1.2A.1 preflight: RPC owner lacks authoritative seller read';
    END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.get_my_seller_profiles()
RETURNS TABLE (
    id uuid,
    business_type text,
    display_name text,
    status text,
    verification_status text,
    official_status text,
    official_scope text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
    END IF;

    RETURN QUERY
    SELECT sp.id, sp.business_type::text, sp.display_name::text,
           sp.status::text, sp.verification_status::text,
           sp.official_status::text, sp.official_scope::text
    FROM public.seller_profiles AS sp
    WHERE sp.owner_id = auth.uid()
      AND sp.status = 'active'
      AND sp.verification_status = 'verified'
    ORDER BY sp.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_seller_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_seller_profiles() TO authenticated;

-- Catch inherited/default privileges that would defeat the intended role boundary.
DO $privileges$
BEGIN
    IF pg_catalog.has_function_privilege('anon','public.get_my_seller_profiles()','EXECUTE')
       OR NOT pg_catalog.has_function_privilege('authenticated','public.get_my_seller_profiles()','EXECUTE') THEN
        RAISE EXCEPTION 'P1.2A.1: unexpected RPC execution privileges';
    END IF;
END;
$privileges$;

COMMIT;
