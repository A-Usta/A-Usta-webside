-- A-USTA-TEST ONLY. All fixtures and temporary synthetic role changes roll back.
-- Owner c357... is the pre-existing synthetic provider. Never run against production.
BEGIN;
SET LOCAL statement_timeout='8s';
SET LOCAL lock_timeout='2s';
INSERT INTO public.service_provider_listings(id,owner_id,seller_profile_id,provider_type,status,title)
VALUES('37b7744e-4f75-4b08-ae2d-e37b868d1201','c3572e93-bfbf-4174-9e49-a4403b1146b0','c650b780-0d93-4a48-99c9-081f44e2a4f9','usta','active','TEST-V356-ROLLBACK-ONLY');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','c3572e93-bfbf-4174-9e49-a4403b1146b0',true);
SELECT * FROM public.v355_apply_map_publication('37b7744e-4f75-4b08-ae2d-e37b868d1201',0,'37b7744e-4f75-4b08-ae2d-e37b868d1202',true,true,'TEST-V356-ROLLBACK-ONLY','Bakı','TEST workplace',NULL,40.4093,49.8671,'business',ARRAY['repair']);
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.discover_public_providers(40.38,49.84,40.44,49.90,'TEST-V356-ROLLBACK-ONLY','',false,0,'usta'))<>1 THEN RAISE EXCEPTION 'ANON_USTA_DISCOVERY_FAILED';END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','37b7744e-4f75-4b08-ae2d-e37b868d1299',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.provider_map_publications WHERE listing_id='37b7744e-4f75-4b08-ae2d-e37b868d1201') THEN RAISE EXCEPTION 'CROSS_USER_RLS_LEAK';END IF;
 BEGIN
  PERFORM * FROM public.v355_apply_map_publication('37b7744e-4f75-4b08-ae2d-e37b868d1201',1,'37b7744e-4f75-4b08-ae2d-e37b868d1203',false);
  RAISE EXCEPTION 'CROSS_USER_MUTATION_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','c3572e93-bfbf-4174-9e49-a4403b1146b0',true);
SELECT * FROM public.v355_apply_map_publication('37b7744e-4f75-4b08-ae2d-e37b868d1201',1,'37b7744e-4f75-4b08-ae2d-e37b868d1204',false);
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.discover_public_providers(40.38,49.84,40.44,49.90,'TEST-V356-ROLLBACK-ONLY','',false,0,'usta'))THEN RAISE EXCEPTION 'REVOKED_VISIBLE';END IF;
END $$;
RESET ROLE;
-- Temporary synthetic role only, no auth user creation, no committed role changes.
SELECT set_config('request.jwt.claim.sub','',true);
UPDATE public.profiles SET role='shop' WHERE id='c3572e93-bfbf-4174-9e49-a4403b1146b0';
INSERT INTO public.seller_profiles(id,owner_id,business_type,display_name,status,verification_status)
VALUES('37b7744e-4f75-4b08-ae2d-e37b868d1210','c3572e93-bfbf-4174-9e49-a4403b1146b0','service','TEST-V356-ROLLBACK-ONLY','active','verified');
INSERT INTO public.service_provider_listings(id,owner_id,seller_profile_id,provider_type,status,title)
VALUES('37b7744e-4f75-4b08-ae2d-e37b868d1211','c3572e93-bfbf-4174-9e49-a4403b1146b0','37b7744e-4f75-4b08-ae2d-e37b868d1210','service','active','TEST-V356-ROLLBACK-ONLY');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','c3572e93-bfbf-4174-9e49-a4403b1146b0',true);
SELECT * FROM public.v355_apply_map_publication('37b7744e-4f75-4b08-ae2d-e37b868d1211',0,'37b7744e-4f75-4b08-ae2d-e37b868d1212',true,true,'TEST-V356-ROLLBACK-ONLY','Bakı','TEST workplace',NULL,40.4093,49.8671,'business',ARRAY['repair']);
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.discover_public_providers(40.38,49.84,40.44,49.90,'TEST-V356-ROLLBACK-ONLY','',false,0,'service'))<>1 THEN RAISE EXCEPTION 'ANON_SERVICE_DISCOVERY_FAILED';END IF;
END $$;
RESET ROLE;
UPDATE public.service_provider_listings SET status='inactive' WHERE id='37b7744e-4f75-4b08-ae2d-e37b868d1211';
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.discover_public_providers(40.38,49.84,40.44,49.90,'TEST-V356-ROLLBACK-ONLY','',false,0,'service'))THEN RAISE EXCEPTION 'INACTIVE_VISIBLE';END IF;
END $$;
ROLLBACK;
SELECT 'ROLLBACK_FIXTURE_ASSERTIONS_PASS' AS result;
