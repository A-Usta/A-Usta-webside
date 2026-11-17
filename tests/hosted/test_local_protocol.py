"""Real disposable local PostgreSQL proof for the hosted runner's internal protocol.
No hosted credentials accepted; literal IPv4 loopback and a unique local database only.
"""
import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch
import uuid
import psycopg2
from psycopg2 import sql

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('hosted_cas',Path(__file__).with_name('run_cas.py'))
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
require_host=os.environ.get('AUSTA_TEST_PG_HOST','127.0.0.1')
if require_host!='127.0.0.1':raise RuntimeError('Local-only test requires IPv4 loopback')
OPTIONS=dict(host='127.0.0.1',port=int(os.environ.get('AUSTA_TEST_PG_PORT','55439')),user='austa_local_test',connect_timeout=5,options='-c statement_timeout=12000 -c lock_timeout=8000 -c idle_in_transaction_session_timeout=20000')
if os.environ.get('AUSTA_LOCAL_PG_PASSWORD'):OPTIONS['password']=os.environ['AUSTA_LOCAL_PG_PASSWORD']

class LocalProtocol(unittest.TestCase):
    def setUp(self):
        self.database='austa_hosted_protocol_'+uuid.uuid4().hex
        boot=psycopg2.connect(dbname='postgres',**OPTIONS);boot.autocommit=True
        try:
            with boot.cursor() as q:
                q.execute("SELECT 1 FROM pg_roles WHERE rolname='postgres'")
                if not q.fetchone():q.execute('CREATE ROLE postgres NOLOGIN SUPERUSER')
        finally:boot.close()
        self.admin=self.connect('postgres');self.admin.autocommit=True
        with self.admin.cursor() as q:
            for role in ('anon','authenticated'):
                q.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',(role,))
                if not q.fetchone():q.execute(sql.SQL('CREATE ROLE {} NOLOGIN').format(sql.Identifier(role)))
            q.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(self.database)))
        self.addCleanup(self.cleanup)
        fixture=(ROOT/'tests/postgres/prerequisites.sql').read_text()
        for old,new in [('11111111-1111-4111-8111-111111111111',r.A),('22222222-2222-4222-8222-222222222222','1327b5b3-ba00-416f-8849-12dff7686b97'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',r.L),('cccccccc-cccc-4ccc-8ccc-cccccccccccc',r.S)]:fixture=fixture.replace(old,new)
        with self.connect() as c:
            with c.cursor() as q:
                q.execute(fixture)
                for f in ['20261114072012_v355_public_provider_discovery.sql','20261114132329_v355_provider_location_privacy.sql','20261117090000_v355_map_publication_cas.sql']:
                    q.execute((ROOT/'supabase/migrations'/f).read_text())
                q.execute("UPDATE public.service_provider_listings SET title='AUSTA-V355-TEST-LOCAL' WHERE id=%s",(r.L,))
        for rev,request,on in [(0,r.OLD[0],True),(1,r.OLD[1],False),(2,r.OLD[2],False)]:
            with self.connect() as c:
                with c.cursor() as q:
                    q.execute('SET LOCAL ROLE authenticated')
                    q.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(r.A,))
                    if on:q.execute("SELECT * FROM public.v355_apply_map_publication(%s,%s,%s,true,p_consent=>true,p_public_name=>%s,p_public_area=>'Naxçıvan',p_location_kind=>'service_area',p_services=>ARRAY['repair']::text[])",(r.L,rev,request,r.MARKER))
                    else:q.execute('SELECT * FROM public.v355_apply_map_publication(%s,%s,%s,false)',(r.L,rev,request))
        with self.connect() as c:self.baseline=r.snapshot(c,3,r.OLD)[0]

    def connect(self,database=None):
        c=psycopg2.connect(dbname=database or self.database,**OPTIONS)
        with c.cursor() as q:q.execute('SET SESSION AUTHORIZATION postgres')
        c.commit()
        return c
    def cleanup(self):
        with self.admin.cursor() as q:q.execute(sql.SQL('DROP DATABASE {}').format(sql.Identifier(self.database)))
        self.admin.close()
    def local_attest(self,c):
        # Only the database NAME differs for this explicitly local disposable fixture.
        with c.cursor() as q:
            q.execute("SELECT current_database(),session_user,current_user,(SELECT md5(prosrc) FROM pg_proc WHERE oid='public.v355_apply_map_publication(uuid,bigint,uuid,boolean,boolean,text,text,text,text,double precision,double precision,text,text[])'::regprocedure),EXISTS(SELECT 1 FROM public.service_provider_listings WHERE id=%s AND owner_id=%s AND seller_profile_id=%s AND title LIKE 'AUSTA-V355-TEST-%%')",(r.L,r.A,r.S))
            self.assertEqual(q.fetchone(),(self.database,'postgres','postgres','0e4c033d5a9158d4e4d3b514c2389060',True))
    def run_protocol(self,connect=None):
        with patch.object(r,'attest',self.local_attest):return r.protocol(connect or self.connect,self.baseline)
    def test_success_observes_before_single_commit(self):
        result=self.run_protocol()
        self.assertEqual(result['status'],'PASS',result)
        self.assertTrue(result['pg_locks']);self.assertTrue(result['pg_blocking_pids'])
        self.assertTrue(result['release_after_proof']);self.assertEqual(result['b_sqlstate'],'40001')
        self.assertEqual(result['receipts'],4);self.assertEqual(result['revision'],4)
        print('LOCAL_HOSTED_PROTOCOL_PROOF '+str(dict(result,scope='disposable-local-only')),flush=True)
    def test_missing_proof_rolls_back_A_and_B_never_commits(self):
        with patch.object(r.time,'monotonic',side_effect=[0,6]):result=self.run_protocol()
        self.assertEqual(result['status'],'BLOCKED');self.assertEqual(result['stage'],'transaction_B_wait');self.assertFalse(result['commit_may_have_occurred'])
        with self.connect() as c:self.assertEqual(r.snapshot(c,3,r.OLD)[0],self.baseline)
    def test_lost_commit_response_reports_uncertainty_without_retry(self):
        first=True
        calls=0
        class Wrapped:
            def __init__(self,c):self.c=c
            def __getattr__(self,key):return getattr(self.c,key)
            def commit(self):
                nonlocal calls
                calls+=1
                self.c.commit()
                raise psycopg2.OperationalError('SYNTHETIC_CREDENTIAL_MUST_NOT_ESCAPE')
        def connect():
            nonlocal first
            c=self.connect()
            if first:first=False;return Wrapped(c)
            return c
        result=self.run_protocol(connect)
        self.assertEqual(result['status'],'BLOCKED');self.assertTrue(result['commit_may_have_occurred'])
        self.assertFalse(result['automatic_retry']);self.assertEqual(calls,1)
        self.assertNotIn('SYNTHETIC_CREDENTIAL',str(result))
        with self.connect() as c:self.assertEqual(r.snapshot(c,4,r.OLD+(r.NEW,))[0],self.baseline)

if __name__=='__main__':unittest.main(verbosity=2)
