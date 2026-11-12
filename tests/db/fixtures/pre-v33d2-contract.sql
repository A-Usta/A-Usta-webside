-- Isolated metadata fixture based on the read-only audit. Not production data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
CREATE TABLE public.profiles(id uuid PRIMARY KEY);
CREATE TABLE public.vehicles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,make text NOT NULL,model text NOT NULL,year integer CHECK(year BETWEEN 1886 AND 2100),engine text,fuel_type text,transmission text,vin text,plate_number text,color text,mileage integer CHECK(mileage>=0),notes text,is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own vehicles" ON public.vehicles FOR SELECT TO authenticated USING(auth.uid()=user_id);
CREATE POLICY "Users can insert their own vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK(auth.uid()=user_id);
CREATE POLICY "Users can update their own vehicles" ON public.vehicles FOR UPDATE TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
CREATE POLICY "Users can delete their own vehicles" ON public.vehicles FOR DELETE TO authenticated USING(auth.uid()=user_id);
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text NOT NULL,metadata jsonb DEFAULT '{}',UNIQUE(bucket_id,name));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;
-- Broad existing policy included deliberately: new restrictive policies must close only the new bucket.
CREATE POLICY existing_broad_storage_policy ON storage.objects FOR ALL TO authenticated,anon USING(true) WITH CHECK(true);
INSERT INTO storage.buckets(id,name,public) VALUES('listing-media','listing-media',false),('austa-kyc','austa-kyc',false);
