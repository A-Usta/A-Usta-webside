"""Offline adversarial tests. No live key, network, Supabase or national-geometry claim."""
import concurrent.futures
import hashlib
import importlib
import json
import multiprocessing
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import time
import unittest
from urllib.parse import urlsplit, parse_qs

core = importlib.import_module('tools.geoapify.proxy.core')
application = importlib.import_module('tools.geoapify.proxy.app').application
KEY = 'SYNTHETIC_SERVER_ONLY_CREDENTIAL_12345'
SUBJECT = 'synthetic_session_abcdefghijklmn'
# Synthetic two-part geometry with a hole: NOT an Azerbaijan border dataset.
SHAPE = {'type':'MultiPolygon','coordinates':[[[[49.7,40.2],[50.,40.2],[50.,40.6],[49.7,40.6],[49.7,40.2]],[[49.71,40.21],[49.72,40.21],[49.72,40.22],[49.71,40.22],[49.71,40.21]]],[[[45.2,39.],[45.7,39.],[45.7,39.5],[45.2,39.5],[45.2,39.]]]]}
RAW = json.dumps(SHAPE).encode()
BOX = '49.84,40.38,49.90,40.44'
PARAMS = [('box',BOX),('category','fuel')]


def backend(url):
    assert urlsplit(url).hostname == 'api.geoapify.com'
    return 'application/json', json.dumps({'type':'FeatureCollection','features':[{'properties':{'country_code':'az','name':'SYNTHETIC POI','place_id':'fixture','categories':['service.vehicle.fuel'],'apiKey':KEY,'datasource':{'url':'https://private.invalid/?apiKey='+KEY}},'geometry':{'type':'Point','coordinates':[49.87,40.41]}}]}).encode()


def process_admit(args):
    path, i = args
    s = core.Store(path, daily=12, per_client_daily=12)
    try:
        s.admit(hashlib.sha256(str(i).encode()).hexdigest(), hashlib.sha256(SUBJECT.encode()).hexdigest(), 4)
        return 'reserved'
    except core.Denied as e:
        return e.code


class ProxyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        os.chmod(self.temp.name,0o700)
        self.path = Path(self.temp.name)/'meter.sqlite'
        self.boundary = core.Boundary(RAW,hashlib.sha256(RAW).hexdigest())
        self.store = core.Store(self.path,initialize=True)
        self.proxy = core.Proxy(server_key=KEY, store=self.store,boundary=self.boundary,fetch=backend)
        self.principal = core.Principal(SUBJECT,time.time()+600)

    def tearDown(self):
        self.temp.cleanup()

    def test_auth_rejects_headerless_forged_expired_missing_principals(self):
        for p in [None,{},SUBJECT,core.Principal(SUBJECT,0),core.Principal(SUBJECT,time.time()+3600),core.Principal('*',time.time()+60)]:
            with self.subTest(principal=type(p).__name__),self.assertRaisesRegex(core.Denied,'AUTH'):
                self.proxy.handle(p,'/places',PARAMS)
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM usage').fetchone()[0],0)

    def test_invalid_queries_have_zero_upstream_calls(self):
        calls=[]
        self.proxy.fetch=lambda u:calls.append(u)
        bad=[('/places',PARAMS+[('apiKey',KEY)]),('/places',PARAMS+[('url','https://evil.invalid')]),('/places',PARAMS+[('category','wash')]),('/places',[('box',BOX),('category','tow')]),('/places',[('box','44.7,38.3,50.8,41.95'),('category','fuel')]),('/places',[('box','46,40,46.06,40.06'),('category','fuel')]),('/places',PARAMS+[('page','3')]),('/places',PARAMS+[('name','a\nb')]),('/geocode',[('text','Baku'),('filter','countrycode:ru')]),('/geocode',[('text','x')]),('/tile',[('box',BOX),('z','1'),('x','0'),('y','0')]),('/tile',[('box',BOX),('z','13'),('x','0'),('y','0')]),('https://evil.invalid',PARAMS),('/../places',PARAMS)]
        for route,params in bad:
            with self.subTest(route=route,params=params),self.assertRaises(core.Denied):
                self.proxy.handle(self.principal,route,params)
        self.assertEqual(calls,[])

    def test_pinned_multipolygon_boundary_holes_enclave_and_outside(self):
        self.assertTrue(self.boundary.contains(49.87,40.41))
        self.assertTrue(self.boundary.contains(45.41,39.21))
        self.assertFalse(self.boundary.contains(49.715,40.215))
        self.assertFalse(self.boundary.contains(46,40))
        with self.assertRaises(core.Denied):core.Boundary(RAW,'0'*64)
        with self.assertRaises(core.Denied):core.Boundary(b'{}',hashlib.sha256(b'{}').hexdigest())

    def test_response_is_rebuilt_and_secret_fields_not_returned(self):
        # A malicious upstream echoing the key anywhere is rejected, even in ignored fields.
        with self.assertRaisesRegex(core.Denied,'UPSTREAM'):
            self.proxy.handle(self.principal,'/places',PARAMS)
        self.proxy.fetch=lambda u: ('application/json',backend(u)[1].replace(KEY.encode(),b'IGNORED'))
        mime,body=self.proxy.handle(self.principal,'/places',PARAMS)
        self.assertEqual(mime,'application/json')
        self.assertNotIn(b'apiKey',body)
        self.assertNotIn(b'datasource',body)
        self.assertEqual(len(json.loads(body)['features']),1)
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute("SELECT units FROM usage WHERE subject='*'").fetchone()[0],24)

    def test_cross_process_atomic_global_budget_and_restart(self):
        path=Path(self.temp.name)/'shared.sqlite'
        core.Store(path,initialize=True,daily=12,per_client_daily=12)
        with multiprocessing.get_context('spawn').Pool(4) as pool:
            result=pool.map(process_admit,[(str(path),i) for i in range(12)])
        self.assertEqual(result.count('reserved'),3)
        self.assertEqual(result.count('BUDGET'),9)
        self.assertEqual(process_admit((str(path),99)),'BUDGET')
        with self.assertRaisesRegex(core.Denied,'STORE_CONFIG'):
            core.Store(path,daily=240)

    def test_requests_with_new_sessions_cannot_bypass_global_budget(self):
        store=core.Store(Path(self.temp.name)/'daily.sqlite',initialize=True,daily=12,per_client_daily=12)
        for i in range(3):store.admit(hashlib.sha256(str(i).encode()).hexdigest(),hashlib.sha256(str(i).encode()).hexdigest(),4)
        with self.assertRaisesRegex(core.Denied,'BUDGET'):
            store.admit('a'*64,'b'*64,1)
        for cost in [-12,0,True,1000]:
            with self.assertRaisesRegex(core.Denied,'ADMISSION'):store.admit('c'*64,'d'*64,cost)

    def test_rate_survives_restart_and_counts_cache_hits(self):
        path=Path(self.temp.name)/'rate.sqlite'
        s=core.Store(path,initialize=True,client_minute=2,clock=lambda:200000)
        key,subject='e'*64,'f'*64
        state,owner=s.admit(key,subject,1)
        s.finish(key,owner,('image/png',b'SYNTHETIC'),300)
        self.assertEqual(s.admit(key,subject,1)[0],'cached')
        restarted=core.Store(path,client_minute=2,clock=lambda:200000)
        with self.assertRaisesRegex(core.Denied,'RATE'):restarted.admit(key,subject,1)
        global_store=core.Store(Path(self.temp.name)/'global-rate.sqlite',initialize=True,global_minute=2,clock=lambda:200000)
        global_store.admit('a'*64,'b'*64,1)
        global_store.admit('c'*64,'d'*64,1)
        with self.assertRaisesRegex(core.Denied,'RATE'):global_store.admit('e'*64,'f'*64,1)

    def test_durable_cache_and_cross_worker_coalescing_reserve_once(self):
        calls=[]
        def slow(url):
            calls.append(1);time.sleep(.2)
            return 'application/json',backend(url)[1].replace(KEY.encode(),b'IGNORED')
        proxies=[core.Proxy(server_key=KEY,store=core.Store(self.path),boundary=self.boundary,fetch=slow) for _ in range(8)]
        with concurrent.futures.ThreadPoolExecutor(8) as pool:
            results=list(pool.map(lambda p:p.handle(self.principal,'/places',PARAMS),proxies))
        self.assertEqual(len(calls),1)
        self.assertTrue(all(r==results[0] for r in results))
        restarted=core.Proxy(server_key=KEY,store=core.Store(self.path),boundary=self.boundary,fetch=lambda _:self.fail('cache missed'))
        self.assertEqual(restarted.handle(self.principal,'/places',PARAMS),results[0])
        with self.assertRaisesRegex(core.Denied,'AUTH'):restarted.handle(None,'/places',PARAMS)
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute("SELECT units FROM usage WHERE subject='*'").fetchone()[0],12)

    def test_failure_is_charged_and_secret_not_in_error(self):
        def bad(_):raise RuntimeError('https://api.geoapify.com/?apiKey='+KEY)
        self.proxy.fetch=bad
        with self.assertRaises(core.Denied) as caught:self.proxy.handle(self.principal,'/places',PARAMS)
        self.assertEqual(str(caught.exception),'UPSTREAM')
        with sqlite3.connect(self.path) as db:self.assertEqual(db.execute("SELECT units FROM usage WHERE subject='*'").fetchone()[0],12)

    def test_store_loss_symlink_permissions_and_clock_rollback_fail_closed(self):
        os.chmod(self.path,0o644)
        with self.assertRaises(core.Denied):self.proxy.handle(self.principal,'/places',PARAMS)
        os.chmod(self.path,0o600)
        self.path.rename(self.path.with_suffix('.old'))
        with self.assertRaises(core.Denied):self.proxy.handle(self.principal,'/places',PARAMS)
        self.assertFalse(self.path.exists())
        self.path.symlink_to(self.path.with_suffix('.old'))
        with self.assertRaises(core.Denied):core.Store(self.path)
        s=core.Store(Path(self.temp.name)/'clock.sqlite',initialize=True,clock=lambda:200000)
        s.admit('a'*64,'b'*64,1)
        s.clock=lambda:100000
        with self.assertRaisesRegex(core.Denied,'CLOCK'):s.admit('c'*64,'b'*64,1)

    def test_response_mime_size_schema_country_and_viewport_filters(self):
        for mime,body in [('text/html',b'<html>'),('application/json',b'not-json'),('application/json',b'{}'),('application/json',b'x'*(core.MAX_BODY+1)),('image/png',b'not png')]:
            with self.subTest(mime=mime),self.assertRaises(core.Denied):self.proxy._response('/places',mime,body,(49.84,40.38,49.90,40.44))
        raw=backend('https://api.geoapify.com/v2/places')[1].replace(KEY.encode(),b'IGNORED')
        for changed in [raw.replace(b'"az"',b'"ge"'),raw.replace(b'49.87',b'46.00'),raw.replace(b'49.87',b'49.95')]:
            self.assertEqual(json.loads(self.proxy._response('/places','application/json',changed,(49.84,40.38,49.90,40.44))[1])['features'],[])

    def test_geocoding_text_is_encoded_and_never_cached(self):
        calls=[]
        def fetch(url):calls.append(url);return 'application/json',b'{"type":"FeatureCollection","features":[]}'
        self.proxy.fetch=fetch
        self.proxy.handle(self.principal,'/geocode',[('text','Baku &apiKey=ATTACK')])
        u=urlsplit(calls[0]);q=parse_qs(u.query)
        self.assertEqual(u.hostname,'api.geoapify.com')
        self.assertEqual(q['apiKey'],[KEY])
        self.assertEqual(q['filter'],['countrycode:az'])
        self.assertEqual(q['text'],['Baku &apiKey=ATTACK'])
        with sqlite3.connect(self.path) as db:self.assertEqual(db.execute('SELECT count(*) FROM cache').fetchone()[0],0)

    def test_wsgi_auth_origin_method_query_and_error_redaction(self):
        def call(app,**extra):
            result=[]
            env={'REQUEST_METHOD':'GET','HTTP_ORIGIN':'https://a-usta.github.io','PATH_INFO':'/places','QUERY_STRING':'box='+BOX+'&category=fuel',**extra}
            body=b''.join(app(env,lambda status,headers:result.append((status,dict(headers)))))
            return result[0],body
        app=application(self.proxy,authenticate=lambda e:None,allowed_origin='https://a-usta.github.io')
        for change,status in [({},'401'),({'HTTP_ORIGIN':''},'403'),({'HTTP_ORIGIN':'https://evil.invalid'},'403'),({'REQUEST_METHOD':'POST'},'405'),({'QUERY_STRING':'bad=%xx'},'400')]:
            response,body=call(app,**change)
            self.assertTrue(response[0].startswith(status))
            self.assertNotIn(KEY.encode(),body)
        response,_=call(app,HTTP_ORIGIN='',HTTP_REFERER='https://a-usta.github.io/A-Usta-webside/')
        self.assertTrue(response[0].startswith('401'),'same-origin metadata cannot replace authentication')
        app=application(self.proxy,authenticate=lambda e:self.principal,allowed_origin='https://a-usta.github.io')
        self.proxy.fetch=lambda _:('application/json',b'{"type":"FeatureCollection","features":[]}')
        response,body=call(app)
        self.assertTrue(response[0].startswith('200'))
        self.assertEqual(response[1]['Cache-Control'],'no-store')
        self.assertEqual(response[1]['Access-Control-Allow-Origin'],'https://a-usta.github.io')
        self.assertNotIn(KEY.encode(),body)
        response,_=call(app,HTTP_ORIGIN='',HTTP_REFERER='https://a-usta.github.io/A-Usta-webside/')
        self.assertTrue(response[0].startswith('200'))
        response,_=call(app,HTTP_ORIGIN='',HTTP_REFERER='https://a-usta.github.io/',HTTP_SEC_FETCH_SITE='cross-site')
        self.assertTrue(response[0].startswith('403'))
        with self.assertRaises(core.Denied):application(self.proxy,authenticate=lambda _:None,allowed_origin='https://evil.invalid/path')

    def test_lease_fencing_never_allows_an_expired_owner_to_overwrite_cache(self):
        now=[200000.]
        store=core.Store(Path(self.temp.name)/'fence.sqlite',initialize=True,clock=lambda:now[0])
        key,subject='a'*64,'b'*64
        _,old=store.admit(key,subject,1)
        now[0]+=16
        _,new=store.admit(key,subject,1)
        self.assertNotEqual(old,new)
        with self.assertRaisesRegex(core.Denied,'LEASE'):store.finish(key,old,('image/png',b'old'))
        store.finish(key,new,('image/png',b'new'))
        self.assertEqual(store.cached(key)[1],b'new')

    def test_daily_per_client_budget_is_persistent_and_other_clients_share_global_cap(self):
        store=core.Store(Path(self.temp.name)/'client.sqlite',initialize=True,daily=24,per_client_daily=12)
        store.admit('a'*64,'b'*64,12)
        with self.assertRaisesRegex(core.Denied,'BUDGET'):store.admit('c'*64,'b'*64,1)
        store.admit('d'*64,'e'*64,12)
        with self.assertRaisesRegex(core.Denied,'BUDGET'):store.admit('f'*64,'a'*64,1)

    def test_png_integrity_size_and_viewport_admission(self):
        import zlib,struct
        def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
        png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00\xff\x00\x00'))+chunk(b'IEND',b'')
        self.assertEqual(self.proxy._response('/tile','image/png',png,None),('image/png',png))
        for bad in [png[:-1],png+b'extra',png[:30]+b'X'+png[31:],png[:8]+chunk(b'tEXt',b'ignored')+png[8:]]:
            with self.assertRaises(core.Denied):self.proxy._response('/tile','image/png',bad,None)
        z=13;x=int((49.87+180)/360*2**z)
        import math
        y=int((1-math.asinh(math.tan(math.radians(40.41)))/math.pi)/2*2**z)
        _,url,cost,ttl,_=self.proxy._plan('/tile',[('box',BOX),('z',str(z)),('x',str(x)),('y',str(y))])
        self.assertEqual(cost,1)
        self.assertEqual(urlsplit(url).hostname,'maps.geoapify.com')

    def test_tls_verification_fixed_hosts_redirects_and_timeout(self):
        from unittest.mock import patch,MagicMock
        import ssl
        with patch.dict(os.environ,{'SSLKEYLOGFILE':'/synthetic-do-not-create'}), patch.object(core.http.client,'HTTPSConnection') as constructor:
            with self.assertRaisesRegex(core.Denied,'UPSTREAM'):core.transport('https://api.geoapify.com/v2/places?apiKey='+KEY)
            constructor.assert_not_called()
        for bad in ['http://api.geoapify.com/v2/places','https://evil.invalid/','https://api.geoapify.com@evil.invalid/','https://api.geoapify.com:8443/']:
            with self.assertRaises(core.Denied):core.transport(bad)
        for status in [301,302,307,308,401,429,500]:
            with patch.object(core.http.client,'HTTPSConnection') as constructor:
                conn=constructor.return_value
                conn.getresponse.return_value.status=status
                with self.assertRaisesRegex(core.Denied,'UPSTREAM'):core.transport('https://api.geoapify.com/v2/places?apiKey='+KEY)
                context=constructor.call_args.kwargs['context']
                self.assertTrue(context.check_hostname)
                self.assertEqual(context.verify_mode,ssl.CERT_REQUIRED)
                self.assertEqual(constructor.call_args.kwargs['timeout'],8)
                conn.set_debuglevel.assert_called_once_with(0)
                conn.close.assert_called_once()
        with patch.object(core.http.client,'HTTPSConnection') as constructor, patch.object(core.time,'monotonic',side_effect=[0,9]):
            with self.assertRaisesRegex(core.Denied,'UPSTREAM'):core.transport('https://api.geoapify.com/v2/places?apiKey='+KEY)
            constructor.return_value.getresponse.assert_not_called()
            constructor.return_value.close.assert_called_once()

    def test_no_production_registration_or_client_secret_contract(self):
        root=Path(__file__).resolve().parents[2]
        server=(root/'backend/a-usta56/src/config/server.ts').read_text()
        self.assertNotIn('geoapify',server.lower())
        self.assertNotIn(KEY,server)
        self.assertFalse((root/'assets/map/runtime-config.json').exists())

if __name__=='__main__':unittest.main()
