"""One approved TEST withdrawal. Entrypoint requires a manual protected Actions run.
No DSN/host input, fixture creation, cleanup, migration, Auth, Storage or retry API.
"""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import re
import ssl
import sys
import tempfile
import time
import psycopg2

REF = 'xnhxneziasqthkhhntkv'
HOST = 'aws-1-eu-central-1.pooler.supabase.com'
USER = 'postgres.' + REF
A = 'c3572e93-bfbf-4174-9e49-a4403b1146b0'
L = '825fdd09-3ccf-4e4f-be8c-2015ee38ea25'
S = 'c650b780-0d93-4a48-99c9-081f44e2a4f9'
MARKER = 'AUSTA-V355-CAS-d58f846fc0774b00a7ddd224170074fb'
OLD = ('d6305824-0b3e-51c2-9946-1d480c3f7b69', '97325289-598d-5a1a-bf72-c9a85ca33f26', 'b3ebf67d-2c5e-57b5-b7b9-0619012c56e6')
NEW = '0e4faef2-59dc-573b-aabd-873888191c8b'
LOSER = '63723c31-98e2-589a-9091-12a7331c00ff'
BASELINE = dict(profiles='ec1dd577b9ce97d021cdb1333ed217e5',sellers='40de7a833ed2308c612b674274792eff',listings='e291fb137927922036fa4926d9f8730e',media='d41d8cd98f00b204e9800998ecf8427e',storage='d41d8cd98f00b204e9800998ecf8427e')
TABLES = dict(profiles='public.profiles',sellers='public.seller_profiles',listings='public.service_provider_listings',media='public.service_provider_media',storage='storage.objects')

class Blocked(Exception):
    pass

def require(value, code):
    if not value: raise Blocked(code)

def runtime_guard(env):
    require(env.get('GITHUB_EVENT_NAME')=='workflow_dispatch', 'MANUAL_ONLY')
    require(env.get('GITHUB_REPOSITORY')=='A-Usta/A-Usta-webside', 'REPOSITORY')
    require(env.get('GITHUB_REF')=='refs/heads/feat/v355-automotive-map', 'BRANCH')
    require(env.get('GITHUB_JOB')=='hosted' and env.get('AUSTA_TEST_ENVIRONMENT')=='austa-test-only', 'ENVIRONMENT')
    sha=env.get('GITHUB_SHA','')
    require(bool(re.fullmatch('[a-f0-9]{40}',sha)) and env.get('AUSTA_APPROVED_SHA')==sha, 'COMMIT')
    # libpq environment/DSN injection and arbitrary target overrides are forbidden.
    require(not any(k.startswith('PG') for k in env), 'LIBPQ_ENVIRONMENT')
    require(not any(k in env for k in ['AUSTA_TEST_DATABASE_URL','AUSTA_TEST_PG_DSN','AUSTA_TEST_PG_HOST']), 'NO_TARGET_OVERRIDE')

def ca_bytes(pem, digest=None):
    require(isinstance(pem,str) and 0<len(pem)<=1048576, 'CA_REQUIRED')
    data=pem.replace('\r\n','\n').strip().encode('ascii')+b'\n'
    require(b'PRIVATE KEY' not in data and data.startswith(b'-----BEGIN CERTIFICATE-----'), 'CA_FORMAT')
    if digest is not None:
        require(bool(re.fullmatch('[a-f0-9]{64}',digest)) and hashlib.sha256(data).hexdigest()==digest,'CA_DIGEST')
    ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.load_verify_locations(cadata=data.decode('ascii'))
    return data

def production_connect(password, ca_path):
    require(isinstance(password,str) and 0<len(password)<=4096 and '\x00' not in password, 'PASSWORD_REQUIRED')
    c=psycopg2.connect(host=HOST,port=5432,dbname='postgres',user=USER,password=password,
        sslmode='verify-full',sslrootcert=str(ca_path),connect_timeout=8,
        application_name='austa-approved-cas-'+NEW,
        options='-c statement_timeout=12000 -c lock_timeout=8000 -c idle_in_transaction_session_timeout=20000')
    try:
        require(c.info.host==HOST and c.info.port==5432 and c.info.user==USER and c.info.dbname=='postgres' and c.info.ssl_in_use, 'TRANSPORT_IDENTITY')
        attest(c)
        c.rollback()
        return c
    except BaseException:
        c.close()
        raise

def attest(c):
    with c.cursor() as q:
        q.execute("SELECT current_database(),session_user,current_user,(SELECT md5(prosrc) FROM pg_proc WHERE oid='public.v355_apply_map_publication(uuid,bigint,uuid,boolean,boolean,text,text,text,text,double precision,double precision,text,text[])'::regprocedure),EXISTS(SELECT 1 FROM public.service_provider_listings WHERE id=%s AND owner_id=%s AND seller_profile_id=%s AND title LIKE 'AUSTA-V355-TEST-%%')",(L,A,S))
        row=q.fetchone()
    require(row==('postgres','postgres','postgres','0e4c033d5a9158d4e4d3b514c2389060',True),'DATABASE_IDENTITY')

def snapshot(c, revision, receipt_ids):
    with c.cursor() as q:
        q.execute('SET TRANSACTION READ ONLY')
        q.execute('SELECT listing_id::text,consenting_owner::text,public_name,revision,enabled,consent,consent_at,latitude,longitude FROM public.provider_map_publications')
        require(q.fetchall()==[(L,A,MARKER,revision,False,False,None,None,None)], 'PUBLICATION_BASELINE')
        q.execute('SELECT request_id::text,owner_id::text,listing_id::text,result_revision,result_enabled,request_payload FROM public.v355_map_publication_receipts ORDER BY request_id')
        rows=q.fetchall()
        expected={OLD[0]:(1,True),OLD[1]:(2,False),OLD[2]:(3,False),NEW:(4,False)}
        require({r[0] for r in rows}==set(receipt_ids) and len(rows)==len(receipt_ids),'RECEIPT_BASELINE')
        for rid,owner,listing,rev,enabled,payload in rows:
            require((owner,listing)==(A,L) and (rev,enabled)==expected[rid], 'RECEIPT_IDENTITY')
            require(payload.get('listing')==L and payload.get('enabled') is enabled and payload.get('expected')==rev-1, 'RECEIPT_PAYLOAD')
            if rid==OLD[0]: require(payload.get('name')==MARKER,'RECEIPT_MARKER')
        fingerprints={}
        for key,table in TABLES.items():
            # table identifiers come only from this constant dictionary.
            q.execute("SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) FROM "+table+' t')
            fingerprints[key]=q.fetchone()[0]
        q.execute("SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY request_id),'')) FROM public.v355_map_publication_receipts t WHERE request_id=ANY(%s::uuid[])",(list(OLD),))
        old_receipts_digest=q.fetchone()[0]
        q.execute("SELECT count(*) FROM public.discover_public_providers(38.3,44.7,41.95,50.8,%s,'',true,0,'all')",(MARKER,))
        require(q.fetchone()==(0,), 'DISCOVERY')
    c.rollback()
    return fingerprints,old_receipts_digest

def withdraw(c, request_id):
    attest(c)  # connection and seed rechecked immediately before the only mutation call.
    with c.cursor() as q:
        q.execute('SET LOCAL ROLE authenticated')
        q.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(A,))
        q.execute('SELECT listing_id::text,revision,enabled FROM public.v355_apply_map_publication(%s,3,%s,false)',(L,request_id))
        return q.fetchone()

def protocol(connect, baseline=BASELINE):
    """Internal connection-factory seam supports synthetic/local tests, never a CLI target override."""
    a=b=observer=None
    pool=None
    pending=None
    committed=False
    stage='preflight'
    diagnostic='UNCLASSIFIED'
    observed_wait='NOT_OBSERVED'
    try:
        a=connect();b=connect();observer=connect()
        pids=[c.get_backend_pid() for c in (a,b,observer)]
        require(len(set(pids))==3,'DISTINCT_BACKENDS')
        old_receipts=None
        for c in (a,b,observer):
            attest(c);c.rollback()
            fingerprints,digest=snapshot(c,3,OLD)
            require(fingerprints==baseline,'FINGERPRINT_BASELINE')
            if old_receipts is None:old_receipts=digest
            require(digest==old_receipts,'RECEIPTS_CHANGED_DURING_PREFLIGHT')
        stage='transaction_A_uncommitted'
        require(withdraw(a,NEW)==(L,4,False),'A_OUTCOME')
        stage='transaction_B_wait'
        pool=concurrent.futures.ThreadPoolExecutor(1)
        def contender():
            try:
                result=withdraw(b,LOSER)
                return {'code':'UNEXPECTED_SUCCESS','result':result}
            except psycopg2.Error as e:
                return {'code':e.pgcode}
            finally:
                # B is NEVER allowed to commit, even after A rollback or missing proof.
                b.rollback()
        pending=pool.submit(contender)
        observer.autocommit=True
        # PostgreSQL may expose a tuple wait or transaction-id wait; require both
        # the server-reported blocker PID and a real ungranted row-lock-related wait.
        deadline=time.monotonic()+6
        proof=None
        while time.monotonic()<deadline:
            with observer.cursor() as q:
                q.execute("""SELECT s.wait_event_type,s.wait_event,%s=ANY(pg_blocking_pids(%s)),
                    EXISTS(SELECT 1 FROM pg_locks w
                     WHERE w.pid=%s AND NOT w.granted AND w.locktype IN ('transactionid','tuple'))
                    FROM pg_stat_activity s WHERE s.pid=%s""",(pids[0],pids[1],pids[1],pids[1]))
                row=q.fetchone()
            if row:
                observed_wait = ('LOCK_BLOCKER_AND_WAIT' if row[0]=='Lock' and row[2] and row[3]
                    else 'LOCK_WITHOUT_BOTH_PROOFS' if row[0]=='Lock'
                    else 'OTHER_WAIT' if row[0] else 'NO_WAIT')
            if row and row[0]=='Lock' and row[2] and row[3]: proof=row;break
            require(not pending.done(),'B_FINISHED_WITHOUT_PROOF')
            time.sleep(0.05)
        require(proof is not None and not pending.done(),'LOCK_PROOF_MISSING')
        stage='commit_A_once'
        a.commit()  # exactly one commit, only after observed blocking; never retried.
        committed=True
        stage='B_conflict'
        require(pending.result(timeout=10)=={'code':'40001'},'B_CONFLICT')
        stage='independent_postflight'
        final=connect()
        try:
            attest(final);final.rollback()
            fingerprints,digest=snapshot(final,4,OLD+(NEW,))
            require(fingerprints==baseline and digest==old_receipts,'POSTFLIGHT_FINGERPRINTS')
        finally:final.close()
        return dict(status='PASS',target=REF,transaction_a_pid=pids[0],transaction_b_pid=pids[1],observer_pid=pids[2],
                    wait_event_type=proof[0],wait_event=proof[1],pg_blocking_pids=True,pg_locks=True,
                    release_after_proof=True,b_sqlstate='40001',revision=4,receipts=4,
                    enabled=False,consent=False,discovery=0,fingerprints_unchanged=True,cleanup=False)
    except BaseException as error:
        # Emit only allowlisted diagnostic categories, never exception text or SQL.
        if isinstance(error, Blocked):
            diagnostic = str(error) if str(error) in ('B_FINISHED_WITHOUT_PROOF','LOCK_PROOF_MISSING','DISTINCT_BACKENDS','FINGERPRINT_BASELINE','A_OUTCOME','B_CONFLICT','POSTFLIGHT_FINGERPRINTS') else 'GUARD_BLOCKED'
        elif isinstance(error, psycopg2.Error):
            diagnostic = 'POSTGRES_SQLSTATE_' + (error.pgcode if error.pgcode and re.fullmatch(r'[A-Z0-9]{5}',error.pgcode) else 'UNKNOWN')
        elif isinstance(error, concurrent.futures.TimeoutError):
            diagnostic = 'FUTURE_TIMEOUT'
        else:
            diagnostic = 'UNEXPECTED_EXCEPTION'
        return dict(status='BLOCKED',stage=stage,diagnostic=diagnostic,observed_wait=observed_wait,commit_returned=committed,
                    commit_may_have_occurred=stage in ('commit_A_once','B_conflict','independent_postflight'),
                    automatic_retry=False,cleanup=False)
    finally:
        if a:
            try:a.rollback()
            except Exception:pass
        if pool:pool.shutdown(wait=True,cancel_futures=True)
        for c in (a,b,observer):
            if c:
                try:c.close()
                except Exception:pass

def main():
    password=None
    try:
        require(len(sys.argv)==1,'NO_ARGUMENTS')
        runtime_guard(os.environ)
        password=os.environ.pop('AUSTA_TEST_DB_PASSWORD','')
        require(bool(password),'PASSWORD_REQUIRED')
        pem=os.environ.pop('AUSTA_TEST_DB_CA_PEM','')
        data=ca_bytes(pem)
        digest=hashlib.sha256(data).hexdigest()
        pem=None
        with tempfile.TemporaryDirectory(prefix='austa-public-ca-') as directory:
            path=Path(directory)/'root.crt'
            path.write_bytes(data);path.chmod(0o600) # public CA only; no credential is written.
            require(hashlib.sha256(path.read_bytes()).hexdigest()==digest,'CA_FILE_CHANGED')
            result=protocol(lambda:production_connect(password,path))
        print(json.dumps(result,sort_keys=True))
        return 0 if result['status']=='PASS' else 2
    except BaseException:
        print('{"status":"BLOCKED","stage":"secure_configuration","automatic_retry":false,"cleanup":false}')
        return 2
    finally:password=None

if __name__=='__main__':
    raise SystemExit(main())
