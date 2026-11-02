-- Isolated contract: exact supplied column/constraint/acceptance definitions.
-- profiles/vehicles are minimal FK stubs; no production data or credentials.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.profiles(id uuid PRIMARY KEY);
CREATE TABLE public.vehicles(id uuid PRIMARY KEY);
CREATE TABLE public.service_orders (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL,
 vehicle_id uuid,
 service_category text NOT NULL,
 service_description text,
 status text NOT NULL DEFAULT 'pending'::text,
 urgency text NOT NULL DEFAULT 'normal'::text,
 service_mode text NOT NULL DEFAULT 'mobile'::text,
 address text,
 region text,
 district text,
 latitude double precision,
 longitude double precision,
 estimated_price_min numeric(12,2),
 estimated_price_max numeric(12,2),
 final_price numeric(12,2),
 price_status text NOT NULL DEFAULT 'unknown'::text,
 customer_note text,
 created_at timestamp with time zone NOT NULL DEFAULT now(),
 accepted_at timestamp with time zone,
 started_at timestamp with time zone,
 completed_at timestamp with time zone,
 updated_at timestamp with time zone NOT NULL DEFAULT now(),
 client_order_id text,
 form_version text,
 answers jsonb NOT NULL DEFAULT '[]'::jsonb,
 evidence_files jsonb NOT NULL DEFAULT '[]'::jsonb,
 proposed_price numeric,
 price_offered_at timestamp with time zone,
 price_responded_at timestamp with time zone
);
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_coordinates_check CHECK ((((latitude IS NULL) AND (longitude IS NULL)) OR (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision)) AND ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))));
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_price_check CHECK (((estimated_price_min IS NULL) OR (estimated_price_max IS NULL) OR (estimated_price_min <= estimated_price_max)));
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_price_status_check CHECK ((price_status = ANY (ARRAY['unknown'::text, 'estimated'::text, 'offered'::text, 'confirmed'::text, 'rejected'::text, 'final'::text])));
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_proposed_price_nonnegative CHECK (((proposed_price IS NULL) OR (proposed_price >= (0)::numeric)));
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_service_mode_check CHECK ((service_mode = ANY (ARRAY['mobile'::text, 'shop'::text])));
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_urgency_check CHECK ((urgency = ANY (ARRAY['normal'::text, 'urgent'::text])));
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
CREATE TABLE public.service_order_assignments (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL,
 provider_id uuid NOT NULL,
 provider_type text NOT NULL,
 status text NOT NULL DEFAULT 'offered'::text,
 distance_km numeric(10,2),
 offered_at timestamp with time zone NOT NULL DEFAULT now(),
 accepted_at timestamp with time zone,
 rejected_at timestamp with time zone,
 completed_at timestamp with time zone,
 created_at timestamp with time zone NOT NULL DEFAULT now(),
 updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.service_order_assignments ADD CONSTRAINT service_order_assignments_distance_check CHECK (((distance_km IS NULL) OR (distance_km >= (0)::numeric)));
ALTER TABLE public.service_order_assignments ADD CONSTRAINT service_order_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES service_orders(id) ON DELETE CASCADE;
ALTER TABLE public.service_order_assignments ADD CONSTRAINT service_order_assignments_pkey PRIMARY KEY (id);
ALTER TABLE public.service_order_assignments ADD CONSTRAINT service_order_assignments_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.service_order_assignments ADD CONSTRAINT service_order_assignments_provider_type_check CHECK ((provider_type = ANY (ARRAY['mechanic'::text, 'shop'::text, 'tow'::text, 'cargo'::text])));
ALTER TABLE public.service_order_assignments ADD CONSTRAINT service_order_assignments_status_check CHECK ((status = ANY (ARRAY['offered'::text, 'accepted'::text, 'in_progress'::text, 'rejected'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE public.service_order_assignments ADD CONSTRAINT service_order_assignments_unique_provider UNIQUE (order_id, provider_id);
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $f$ begin new.updated_at=now(); return new; end; $f$;
CREATE TRIGGER trg_service_order_assignments_updated_at BEFORE UPDATE ON public.service_order_assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_service_orders_updated_at BEFORE UPDATE ON public.service_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.service_orders,public.service_order_assignments TO service_role;
CREATE OR REPLACE FUNCTION public.accept_service_order_assignment_atomic(p_assignment_id uuid, p_provider_id uuid)
 RETURNS TABLE(result text, order_id uuid, assignment_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_assignment public.service_order_assignments%rowtype;
  v_order public.service_orders%rowtype;
  v_accepted_at timestamptz;
begin

  /*
   * ----------------------------------------------------------
   * Assignment-i lock et.
   * ----------------------------------------------------------
   */

  select assignment_row.*
  into v_assignment
  from public.service_order_assignments
    as assignment_row
  where
    assignment_row.id =
      p_assignment_id
  for update;

  if not found then
    return query
    select
      'assignment_not_found'::text,
      null::uuid,
      null::uuid;

    return;
  end if;

  /*
   * ----------------------------------------------------------
   * Provider yalnız öz assignment-ini qəbul edə bilər.
   * ----------------------------------------------------------
   */

  if
    v_assignment.provider_id <>
    p_provider_id
  then
    return query
    select
      'forbidden'::text,
      v_assignment.order_id,
      v_assignment.id;

    return;
  end if;

  /*
   * ----------------------------------------------------------
   * Yalnız offered assignment qəbul edilə bilər.
   * ----------------------------------------------------------
   */

  if
    v_assignment.status <>
    'offered'
  then
    return query
    select
      'assignment_not_offered'::text,
      v_assignment.order_id,
      v_assignment.id;

    return;
  end if;

  /*
   * ----------------------------------------------------------
   * Order-i lock et.
   * ----------------------------------------------------------
   */

  select order_row.*
  into v_order
  from public.service_orders
    as order_row
  where
    order_row.id =
      v_assignment.order_id
  for update;

  if not found then
    return query
    select
      'order_not_found'::text,
      v_assignment.order_id,
      v_assignment.id;

    return;
  end if;

  /*
   * ----------------------------------------------------------
   * Yalnız pending order qəbul edilə bilər.
   * ----------------------------------------------------------
   */

  if
    v_order.status <>
    'pending'
  then
    return query
    select
      'order_not_pending'::text,
      v_assignment.order_id,
      v_assignment.id;

    return;
  end if;

  v_accepted_at :=
    now();

  /*
   * ----------------------------------------------------------
   * Order -> accepted
   * ----------------------------------------------------------
   */

  update public.service_orders
    as order_row
  set
    status = 'accepted',
    accepted_at = v_accepted_at
  where
    order_row.id =
      v_assignment.order_id;

  /*
   * ----------------------------------------------------------
   * Winning assignment -> accepted
   * ----------------------------------------------------------
   */

  update public.service_order_assignments
    as assignment_row
  set
    status = 'accepted',
    accepted_at = v_accepted_at
  where
    assignment_row.id =
      v_assignment.id;

  /*
   * ----------------------------------------------------------
   * Digər offered assignment-lər -> cancelled
   *
   * Alias burada order_id ambiguity problemini aradan qaldırır.
   * ----------------------------------------------------------
   */

  update public.service_order_assignments
    as other_assignment
  set
    status = 'cancelled'
  where
    other_assignment.order_id =
      v_assignment.order_id
    and other_assignment.status =
      'offered'
    and other_assignment.id <>
      v_assignment.id;

  /*
   * ----------------------------------------------------------
   * Uğurlu nəticə.
   * ----------------------------------------------------------
   */

  return query
  select
    'accepted'::text,
    v_assignment.order_id,
    v_assignment.id;

end;
$function$
;
REVOKE ALL ON FUNCTION public.accept_service_order_assignment_atomic(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_service_order_assignment_atomic(uuid,uuid) TO service_role;
