CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;

CREATE TABLE public.vehicle_listings(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,status text NOT NULL DEFAULT 'draft',listing_type text NOT NULL DEFAULT 'sale',
 price numeric,daily_price numeric,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.marketplace_listings(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,status text NOT NULL DEFAULT 'draft',category text NOT NULL DEFAULT 'parts',
 price numeric,currency text DEFAULT 'AZN',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.service_provider_listings(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,status text NOT NULL DEFAULT 'draft',provider_type text NOT NULL DEFAULT 'service',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.auto_dealer_listings(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,status text NOT NULL DEFAULT 'draft',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE VIEW public.public_service_provider_listings AS SELECT id FROM public.service_provider_listings WHERE status='active';
INSERT INTO auth.users VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO public.vehicle_listings(id,owner_id,status,price) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','active',10000),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','active',20000),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','draft',5000);
INSERT INTO public.marketplace_listings(id,owner_id,status,category,price) VALUES
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','active','parts',150);
INSERT INTO public.service_provider_listings VALUES
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','active','service',now(),now());
INSERT INTO public.auto_dealer_listings VALUES
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','22222222-2222-4222-8222-222222222222','active',now(),now());
