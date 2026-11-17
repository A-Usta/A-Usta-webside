"""Real PostgreSQL multi-backend contract tests. Local loopback only; no hosted secrets.
Creates and drops only a fresh austa_cas_<random> database, never a cluster.
"""
import concurrent.futures as futures
import os
from pathlib import Path
import threading
import unittest
import uuid
import psycopg2
from psycopg2 import sql

ROOT = Path(__file__).resolve().parents[2]
A = '11111111-1111-4111-8111-111111111111'
B = '22222222-2222-4222-8222-222222222222'
L = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
LB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
S = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
MIGRATIONS = ['20261114072012_v355_public_provider_discovery.sql',
              '20261114132329_v355_provider_location_privacy.sql',
              '20261117090000_v355_map_publication_cas.sql']
HOST = os.environ.get('AUSTA_TEST_PG_HOST', '127.0.0.1')
if HOST != '127.0.0.1':
    raise RuntimeError('Disposable suite requires literal IPv4 loopback')
OPTIONS = dict(host=HOST, port=int(os.environ.get('AUSTA_TEST_PG_PORT', '55439')),
               user='austa_local_test', connect_timeout=5,
               options='-c statement_timeout=10000 -c lock_timeout=5000')
# Only for the ephemeral CI container, not a Supabase credential.
if os.environ.get('AUSTA_LOCAL_PG_PASSWORD'):
    OPTIONS['password'] = os.environ['AUSTA_LOCAL_PG_PASSWORD']
DB = 'austa_cas_' + uuid.uuid4().hex


def connect():
    return psycopg2.connect(dbname=DB, **OPTIONS)


def query(statement, args=None):
    with connect() as c:
        with c.cursor() as q:
            q.execute(statement, args)
            return q.fetchall() if q.description else None


def operation(uid=A, listing=L, expected=0, enabled=True, request=None, name='Synthetic Workshop', **overrides):
    values = dict(p_listing_id=listing, p_expected_revision=expected,
                  p_request_id=request or str(uuid.uuid4()), p_enabled=enabled)
    if enabled:
        values.update(p_consent=True, p_public_name=name, p_public_area='Bakı',
                      p_location_kind='service_area', p_services=['repair'])
    values.update(overrides)
    return values


def apply(args, uid=A, connection=None):
    owned = connection is None
    c = connection or connect()
    try:
        with c.cursor() as q:
            q.execute('SET LOCAL ROLE authenticated')
            q.execute("SELECT set_config('request.jwt.claim.sub',%s,true)", (uid or '',))
            q.execute('SELECT * FROM public.v355_apply_map_publication(' +
                      ','.join(k + ' => %s' for k in args) + ')', list(args.values()))
            result = q.fetchone()
        if owned:
            c.commit()
        return result
    finally:
        if owned:
            c.close()


class Contracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin = psycopg2.connect(dbname='postgres', **OPTIONS)
        cls.admin.autocommit = True
        with cls.admin.cursor() as q:
            for role in ['anon', 'authenticated']:
                q.execute('SELECT 1 FROM pg_roles WHERE rolname=%s', (role,))
                if not q.fetchone():
                    q.execute(sql.SQL('CREATE ROLE {} NOLOGIN').format(sql.Identifier(role)))
            q.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(DB)))
        try:
            query((ROOT / 'tests/postgres/prerequisites.sql').read_text())
            for name in MIGRATIONS:
                query((ROOT / 'supabase/migrations' / name).read_text())
        except Exception:
            cls.tearDownClass()
            raise

    @classmethod
    def tearDownClass(cls):
        with cls.admin.cursor() as q:
            # No pg_terminate_backend, broad cleanup, directory removal, or hosted connection.
            q.execute(sql.SQL('DROP DATABASE {}').format(sql.Identifier(DB)))
        cls.admin.close()

    def setUp(self):
        query('TRUNCATE public.v355_map_publication_receipts,public.provider_map_publications')
        query("UPDATE public.service_provider_listings SET owner_id=%s,status='active' WHERE id=%s", (A,L))
        query("UPDATE public.seller_profiles SET status='active',verification_status='verified' WHERE id=%s", (S,))
        query("UPDATE public.profiles SET is_active=true,role='mechanic',phone_verified=false WHERE id=%s", (A,))

    def rejected(self, code, fn):
        with self.assertRaises(psycopg2.Error) as caught:
            fn()
        self.assertEqual(caught.exception.pgcode, code)

    def race(self, one, two, uid2=A):
        barrier = threading.Barrier(2)
        def worker(args, uid):
            with connect() as c:
                with c.cursor() as q:
                    q.execute('SELECT pg_backend_pid()')
                    pid = q.fetchone()[0]
                barrier.wait(timeout=5)
                try:
                    value = apply(args, uid, c)
                    c.commit()
                    return pid, 'OK', value
                except psycopg2.Error as error:
                    c.rollback()
                    return pid, error.pgcode, None
        with futures.ThreadPoolExecutor(2) as pool:
            a = pool.submit(worker, one, A)
            b = pool.submit(worker, two, uid2)
            rows = [a.result(timeout=15), b.result(timeout=15)]
        self.assertNotEqual(rows[0][0], rows[1][0], 'Requires two real PostgreSQL backends')
        return rows

    def test_publish_withdraw_race(self):
        for initial in [0,1]:
            if initial: apply(operation())
            results = self.race(operation(expected=initial), operation(expected=initial,enabled=False))
            self.assertEqual(sorted(r[1] for r in results), ['40001','OK'])
            self.assertEqual(query('SELECT revision FROM provider_map_publications')[0][0], initial+1)
            query('TRUNCATE v355_map_publication_receipts,provider_map_publications')

    def test_two_first_publish(self):
        results = self.race(operation(name='First'), operation(name='Second'))
        self.assertEqual(sorted(r[1] for r in results), ['40001','OK'])
        self.assertEqual(query('SELECT count(*) FROM v355_map_publication_receipts')[0][0], 1)

    def test_identical_concurrent_retry(self):
        args = operation()
        results = self.race(args,args)
        self.assertEqual([r[1] for r in results], ['OK','OK'])
        self.assertEqual(results[0][2], results[1][2])
        self.assertEqual(query('SELECT revision FROM provider_map_publications')[0][0], 1)
        self.assertEqual(query('SELECT count(*) FROM v355_map_publication_receipts')[0][0], 1)

    def test_same_request_different_payload(self):
        request = str(uuid.uuid4())
        results = self.race(operation(request=request,name='One'), operation(request=request,name='Two'))
        self.assertEqual(sorted(r[1] for r in results), ['22023','OK'])

    def test_lost_response_replay_after_withdrawal_never_republishes(self):
        first = operation()
        self.assertEqual(apply(first)[1:], (1,True))
        apply(operation(expected=1,enabled=False))
        self.assertEqual(apply(first)[1:], (1,True))  # historical receipt only
        self.assertEqual(query('SELECT revision,enabled,consent,consent_at FROM provider_map_publications')[0], (2,False,False,None))

    def test_receipt_replay_rechecks_ownership(self):
        first = operation(); apply(first)
        query('UPDATE service_provider_listings SET owner_id=%s WHERE id=%s',(B,L))
        self.rejected('42501', lambda: apply(first))
        self.rejected('42501', lambda: apply(operation(listing=L,expected=1), B))

    def test_cross_user_same_uuid_independent_and_isolated(self):
        request = str(uuid.uuid4())
        results = self.race(operation(request=request),operation(listing=LB,request=request),B)
        self.assertEqual([r[1] for r in results], ['OK','OK'])
        with connect() as c:
            with c.cursor() as q:
                q.execute('SET LOCAL ROLE authenticated')
                q.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(B,))
                q.execute('SELECT * FROM provider_map_publications WHERE listing_id=%s',(L,))
                self.assertEqual(q.fetchall(), [])

    def test_no_direct_cas_or_receipt_bypass(self):
        for statement in ["UPDATE provider_map_publications SET enabled=false", 'DELETE FROM provider_map_publications',
                          'SELECT * FROM v355_map_publication_receipts', 'DELETE FROM v355_map_publication_receipts']:
            def run():
                with connect() as c:
                    with c.cursor() as q:
                        q.execute('SET LOCAL ROLE authenticated');q.execute(statement)
            self.rejected('42501',run)
        self.rejected('42501',lambda: apply(operation(), B))
        self.rejected('22023',lambda: apply(operation(), None))

    def test_stale_invalid_consent_and_validation_roll_back_receipts(self):
        self.rejected('22023',lambda: apply(operation(p_consent=False)))
        self.rejected('23514',lambda: apply(operation(p_location_kind='business',p_latitude=40,p_longitude=49)))
        self.assertEqual(query('SELECT count(*) FROM v355_map_publication_receipts')[0][0], 0)
        apply(operation())
        self.rejected('40001',lambda: apply(operation(expected=0,enabled=False)))
        self.rejected('22023',lambda: apply(operation(expected=1,enabled=False,p_public_name='Hidden payload')))
        self.assertEqual(query('SELECT count(*) FROM v355_map_publication_receipts')[0][0], 1)

    def test_revocation_can_withdraw_when_ineligible(self):
        apply(operation())
        query("UPDATE seller_profiles SET verification_status='unverified' WHERE id=%s",(S,))
        self.rejected('42501',lambda: apply(operation(expected=1)))
        self.assertEqual(apply(operation(expected=1,enabled=False))[1:], (2,False))

    def test_transaction_rollback_and_retry(self):
        first = operation()
        with connect() as c:
            apply(first,connection=c)
            c.rollback()
        self.assertEqual(query('SELECT count(*) FROM v355_map_publication_receipts')[0][0],0)
        self.assertEqual(apply(first)[1:],(1,True))

    def test_eligibility_rows_locked_during_publish(self):
        with connect() as c:
            apply(operation(),connection=c)
            def revoke():
                with connect() as r:
                    with r.cursor() as q:
                        q.execute("SET LOCAL lock_timeout='150ms'")
                        q.execute("UPDATE seller_profiles SET status='suspended' WHERE id=%s",(S,))
            with futures.ThreadPoolExecutor(1) as pool:
                self.rejected('55P03',lambda: pool.submit(revoke).result(timeout=3))
            c.rollback()

    def test_public_discovery_and_private_fields(self):
        apply(operation())
        with connect() as c:
            with c.cursor() as q:
                q.execute('SET LOCAL ROLE anon')
                q.execute("SELECT * FROM discover_public_providers(38.3,44.7,41.95,50.8,'Synthetic','',true,0,'all')")
                rows=q.fetchall();self.assertEqual(len(rows),1)
                self.assertNotIn('PRIVATE',str(rows))
                self.assertIsNone(rows[0][6]);self.assertIsNone(rows[0][7])
        apply(operation(expected=1,enabled=False))
        self.assertEqual(query("SELECT count(*) FROM discover_public_providers(38.3,44.7,41.95,50.8,'Synthetic','',true,0,'all')")[0][0],0)

    def test_security_definer_catalog_and_profile_trigger(self):
        funcs = query("SELECT proname,proconfig,has_function_privilege('anon',oid,'execute') FROM pg_proc WHERE proname IN ('austa_protect_profile_security_fields','v355_apply_map_publication')")
        self.assertEqual(len(funcs),2)
        for _,config,anon in funcs:
            self.assertIn('search_path=""',config);self.assertFalse(anon)
        for change in ["role='customer'",'is_active=false','phone_verified=true']:
            def update():
                with connect() as c:
                    with c.cursor() as q:
                        q.execute('SET LOCAL ROLE authenticated')
                        q.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(A,))
                        q.execute('UPDATE profiles SET '+change+' WHERE id=%s',(A,))
            self.rejected('P0001',update)

    def test_migration_reapply_fails_atomically(self):
        apply(operation())
        self.rejected('P0001',lambda: query((ROOT/'supabase/migrations'/MIGRATIONS[-1]).read_text()))
        self.assertEqual(query('SELECT revision FROM provider_map_publications')[0][0],1)

if __name__ == '__main__':
    unittest.main(verbosity=2)
