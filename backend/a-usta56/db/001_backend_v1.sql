-- A-USTA BACKEND V1
-- Safe extension migration. Existing service_orders/service_order_assignments are preserved.

create extension if not exists pgcrypto;

-- =========================
-- EXISTING SERVICE ORDER EXTENSIONS
-- =========================
alter table public.service_orders
  add column if not exists client_order_id text,
  add column if not exists form_version text,
  add column if not exists answers jsonb not null default '[]'::jsonb,
  add column if not exists evidence_files jsonb not null default '[]'::jsonb;

create unique index if not exists service_orders_client_order_id_uidx
  on public.service_orders (client_order_id)
  where client_order_id is not null;

-- =========================
-- PROVIDERS
-- =========================
create table if not exists public.provider_profiles (
  provider_id uuid primary key references public.profiles(id) on delete cascade,
  provider_type text not null,
  display_name text,
  bio text,
  phone text,
  region text,
  district text,
  is_online boolean not null default false,
  is_available boolean not null default false,
  verification_status text not null default 'pending',
  rating numeric(3,2),
  total_reviews integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists provider_profiles_type_idx
  on public.provider_profiles(provider_type);
create index if not exists provider_profiles_online_idx
  on public.provider_profiles(is_online, is_available);

create table if not exists public.provider_locations (
  provider_id uuid primary key references public.provider_profiles(provider_id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(provider_id) on delete cascade,
  service_category text not null,
  service_mode text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider_id, service_category, service_mode)
);

create index if not exists provider_services_category_idx
  on public.provider_services(service_category, is_active);

create table if not exists public.provider_availability (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(provider_id) on delete cascade,
  weekday smallint not null,
  start_time time,
  end_time time,
  is_closed boolean not null default false,
 unique(
  provider_id,
  weekday,
  start_time,
  end_time
)
);

-- =========================
-- VEHICLES / HISTORY
-- =========================
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  vin text,
  plate_number text,
  make text,
  model text,
  year integer,
  color text,
  mileage integer,
  fuel_type text,
  transmission text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_owner_idx on public.vehicles(owner_id);
create unique index if not exists vehicles_vin_uidx
  on public.vehicles(vin)
  where vin is not null and length(trim(vin)) > 0;

create table if not exists public.vehicle_service_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  service_order_id uuid references public.service_orders(id) on delete set null,
  provider_id uuid references public.profiles(id) on delete set null,
  service_date timestamptz not null default now(),
  service_category text,
  summary text,
  before_evidence jsonb not null default '[]'::jsonb,
  after_evidence jsonb not null default '[]'::jsonb,
  final_price numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_history_vehicle_idx
  on public.vehicle_service_history(vehicle_id, service_date desc);

create table if not exists public.vin_lookup_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  vin text not null,
  status text not null default 'pending',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- =========================
-- UNIVERSAL LISTING ENGINE
-- Only listings use this generic model. No before/after evidence here.
-- =========================
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  listing_type text not null,
  category text,
  title text not null,
  description text,
  status text not null default 'draft',
  price numeric,
  currency text not null default 'AZN',
  region text,
  district text,
  latitude double precision,
  longitude double precision,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists listings_owner_idx on public.listings(owner_id, created_at desc);
create index if not exists listings_type_status_idx on public.listings(listing_type, status, created_at desc);
create index if not exists listings_location_idx on public.listings(region, district);

create table if not exists public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_bucket text,
  storage_path text,
  media_type text not null default 'image',
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists listing_media_listing_idx
  on public.listing_media(listing_id, sort_order);

create table if not exists public.listing_promotions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  promotion_type text not null,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  price numeric,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists listing_promotions_active_idx
  on public.listing_promotions(status, expires_at desc);

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  order_type text not null default 'contact',
  status text not null default 'pending',
  amount numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- SHOPS / PARTS
-- No before/after evidence here.
-- =========================
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  phone text,
  region text,
  district text,
  address text,
  latitude double precision,
  longitude double precision,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  sku text,
  name text not null,
  description text,
  brand text,
  part_number text,
  condition text,
  price numeric,
  currency text not null default 'AZN',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_inventory (
  product_id uuid primary key references public.shop_products(id) on delete cascade,
  quantity integer not null default 0,
  reserved_quantity integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  country text,
  contact_data jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- =========================
-- RENTAL / TWO-SIDED EVIDENCE
-- This is the second place where BEFORE/AFTER evidence exists.
-- =========================
create table if not exists public.rental_listings (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  daily_rate numeric not null,
  deposit numeric not null default 0,
  mileage_limit integer,
  extra_rules jsonb not null default '{}'::jsonb,
  availability_status text not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rental_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.rental_listings(listing_id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  renter_id uuid not null references public.profiles(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  daily_rate numeric not null,
  days integer not null,
  extras jsonb not null default '[]'::jsonb,
  extras_amount numeric not null default 0,
  deposit numeric not null default 0,
  total_amount numeric not null default 0,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rental_bookings_renter_idx
  on public.rental_bookings(renter_id, start_at desc);
create index if not exists rental_bookings_owner_idx
  on public.rental_bookings(owner_id, start_at desc);

create table if not exists public.rental_inspections (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.rental_bookings(id) on delete cascade,
  inspection_type text not null,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  performed_by_role text not null,
  mileage integer,
  fuel_level text,
  notes text,
  latitude double precision,
  longitude double precision,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists rental_inspections_booking_idx
  on public.rental_inspections(booking_id, created_at desc);

create table if not exists public.rental_evidence (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.rental_inspections(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete restrict,
  uploader_role text not null,
  storage_bucket text not null default 'rental-evidence',
  storage_path text not null,
  media_type text not null default 'image',
  view_label text,
  description text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.rental_damage_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.rental_bookings(id) on delete cascade,
  inspection_id uuid references public.rental_inspections(id) on delete set null,
  reported_by uuid not null references public.profiles(id) on delete restrict,
  reported_by_role text not null,
  zone text,
  severity text,
  description text not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.rental_signoffs (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.rental_inspections(id) on delete cascade,
  signer_id uuid not null references public.profiles(id) on delete restrict,
  signer_role text not null,
  accepted boolean not null,
  comment text,
  signed_at timestamptz not null default now(),
  unique(inspection_id, signer_id)
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  context_type text not null,
  context_id uuid not null,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  description text,
  status text not null default 'open',
  resolution text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists disputes_context_idx
  on public.disputes(context_type, context_id, created_at desc);

-- =========================
-- REVIEWS / TWO-SIDED REVIEWS
-- =========================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  context_type text not null,
  context_id uuid not null,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  reviewee_id uuid not null references public.profiles(id) on delete restrict,
  rating integer not null check (rating between 1 and 5),
  dimensions jsonb not null default '{}'::jsonb,
  comment text,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  unique(context_type, context_id, reviewer_id, reviewee_id)
);

create index if not exists reviews_reviewee_idx
  on public.reviews(reviewee_id, created_at desc);

-- =========================
-- KYC
-- =========================
create table if not exists public.kyc_requests (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.profiles(id) on delete cascade,
  subject_role text not null,
  status text not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.kyc_documents (
  id uuid primary key default gen_random_uuid(),
  kyc_request_id uuid not null references public.kyc_requests(id) on delete cascade,
  storage_bucket text not null default 'kyc-documents',
  storage_path text not null,
  document_type text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- =========================
-- NOTIFICATIONS
-- =========================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications(user_id, is_read, created_at desc);

-- =========================
-- PAYMENTS / TRANSACTIONS
-- Gateway integration is intentionally decoupled.
-- =========================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  context_type text not null,
  context_id uuid,
  amount numeric not null,
  currency text not null default 'AZN',
  status text not null default 'pending',
  provider text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  transaction_type text not null,
  amount numeric not null,
  status text not null default 'pending',
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================
-- AUDIT
-- =========================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx
  on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs(actor_id, created_at desc);

-- =========================
-- UPDATED-AT TRIGGER
-- =========================
create or replace function public.austa_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply only to V1 tables that have updated_at.
do $$
declare
  t text;
begin
  foreach t in array array[
    'provider_profiles',
    'vehicles',
    'listings',
    'marketplace_orders',
    'shops',
    'shop_products',
    'rental_listings',
    'rental_bookings',
    'payments'
  ] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.austa_set_updated_at()', t, t);
  end loop;
end $$;

-- =========================
-- RLS: API-only tables are locked down for direct client access.
-- Service role used by the backend bypasses these policies.
-- =========================
do $$
declare
  t text;
begin
  foreach t in array array[
    'provider_profiles','provider_locations','provider_services','provider_availability',
    'vehicles','vehicle_service_history','vin_lookup_requests',
    'listings','listing_media','listing_promotions','marketplace_orders',
    'shops','shop_products','shop_inventory','suppliers',
    'rental_listings','rental_bookings','rental_inspections','rental_evidence','rental_damage_reports','rental_signoffs',
    'disputes','reviews','kyc_requests','kyc_documents','notifications',
    'payments','payment_transactions','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- =========================
-- NEARBY PROVIDER FUNCTION
-- Compact GPS dispatch helper without requiring PostGIS.
-- =========================
create or replace function public.austa_find_nearby_providers(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision default 25,
  p_provider_type text default null
)
returns table (
  provider_id uuid,
  provider_type text,
  display_name text,
  latitude double precision,
  longitude double precision,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from (
    select
      p.provider_id,
      p.provider_type,
      p.display_name,
      l.latitude,
      l.longitude,
      6371.0 * acos(
        least(
          1.0,
          greatest(
            -1.0,
            cos(radians(p_latitude)) *
            cos(radians(l.latitude)) *
            cos(radians(l.longitude) - radians(p_longitude)) +
            sin(radians(p_latitude)) *
            sin(radians(l.latitude))
          )
        )
      ) as distance_km
    from public.provider_profiles p
    join public.provider_locations l
      on l.provider_id = p.provider_id
    where p.is_online = true
      and p.is_available = true
      and p.verification_status = 'approved'
      and (p_provider_type is null or p.provider_type = p_provider_type)
  ) nearby
  where nearby.distance_km <= p_radius_km
  order by nearby.distance_km asc;
$$;

-- Restrict nearby-provider lookup to the backend service role.
REVOKE ALL ON FUNCTION
  public.austa_find_nearby_providers(
    double precision,
    double precision,
    double precision,
    text
  )
FROM PUBLIC;

REVOKE ALL ON FUNCTION
  public.austa_find_nearby_providers(
    double precision,
    double precision,
    double precision,
    text
  )
FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.austa_find_nearby_providers(
    double precision,
    double precision,
    double precision,
    text
  )
TO service_role;
