import contextlib
import importlib.util
import io
import os
import ssl
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('hosted_runner',Path(__file__).with_name('run_cas.py'))
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

def environment():
    return dict(GITHUB_EVENT_NAME='workflow_dispatch',GITHUB_REPOSITORY='A-Usta/A-Usta-webside',
                GITHUB_REF='refs/heads/feat/v355-automotive-map',GITHUB_JOB='hosted',
                GITHUB_SHA='a'*40,AUSTA_APPROVED_SHA='a'*40,AUSTA_TEST_ENVIRONMENT='austa-test-only')

class Security(unittest.TestCase):
    def test_manual_environment_and_commit_binding(self):
        good=environment();r.runtime_guard(good)
        for key,value in [('GITHUB_EVENT_NAME','pull_request'),('GITHUB_EVENT_NAME','push'),('GITHUB_REPOSITORY','other/repo'),('GITHUB_REF','refs/heads/main'),('GITHUB_JOB','review'),('AUSTA_TEST_ENVIRONMENT','production'),('AUSTA_APPROVED_SHA','b'*40)]:
            with self.subTest(key=key,value=value),self.assertRaises(r.Blocked):r.runtime_guard(dict(good,**{key:value}))
    def test_libpq_and_dsn_overrides_fail_before_connect(self):
        for key in ['PGHOST','PGSERVICE','PGOPTIONS','PGPASSWORD','AUSTA_TEST_DATABASE_URL','AUSTA_TEST_PG_DSN','AUSTA_TEST_PG_HOST']:
            with self.subTest(key=key),self.assertRaises(r.Blocked):r.runtime_guard(dict(environment(),**{key:'must not be used'}))
    def test_fixed_test_target_and_tls_parameters(self):
        class Info:
            host=r.HOST;port=5432;user=r.USER;dbname='postgres';ssl_in_use=True
        class Conn:
            info=Info()
            def rollback(self):pass
            def close(self):pass
        with patch.object(r.psycopg2,'connect',return_value=Conn()) as connect,patch.object(r,'attest'):
            r.production_connect('SYNTHETIC_NOT_A_SECRET',Path('/tmp/public-ca'))
        kw=connect.call_args.kwargs
        self.assertEqual(kw['host'],'aws-1-eu-central-1.pooler.supabase.com')
        self.assertEqual(kw['user'],'postgres.xnhxneziasqthkhhntkv')
        self.assertEqual(kw['sslmode'],'verify-full');self.assertNotIn('dsn',kw)
        self.assertIn('statement_timeout=12000',kw['options']);self.assertIn('lock_timeout=8000',kw['options'])
    def test_wrong_endpoint_or_no_tls_rejected(self):
        class Conn:
            def close(self):self.closed=True
        for attr,value in [('host','db.production.supabase.co'),('user','postgres.production'),('port',6543),('ssl_in_use',False)]:
            c=Conn();c.info=type('Info',(),dict(host=r.HOST,port=5432,user=r.USER,dbname='postgres',ssl_in_use=True,**{}))()
            setattr(c.info,attr,value)
            with patch.object(r.psycopg2,'connect',return_value=c),self.assertRaises(r.Blocked):r.production_connect('synthetic',Path('/tmp/public-ca'))
            self.assertTrue(c.closed)
    def test_bad_ca_never_connects(self):
        for pem,digest in [('',None),('-----BEGIN PRIVATE KEY-----','a'*64),('-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----','b'*64)]:
            with self.assertRaises(Exception):r.ca_bytes(pem,digest)
    def test_missing_secret_is_sanitized_before_network(self):
        output=io.StringIO()
        with patch.dict(os.environ,environment(),clear=True),patch.object(r.sys,'argv',['run_cas.py']),patch.object(r.psycopg2,'connect') as connect,contextlib.redirect_stdout(output):
            self.assertEqual(r.main(),2)
        connect.assert_not_called();self.assertNotIn('Traceback',output.getvalue())
    def test_provider_error_cannot_leak(self):
        output=io.StringIO()
        env=dict(environment(),AUSTA_TEST_DB_PASSWORD='synthetic-password-do-not-print',AUSTA_TEST_DB_CA_PEM='synthetic')
        with patch.dict(os.environ,env,clear=True),patch.object(r.sys,'argv',['run_cas.py']),patch.object(r,'ca_bytes',side_effect=RuntimeError(env['AUSTA_TEST_DB_PASSWORD'])),contextlib.redirect_stdout(output):
            self.assertEqual(r.main(),2)
        self.assertNotIn(env['AUSTA_TEST_DB_PASSWORD'],output.getvalue())
    def test_workflow_is_manual_secret_isolation(self):
        s=(ROOT/'.github/workflows/v355-hosted-cas.yml').read_text()
        self.assertIn('  workflow_dispatch:',s)
        self.assertNotIn('  pull_request:',s);self.assertNotIn('  push:',s)
        self.assertIn('environment: austa-test-only',s)
        review,hosted=s.split('  hosted:',1)
        self.assertNotIn('secrets.',review)
        for p in (ROOT/'.github/workflows').glob('*.yml'):
            if p.name!='v355-hosted-cas.yml':self.assertNotIn('secrets.AUSTA_TEST_DB_',p.read_text())
        self.assertIn('cancel-in-progress: false',s)
        self.assertEqual(hosted.count('secrets.'),2)
    def test_valid_ca_configuration_keeps_password_out_of_files_and_output(self):
        certificate=ssl.DER_cert_to_PEM_cert(ssl.create_default_context().get_ca_certs(binary_form=True)[0])
        self.assertIn(b'BEGIN CERTIFICATE',r.ca_bytes(certificate))
        env=dict(environment(),AUSTA_TEST_DB_PASSWORD='synthetic-config-only',AUSTA_TEST_DB_CA_PEM=certificate)
        output=io.StringIO()
        with patch.dict(os.environ,env,clear=True),patch.object(r.sys,'argv',['run_cas.py']),patch.object(r,'protocol',return_value={'status':'PASS','scope':'synthetic-unit-config'}) as protocol,contextlib.redirect_stdout(output):
            self.assertEqual(r.main(),0)
            protocol.assert_called_once()
            self.assertNotIn('AUSTA_TEST_DB_PASSWORD',os.environ)
        self.assertNotIn(env['AUSTA_TEST_DB_PASSWORD'],output.getvalue())
    def test_database_attestation_requires_exact_database_and_seed(self):
        class Cursor:
            def __init__(self,row):self.row=row
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def execute(self,*args):pass
            def fetchone(self):return self.row
        class Connection:
            def __init__(self,row):self.row=row
            def cursor(self):return Cursor(self.row)
        good=('postgres','postgres','postgres','0e4c033d5a9158d4e4d3b514c2389060',True)
        r.attest(Connection(good))
        for index,value in [(0,'production'),(1,'other'),(2,'other'),(3,'changed'),(4,False)]:
            row=list(good);row[index]=value
            with self.assertRaises(r.Blocked):r.attest(Connection(tuple(row)))
    def test_environment_metadata_gate_fails_closed(self):
        spec=importlib.util.spec_from_file_location('environment_gate',Path(__file__).with_name('check_environment.py'))
        e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
        good=dict(name='austa-test-only',can_admins_bypass=False,protection_rules=[dict(type='required_reviewers',reviewers=[{}])],deployment_branch_policy=dict(protected_branches=False,custom_branch_policies=True))
        policy=dict(total_count=1,branch_policies=[dict(name='feat/v355-automotive-map',type='branch')])
        e.validate(good,policy)
        for changed in [dict(good,can_admins_bypass=True),dict(good,protection_rules=[]),dict(good,name='production'),dict(good,deployment_branch_policy=None)]:
            with self.assertRaises(e.Blocked):e.validate(changed,policy)
        for changed in [dict(total_count=0,branch_policies=[]),dict(total_count=1,branch_policies=[dict(name='*',type='branch')])]:
            with self.assertRaises(e.Blocked):e.validate(good,changed)
    def test_no_cleanup_migration_or_general_target_interface(self):
        s=Path(__file__).with_name('run_cas.py').read_text()
        for forbidden in ['DELETE FROM','TRUNCATE','CREATE TABLE','ALTER TABLE','DROP TABLE','argparse','print(password','print(os.environ']:
            self.assertNotIn(forbidden,s)
        self.assertIn('b.rollback()',s)

if __name__=='__main__':unittest.main()
