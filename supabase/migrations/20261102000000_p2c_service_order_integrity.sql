-- Local reviewed migration only. Quiesce service-order writers before DB-first rollout.
BEGIN;
DO $preflight$
DECLARE f record; c record;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'P2.C preflight: postgres deployment owner required'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('austa_p2c_price_transition','austa_p2c_append_evidence','austa_p2c_order_transition','austa_p2c_assignment_pending_guard'))
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='austa_p2c_assignment_pending_guard') THEN
    RAISE EXCEPTION 'P2.C preflight: object collision; do not overwrite';
  END IF;
  FOR c IN SELECT * FROM (VALUES
    ('service_order_assignments','id','uuid',true,'gen_random_uuid()'),
    ('service_order_assignments','order_id','uuid',true,NULL::text),
    ('service_order_assignments','provider_id','uuid',true,NULL::text),
    ('service_order_assignments','provider_type','text',true,NULL::text),
    ('service_order_assignments','status','text',true,'''offered''::text'),
    ('service_order_assignments','distance_km','numeric(10,2)',false,NULL::text),
    ('service_order_assignments','offered_at','timestamp with time zone',true,'now()'),
    ('service_order_assignments','accepted_at','timestamp with time zone',false,NULL::text),
    ('service_order_assignments','rejected_at','timestamp with time zone',false,NULL::text),
    ('service_order_assignments','completed_at','timestamp with time zone',false,NULL::text),
    ('service_order_assignments','created_at','timestamp with time zone',true,'now()'),
    ('service_order_assignments','updated_at','timestamp with time zone',true,'now()'),
    ('service_orders','id','uuid',true,'gen_random_uuid()'),
    ('service_orders','customer_id','uuid',true,NULL::text),
    ('service_orders','vehicle_id','uuid',false,NULL::text),
    ('service_orders','service_category','text',true,NULL::text),
    ('service_orders','service_description','text',false,NULL::text),
    ('service_orders','status','text',true,'''pending''::text'),
    ('service_orders','urgency','text',true,'''normal''::text'),
    ('service_orders','service_mode','text',true,'''mobile''::text'),
    ('service_orders','address','text',false,NULL::text),
    ('service_orders','region','text',false,NULL::text),
    ('service_orders','district','text',false,NULL::text),
    ('service_orders','latitude','double precision',false,NULL::text),
    ('service_orders','longitude','double precision',false,NULL::text),
    ('service_orders','estimated_price_min','numeric(12,2)',false,NULL::text),
    ('service_orders','estimated_price_max','numeric(12,2)',false,NULL::text),
    ('service_orders','final_price','numeric(12,2)',false,NULL::text),
    ('service_orders','price_status','text',true,'''unknown''::text'),
    ('service_orders','customer_note','text',false,NULL::text),
    ('service_orders','created_at','timestamp with time zone',true,'now()'),
    ('service_orders','accepted_at','timestamp with time zone',false,NULL::text),
    ('service_orders','started_at','timestamp with time zone',false,NULL::text),
    ('service_orders','completed_at','timestamp with time zone',false,NULL::text),
    ('service_orders','updated_at','timestamp with time zone',true,'now()'),
    ('service_orders','client_order_id','text',false,NULL::text),
    ('service_orders','form_version','text',false,NULL::text),
    ('service_orders','answers','jsonb',true,'''[]''::jsonb'),
    ('service_orders','evidence_files','jsonb',true,'''[]''::jsonb'),
    ('service_orders','proposed_price','numeric',false,NULL::text),
    ('service_orders','price_offered_at','timestamp with time zone',false,NULL::text),
    ('service_orders','price_responded_at','timestamp with time zone',false,NULL::text)) AS x(t,n,typ,nn,def)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass('public.'||c.t) AND a.attname=c.n AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=c.typ AND a.attnotnull=c.nn
      AND (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d WHERE d.adrelid=a.attrelid AND d.adnum=a.attnum) IS NOT DISTINCT FROM c.def) THEN
      RAISE EXCEPTION 'P2.C preflight: column drift %.%',c.t,c.n;
    END IF;
  END LOOP;
  FOR c IN SELECT * FROM (VALUES
    ('public.service_order_assignments','service_order_assignments_distance_check','CHECK (((distance_km IS NULL) OR (distance_km >= (0)::numeric)))'),
    ('public.service_order_assignments','service_order_assignments_order_id_fkey','FOREIGN KEY (order_id) REFERENCES service_orders(id) ON DELETE CASCADE'),
    ('public.service_order_assignments','service_order_assignments_pkey','PRIMARY KEY (id)'),
    ('public.service_order_assignments','service_order_assignments_provider_id_fkey','FOREIGN KEY (provider_id) REFERENCES profiles(id) ON DELETE CASCADE'),
    ('public.service_order_assignments','service_order_assignments_provider_type_check','CHECK ((provider_type = ANY (ARRAY[''mechanic''::text, ''shop''::text, ''tow''::text, ''cargo''::text])))'),
    ('public.service_order_assignments','service_order_assignments_status_check','CHECK ((status = ANY (ARRAY[''offered''::text, ''accepted''::text, ''in_progress''::text, ''rejected''::text, ''completed''::text, ''cancelled''::text])))'),
    ('public.service_order_assignments','service_order_assignments_unique_provider','UNIQUE (order_id, provider_id)'),
    ('public.service_orders','service_orders_coordinates_check','CHECK ((((latitude IS NULL) AND (longitude IS NULL)) OR (((latitude >= (''-90''::integer)::double precision) AND (latitude <= (90)::double precision)) AND ((longitude >= (''-180''::integer)::double precision) AND (longitude <= (180)::double precision)))))'),
    ('public.service_orders','service_orders_customer_id_fkey','FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE'),
    ('public.service_orders','service_orders_pkey','PRIMARY KEY (id)'),
    ('public.service_orders','service_orders_price_check','CHECK (((estimated_price_min IS NULL) OR (estimated_price_max IS NULL) OR (estimated_price_min <= estimated_price_max)))'),
    ('public.service_orders','service_orders_price_status_check','CHECK ((price_status = ANY (ARRAY[''unknown''::text, ''estimated''::text, ''offered''::text, ''confirmed''::text, ''rejected''::text, ''final''::text])))'),
    ('public.service_orders','service_orders_proposed_price_nonnegative','CHECK (((proposed_price IS NULL) OR (proposed_price >= (0)::numeric)))'),
    ('public.service_orders','service_orders_service_mode_check','CHECK ((service_mode = ANY (ARRAY[''mobile''::text, ''shop''::text])))'),
    ('public.service_orders','service_orders_status_check','CHECK ((status = ANY (ARRAY[''pending''::text, ''accepted''::text, ''in_progress''::text, ''completed''::text, ''cancelled''::text])))'),
    ('public.service_orders','service_orders_urgency_check','CHECK ((urgency = ANY (ARRAY[''normal''::text, ''urgent''::text])))'),
    ('public.service_orders','service_orders_vehicle_id_fkey','FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL')) AS x(t,n,def)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid=to_regclass(c.t) AND k.conname=c.n AND k.convalidated AND NOT k.condeferrable AND (regexp_replace(pg_get_constraintdef(k.oid),'\s','','g')=regexp_replace(c.def,'\s','','g')
      -- PostgreSQL re-parses the supplied coordinates AND group with this exact,
      -- equivalent parenthesization; accept no other serialization drift.
      OR (c.n='service_orders_coordinates_check' AND regexp_replace(pg_get_constraintdef(k.oid),'\s','','g')=regexp_replace('CHECK ((((latitude IS NULL) AND (longitude IS NULL)) OR ((latitude >= (''-90''::integer)::double precision) AND (latitude <= (90)::double precision) AND ((longitude >= (''-180''::integer)::double precision) AND (longitude <= (180)::double precision)))))','\s','','g')))) THEN
      RAISE EXCEPTION 'P2.C preflight: constraint drift %',c.n;
    END IF;
  END LOOP;
  FOR c IN SELECT * FROM (VALUES ('service_orders','trg_service_orders_updated_at'),('service_order_assignments','trg_service_order_assignments_updated_at')) AS x(t,n)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid=to_regclass('public.'||c.t) AND t.tgname=c.n AND t.tgenabled='O' AND t.tgtype=19 AND t.tgfoid=to_regprocedure('public.set_updated_at()')) THEN
      RAISE EXCEPTION 'P2.C preflight: updated-at trigger drift %',c.n;
    END IF;
    IF (NOT has_table_privilege('postgres','public.'||c.t,'SELECT') OR NOT has_table_privilege('postgres','public.'||c.t,'UPDATE')) OR NOT EXISTS(SELECT 1 FROM pg_roles r JOIN pg_class t ON t.oid=to_regclass('public.'||c.t) WHERE r.rolname='postgres' AND (r.rolsuper OR r.rolbypassrls OR (t.relowner=r.oid AND NOT t.relforcerowsecurity))) THEN
      RAISE EXCEPTION 'P2.C preflight: authoritative owner required';
    END IF;
  END LOOP;
  SELECT p.*,r.rolname INTO f FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
    WHERE p.oid=to_regprocedure('public.accept_service_order_assignment_atomic(uuid,uuid)');
  IF NOT FOUND OR NOT f.prosecdef OR f.rolname<>'postgres'
    OR f.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR pg_get_function_result(f.oid)<>'TABLE(result text, order_id uuid, assignment_id uuid)'
    OR md5(regexp_replace(f.prosrc,'\s','','g')) <> 'd740d67ba94ab9dbf69ca540d9a7bb03'
    OR has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE')
    OR NOT has_function_privilege('service_role',f.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'P2.C preflight: reviewed acceptance contract drift';
  END IF;
END;
$preflight$;

-- Remediate the reviewed acceptance cycle without changing signature, owner or ACL.
CREATE OR REPLACE FUNCTION public.accept_service_order_assignment_atomic(p_assignment_id uuid,p_provider_id uuid)
RETURNS TABLE(result text,order_id uuid,assignment_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $acceptance$
DECLARE
 v_discovery public.service_order_assignments%ROWTYPE;
 v_assignment public.service_order_assignments%ROWTYPE;
 v_locked public.service_order_assignments%ROWTYPE;
 v_order public.service_orders%ROWTYPE;
 v_discovered_order_id uuid;
 v_requested_locked boolean:=false;
 v_competing_count integer:=0;
 v_count integer;
 v_accepted_at timestamptz;
BEGIN
 -- Discovery is routing information only: no assignment row lock is retained.
 SELECT sa.* INTO v_discovery FROM public.service_order_assignments AS sa WHERE sa.id=p_assignment_id;
 IF NOT FOUND THEN RETURN QUERY SELECT 'assignment_not_found'::text,NULL::uuid,NULL::uuid; RETURN; END IF;
 v_discovered_order_id:=v_discovery.order_id;

 -- The parent is always the first retained business row lock.
 SELECT so.* INTO v_order FROM public.service_orders AS so WHERE so.id=v_discovered_order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN QUERY SELECT 'order_not_found'::text,v_discovered_order_id,p_assignment_id; RETURN; END IF;

 -- Guarded INSERTs cannot extend this set while its parent is locked.
 FOR v_locked IN
   SELECT sa.* FROM public.service_order_assignments AS sa
   WHERE sa.order_id=v_discovered_order_id AND (sa.id=p_assignment_id OR sa.status='offered')
   ORDER BY sa.id FOR UPDATE
 LOOP
   IF v_locked.id=p_assignment_id THEN
     v_assignment:=v_locked;
     v_requested_locked:=true;
   ELSIF v_locked.status='offered' THEN
     v_competing_count:=v_competing_count+1;
   END IF;
 END LOOP;

 IF NOT v_requested_locked THEN
   -- Distinguish deletion from relationship drift without locking another parent.
   PERFORM 1 FROM public.service_order_assignments AS sa WHERE sa.id=p_assignment_id;
   IF NOT FOUND THEN RETURN QUERY SELECT 'assignment_not_found'::text,NULL::uuid,NULL::uuid; RETURN; END IF;
   RAISE EXCEPTION 'Assignment relationship changed' USING ERRCODE='40001';
 END IF;
 IF v_assignment.order_id IS DISTINCT FROM v_discovered_order_id THEN
   RAISE EXCEPTION 'Assignment relationship changed' USING ERRCODE='40001';
 END IF;
 IF v_assignment.provider_id IS DISTINCT FROM p_provider_id THEN
   RETURN QUERY SELECT 'forbidden'::text,v_discovered_order_id,p_assignment_id; RETURN;
 END IF;
 IF v_assignment.status<>'offered' THEN
   RETURN QUERY SELECT 'assignment_not_offered'::text,v_discovered_order_id,p_assignment_id; RETURN;
 END IF;
 IF v_order.status<>'pending' THEN
   RETURN QUERY SELECT 'order_not_pending'::text,v_discovered_order_id,p_assignment_id; RETURN;
 END IF;

 v_accepted_at:=now();
 UPDATE public.service_orders AS so SET status='accepted',accepted_at=v_accepted_at
 WHERE so.id=v_discovered_order_id AND so.status='pending' RETURNING so.* INTO v_order;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 OR v_order.status IS DISTINCT FROM 'accepted' THEN
   RAISE EXCEPTION 'Acceptance parent invariant failed' USING ERRCODE='40001';
 END IF;
 UPDATE public.service_order_assignments AS sa SET status='accepted',accepted_at=v_accepted_at
 WHERE sa.id=p_assignment_id AND sa.order_id=v_discovered_order_id AND sa.provider_id=p_provider_id AND sa.status='offered'
 RETURNING sa.* INTO v_assignment;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 OR v_assignment.status IS DISTINCT FROM 'accepted' THEN
   RAISE EXCEPTION 'Acceptance winner invariant failed' USING ERRCODE='40001';
 END IF;
 UPDATE public.service_order_assignments AS sa SET status='cancelled'
 WHERE sa.order_id=v_discovered_order_id AND sa.id<>p_assignment_id AND sa.status='offered';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_competing_count
   OR EXISTS(SELECT 1 FROM public.service_order_assignments AS sa WHERE sa.order_id=v_discovered_order_id AND sa.status='offered')
   OR (SELECT count(*) FROM public.service_order_assignments AS sa WHERE sa.order_id=v_discovered_order_id AND sa.status='accepted')<>1 THEN
   RAISE EXCEPTION 'Acceptance competing-assignment invariant failed' USING ERRCODE='40001';
 END IF;
 RETURN QUERY SELECT 'accepted'::text,v_discovered_order_id,p_assignment_id;
END;
$acceptance$;
DO $acceptance_postcondition$
DECLARE f record;
BEGIN
 SELECT p.*,r.rolname,l.lanname INTO f FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
 JOIN pg_language l ON l.oid=p.prolang
 WHERE p.oid=to_regprocedure('public.accept_service_order_assignment_atomic(uuid,uuid)');
 IF NOT FOUND OR f.pronargs<>2 OR f.prokind<>'f' OR NOT f.proretset
   OR f.proargtypes<>'2950 2950'::oidvector
   OR pg_get_function_result(f.oid)<>'TABLE(result text, order_id uuid, assignment_id uuid)'
   OR f.rolname<>'postgres' OR NOT f.prosecdef OR f.lanname<>'plpgsql' OR f.provolatile<>'v'
   OR f.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
   OR md5(regexp_replace(f.prosrc,'\s','','g'))<>'0b2d208972a5749b1698bfbaabb23c3f'
   OR has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE')
   OR NOT has_function_privilege('service_role',f.oid,'EXECUTE')
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') THEN
   RAISE EXCEPTION 'P2.C acceptance postcondition failed';
 END IF;
END;
$acceptance_postcondition$;

-- F03. Parent first, then NOWAIT child: never wait on a child while holding its parent.
CREATE FUNCTION public.austa_p2c_price_transition(
 p_order_id uuid,p_assignment_id uuid,p_actor_id uuid,p_action text,p_price numeric,p_expected jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
DECLARE o public.service_orders%ROWTYPE; a public.service_order_assignments%ROWTYPE; ts timestamptz; n integer;
BEGIN
 IF p_actor_id IS NULL OR p_action IS NULL OR p_action NOT IN ('offer','approve','reject') THEN RAISE EXCEPTION 'Invalid price action' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order missing' USING ERRCODE='P0002'; END IF;
 IF o.status<>'accepted' THEN RAISE EXCEPTION 'Order state conflict' USING ERRCODE='40001'; END IF;
 IF p_action='offer' THEN
   SELECT * INTO a FROM public.service_order_assignments WHERE id=p_assignment_id FOR UPDATE NOWAIT;
   IF NOT FOUND OR a.order_id<>o.id OR a.provider_id<>p_actor_id OR a.status<>'accepted' THEN RAISE EXCEPTION 'Assignment authority conflict' USING ERRCODE='42501'; END IF;
 ELSE
   IF o.customer_id<>p_actor_id THEN RAISE EXCEPTION 'Customer authority conflict' USING ERRCODE='42501'; END IF;
 END IF;
 IF jsonb_typeof(p_expected) IS DISTINCT FROM 'object' OR NOT (p_expected ?& ARRAY['price_status','proposed_price','final_price','price_offered_at','price_responded_at'])
   OR (p_expected->>'price_status') IS DISTINCT FROM o.price_status
   OR (p_expected->>'proposed_price')::numeric IS DISTINCT FROM o.proposed_price
   OR (p_expected->>'final_price')::numeric IS DISTINCT FROM o.final_price
   OR (p_expected->>'price_offered_at')::timestamptz IS DISTINCT FROM o.price_offered_at
   OR (p_expected->>'price_responded_at')::timestamptz IS DISTINCT FROM o.price_responded_at THEN
   RAISE EXCEPTION 'Stale price snapshot' USING ERRCODE='40001';
 END IF;
 ts := greatest(clock_timestamp(),o.price_offered_at+interval '1 microsecond',o.price_responded_at+interval '1 microsecond');
 IF p_action='offer' THEN
   IF o.price_status IN ('confirmed','final') THEN RAISE EXCEPTION 'Price already confirmed' USING ERRCODE='40001'; END IF;
   IF p_price IS NULL OR p_price<0 OR p_price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid price' USING ERRCODE='22023'; END IF;
   UPDATE public.service_orders SET proposed_price=p_price,price_status='offered',price_offered_at=ts,price_responded_at=NULL WHERE id=o.id RETURNING * INTO o;
 ELSE
   IF o.price_status<>'offered' OR o.proposed_price IS NULL OR o.proposed_price<0 OR o.proposed_price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'No current valid offer' USING ERRCODE='40001'; END IF;
   UPDATE public.service_orders SET final_price=CASE WHEN p_action='approve' THEN o.proposed_price ELSE NULL END,
     price_status=CASE WHEN p_action='approve' THEN 'confirmed' ELSE 'rejected' END,price_responded_at=ts WHERE id=o.id RETURNING * INTO o;
 END IF;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Price row count mismatch' USING ERRCODE='40001'; END IF;
 RETURN to_jsonb(o);
END;
$body$;

-- F04. Lock and append CURRENT JSONB; retry identity is the complete frozen record.
CREATE FUNCTION public.austa_p2c_append_evidence(p_order_id uuid,p_assignment_id uuid,p_actor_id uuid,p_record jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
DECLARE o public.service_orders%ROWTYPE; a public.service_order_assignments%ROWTYPE; stage text; folder text; filename text; expected_mime text; n integer;
BEGIN
 IF p_actor_id IS NULL THEN RAISE EXCEPTION 'Actor required' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order missing' USING ERRCODE='P0002'; END IF;
 SELECT * INTO a FROM public.service_order_assignments WHERE id=p_assignment_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR a.order_id<>o.id OR a.provider_id<>p_actor_id THEN RAISE EXCEPTION 'Assignment authority conflict' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(o.evidence_files) IS DISTINCT FROM 'array' OR jsonb_typeof(p_record) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid evidence container' USING ERRCODE='22023'; END IF;
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_record) k) IS DISTINCT FROM ARRAY['assignment_id','bucket','category','content_type','path','uploaded_at']::text[]
   OR EXISTS(SELECT 1 FROM jsonb_each(p_record) e WHERE jsonb_typeof(e.value)<>'string') THEN RAISE EXCEPTION 'Invalid evidence DTO' USING ERRCODE='22023'; END IF;
 stage:=p_record->>'category';
 IF stage NOT IN ('before','after') OR p_record->>'bucket'<>'service-evidence' OR p_record->>'assignment_id'<>a.id::text THEN RAISE EXCEPTION 'Invalid evidence identity' USING ERRCODE='22023'; END IF;
 folder:=CASE WHEN nullif(btrim(o.client_order_id),'') IS NOT NULL THEN regexp_replace(btrim(o.client_order_id),'[^a-zA-Z0-9_-]','_','g') ELSE o.id::text END;
 filename:=split_part(p_record->>'path','/',4);
 IF p_record->>'path' <> o.customer_id::text||'/'||folder||'/'||stage||'/'||filename
   OR filename !~ '^[0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' THEN RAISE EXCEPTION 'Invalid evidence path' USING ERRCODE='22023'; END IF;
 expected_mime:=CASE split_part(filename,'.',2) WHEN 'jpg' THEN 'image/jpeg' WHEN 'png' THEN 'image/png' WHEN 'webp' THEN 'image/webp' END;
 IF p_record->>'content_type' IS DISTINCT FROM expected_mime OR NOT isfinite((p_record->>'uploaded_at')::timestamptz) THEN RAISE EXCEPTION 'Invalid evidence metadata' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(o.evidence_files) e WHERE e->>'path'=p_record->>'path') THEN
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(o.evidence_files) e WHERE e->>'path'=p_record->>'path' AND e IS DISTINCT FROM p_record) THEN RAISE EXCEPTION 'Evidence identity collision' USING ERRCODE='40001'; END IF;
   RETURN to_jsonb(o); -- already committed; safe reconciliation even after terminal transition
 END IF;
 IF o.status IS DISTINCT FROM (CASE WHEN stage='before' THEN 'accepted' ELSE 'in_progress' END) OR a.status<>o.status THEN RAISE EXCEPTION 'Evidence state conflict' USING ERRCODE='40001'; END IF;
 UPDATE public.service_orders SET evidence_files=o.evidence_files||jsonb_build_array(p_record) WHERE id=o.id RETURNING * INTO o;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Evidence row count mismatch' USING ERRCODE='40001'; END IF;
 RETURN to_jsonb(o);
END;
$body$;

-- F05. All related writes are one PostgreSQL statement/transaction, with no browser rollback.
CREATE FUNCTION public.austa_p2c_order_transition(p_order_id uuid,p_assignment_id uuid,p_actor_id uuid,p_action text,p_final_price numeric,p_price_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
DECLARE o public.service_orders%ROWTYPE; a public.service_order_assignments%ROWTYPE; child record; child_count integer:=0; n integer; expected text; target text; stage text; ts timestamptz:=clock_timestamp(); ps text;
BEGIN
 IF p_actor_id IS NULL OR p_action IS NULL OR p_action NOT IN ('start','complete','cancel') THEN RAISE EXCEPTION 'Invalid transition' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM public.service_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order missing' USING ERRCODE='P0002'; END IF;
 IF p_action='cancel' THEN
   IF o.customer_id<>p_actor_id THEN RAISE EXCEPTION 'Customer authority conflict' USING ERRCODE='42501'; END IF;
   IF o.status NOT IN ('pending','accepted','in_progress') THEN RAISE EXCEPTION 'Cancellation state conflict' USING ERRCODE='40001'; END IF;
   FOR child IN SELECT id FROM public.service_order_assignments WHERE order_id=o.id AND status IN ('offered','accepted','in_progress') ORDER BY id FOR UPDATE NOWAIT LOOP child_count:=child_count+1; END LOOP;
   UPDATE public.service_orders SET status='cancelled' WHERE id=o.id RETURNING * INTO o;
   GET DIAGNOSTICS n=ROW_COUNT;
   IF n<>1 THEN RAISE EXCEPTION 'Parent row count mismatch' USING ERRCODE='40001'; END IF;
   UPDATE public.service_order_assignments SET status='cancelled' WHERE order_id=o.id AND status IN ('offered','accepted','in_progress');
   GET DIAGNOSTICS n=ROW_COUNT;
   IF n<>child_count THEN RAISE EXCEPTION 'Cancellation child row count mismatch' USING ERRCODE='40001'; END IF;
   RETURN jsonb_build_object('order',to_jsonb(o));
 END IF;
 SELECT * INTO a FROM public.service_order_assignments WHERE id=p_assignment_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR a.order_id<>o.id OR a.provider_id<>p_actor_id THEN RAISE EXCEPTION 'Assignment authority conflict' USING ERRCODE='42501'; END IF;
 expected:=CASE WHEN p_action='start' THEN 'accepted' ELSE 'in_progress' END;
 target:=CASE WHEN p_action='start' THEN 'in_progress' ELSE 'completed' END;
 stage:=CASE WHEN p_action='start' THEN 'before' ELSE 'after' END;
 IF o.status<>expected OR a.status<>expected THEN RAISE EXCEPTION 'Transition state conflict' USING ERRCODE='40001'; END IF;
 IF jsonb_typeof(o.evidence_files) IS DISTINCT FROM 'array' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(o.evidence_files) e WHERE e->>'category'=stage AND e->>'assignment_id'=a.id::text AND e->>'bucket'='service-evidence' AND nullif(e->>'path','') IS NOT NULL) THEN RAISE EXCEPTION 'Required evidence missing' USING ERRCODE='40001'; END IF;
 IF p_action='start' THEN
   IF o.price_status<>'confirmed' OR o.final_price IS NULL OR o.final_price<0 OR o.final_price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Confirmed price required' USING ERRCODE='40001'; END IF;
   UPDATE public.service_orders SET status=target,started_at=ts WHERE id=o.id RETURNING * INTO o;
 ELSE
   IF p_final_price IS NOT NULL AND (p_final_price<0 OR p_final_price::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid final price' USING ERRCODE='22023'; END IF;
   IF p_price_status IS NOT NULL AND p_price_status NOT IN ('unknown','estimated','confirmed','final') THEN RAISE EXCEPTION 'Invalid price status' USING ERRCODE='22023'; END IF;
   ps:=CASE WHEN o.price_status='confirmed' THEN 'final' ELSE coalesce(p_price_status,CASE WHEN p_final_price IS NOT NULL THEN 'final' ELSE o.price_status END) END;
   IF ps NOT IN ('unknown','estimated','confirmed','final') OR (ps IN ('confirmed','final') AND coalesce(p_final_price,o.final_price) IS NULL) THEN RAISE EXCEPTION 'Final price required' USING ERRCODE='22023'; END IF;
   UPDATE public.service_orders SET status=target,completed_at=ts,price_status=ps,final_price=coalesce(p_final_price,o.final_price) WHERE id=o.id RETURNING * INTO o;
 END IF;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Parent row count mismatch' USING ERRCODE='40001'; END IF;
 UPDATE public.service_order_assignments SET status=target,completed_at=CASE WHEN p_action='complete' THEN ts ELSE completed_at END WHERE id=a.id AND provider_id=p_actor_id AND status=expected RETURNING * INTO a;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Assignment row count mismatch' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('order',to_jsonb(o),'assignment',to_jsonb(a));
END;
$body$;

-- An INSERT holds a parent SHARE lock until transaction end; stale dispatch cannot
-- create an actionable child after acceptance/cancellation. Contention fails closed.
CREATE FUNCTION public.austa_p2c_assignment_pending_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $body$
DECLARE parent_status text;
BEGIN
 SELECT status INTO parent_status FROM public.service_orders WHERE id=NEW.order_id FOR SHARE NOWAIT;
 IF NOT FOUND OR parent_status<>'pending' THEN RAISE EXCEPTION 'Assignment requires pending parent' USING ERRCODE='40001'; END IF;
 RETURN NEW;
END;
$body$;
CREATE TRIGGER austa_p2c_assignment_pending_guard BEFORE INSERT ON public.service_order_assignments
FOR EACH ROW EXECUTE FUNCTION public.austa_p2c_assignment_pending_guard();

REVOKE ALL ON FUNCTION public.austa_p2c_price_transition(uuid,uuid,uuid,text,numeric,jsonb),public.austa_p2c_append_evidence(uuid,uuid,uuid,jsonb),public.austa_p2c_order_transition(uuid,uuid,uuid,text,numeric,text),public.austa_p2c_assignment_pending_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.austa_p2c_price_transition(uuid,uuid,uuid,text,numeric,jsonb),public.austa_p2c_append_evidence(uuid,uuid,uuid,jsonb),public.austa_p2c_order_transition(uuid,uuid,uuid,text,numeric,text) TO service_role;
DO $acl$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('austa_p2c_price_transition','austa_p2c_append_evidence','austa_p2c_order_transition') LOOP
   IF has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE') OR NOT has_function_privilege('service_role',f.oid,'EXECUTE') THEN RAISE EXCEPTION 'P2.C ACL drift %',f.proname; END IF;
 END LOOP;
END;
$acl$;
COMMIT;
