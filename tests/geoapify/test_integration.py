"""Integrated TEST host contracts; synthetic upstream, actual guest crypto and AZ geometry."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from tools.geoapify.proxy.core import Boundary,Denied,Store
from tools.geoapify.proxy.sessions import GuestSessions,COOKIE
from tools.geoapify.proxy.test_app import create_application,BOUNDARY_SHA

class Integration(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.preview=self.root/'preview';self.preview.mkdir()
        (self.preview/'index.html').write_text('<!doctype html>TEST preview')
        self.path=self.root/'usage.sqlite';self.store=Store(self.path,initialize=True,network_client_minute=60)
        self.origin='https://austa-map-test-fixture.onrender.com'
        self.env={'AUSTA_MAP_MODE':'TEST','AUSTA_MAP_TEST_ORIGIN':self.origin,'AUSTA_MAP_PREVIEW_ROOT':str(self.preview),'AUSTA_MAP_LEDGER':str(self.path),'GEOAPIFY_SERVER_KEY':'SYNTHETIC_SERVER_KEY_NOT_REAL_12345','AUSTA_MAP_SESSION_SECRET':'1'*64}
        self.app=create_application(self.env,fetch=lambda _:('application/json',b'{"type":"FeatureCollection","features":[]}'))

    def tearDown(self):self.temp.cleanup()

    def call(self,path='/',**kwargs):
        result=[]
        e={'REQUEST_METHOD':'GET','PATH_INFO':path,'QUERY_STRING':'','HTTP_HOST':self.origin[8:],'wsgi.url_scheme':'https','HTTP_REFERER':self.origin+'/','REMOTE_ADDR':'127.0.0.1',**kwargs}
        body=b''.join(self.app(e,lambda status,headers:result.append((status,dict(headers)))))
        return result[0],body

    def test_real_country_all_nine_regions_and_foreign_points(self):
        raw=Path('tools/geoapify/proxy/aze-adm0.geojson').read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),BOUNDARY_SHA)
        b=Boundary(raw,BOUNDARY_SHA)
        for lat,lon in [(40.4093,49.8671),(40.5897,49.6686),(40.6828,46.3606),(41.2,47.17),(41.3611,48.5134),(41.1783,48.1261),(38.75,48.85),(39.99,46.93),(39.21,45.41)]:
            self.assertTrue(b.contains(lon,lat))
        for lat,lon in [(40.18,44.51),(41.72,44.79),(38.08,46.29),(40,0)]:self.assertFalse(b.contains(lon,lat))

    def test_guest_issuer_crypto_cookie_no_login_required_and_persistent_rate(self):
        req={'REQUEST_METHOD':'POST','HTTP_ORIGIN':self.origin,'HTTP_X_AUSTA_MAP_SESSION':'1'}
        (status,headers),body=self.call('/map-api/session',**req)
        self.assertTrue(status.startswith('200'));cookie=headers['Set-Cookie']
        for flag in ['Secure','HttpOnly','SameSite=Strict','Path=/']:self.assertIn(flag,cookie)
        cookie=cookie.split(';')[0]
        status,_=self.call('/map-api/places',HTTP_COOKIE=cookie,QUERY_STRING='box=49.84,40.38,49.90,40.44&category=fuel')
        self.assertTrue(status[0].startswith('200'))
        status,_=self.call('/map-api/places',QUERY_STRING='box=49.84,40.38,49.90,40.44&category=fuel')
        self.assertTrue(status[0].startswith('401'))
        status,_=self.call('/map-api/places',HTTP_COOKIE=cookie,REMOTE_ADDR='127.0.0.2',QUERY_STRING='box=49.84,40.38,49.90,40.44&category=fuel')
        self.assertTrue(status[0].startswith('401'))
        token=cookie.split('=',1)[1]
        sessions=GuestSessions('1'*64,Store(self.path,network_client_minute=60))
        self.assertIsNone(sessions.authenticate({'HTTP_COOKIE':COOKIE+'='+token[:-1]+'x','REMOTE_ADDR':'127.0.0.1'}))
        self.assertIsNone(GuestSessions('2'*64,self.store).authenticate({'HTTP_COOKIE':cookie,'REMOTE_ADDR':'127.0.0.1'}))
        self.call('/map-api/session',**req)
        (status,_),_=self.call('/map-api/session',**req)
        self.assertTrue(status.startswith('429'))
        again=GuestSessions('1'*64,Store(self.path,network_client_minute=60))
        with self.assertRaisesRegex(Denied,'SESSION_RATE'):again.issue({'REMOTE_ADDR':'127.0.0.1'})

    def test_tile_network_and_json_limits_are_independently_enforced(self):
        path=self.root/'rates.sqlite'
        store=Store(path,initialize=True,daily=1000,per_client_daily=1000,network_client_minute=60,clock=lambda:200000)
        subject='a'*64
        for i in range(20):store.admit(hashlib.sha256(('json'+str(i)).encode()).hexdigest(),subject,4)
        with self.assertRaisesRegex(Denied,'RATE'):store.admit('b'*64,subject,4)
        for i in range(40):store.admit(hashlib.sha256(('tile'+str(i)).encode()).hexdigest(),subject,1)
        with self.assertRaisesRegex(Denied,'RATE'):store.admit('c'*64,subject,1)
        # A new identity cannot bypass the unchanged global 60/minute cap.
        with self.assertRaisesRegex(Denied,'RATE'):store.admit('d'*64,'e'*64,1)

    def test_guest_global_issuance_limit_and_expired_tokens(self):
        sessions=GuestSessions('1'*64,self.store)
        cookie=sessions.issue({'REMOTE_ADDR':'192.0.2.1'}).split(';')[0]
        expired=GuestSessions('1'*64,self.store,clock=lambda:time.time()+1000)
        self.assertIsNone(expired.authenticate({'REMOTE_ADDR':'192.0.2.1','HTTP_COOKIE':cookie}))
        for i in range(2,21):sessions.issue({'REMOTE_ADDR':'192.0.2.'+str(i)})
        with self.assertRaisesRegex(Denied,'SESSION_RATE'):sessions.issue({'REMOTE_ADDR':'192.0.2.21'})

    def test_preview_builder_and_host_settings_fail_closed(self):
        from tools.geoapify.proxy.prepare_preview import prepare
        from unittest.mock import patch
        import runpy
        out=self.root/'prepared'
        prepare(out)
        self.assertTrue((out/'assets/map/data.js').is_file())
        self.assertFalse((out/'assets/map/runtime-config.json').exists())
        self.assertNotIn(self.env['GEOAPIFY_SERVER_KEY'],(out/'index.html').read_text())
        with self.assertRaises(ValueError):prepare(out)
        for overrides in [{'AUSTA_MAP_MODE':'PRODUCTION'},{'PORT':'80'},{'AUSTA_MAP_TRUSTED_PROXY_IPS':'*'}]:
            with patch.dict(os.environ,{'AUSTA_MAP_MODE':'TEST','PORT':'8080','AUSTA_MAP_TRUSTED_PROXY_IPS':'127.0.0.1',**overrides}):
                with self.assertRaises(RuntimeError):runpy.run_path('tools/geoapify/proxy/gunicorn_config.py')
        with patch.dict(os.environ,{'AUSTA_MAP_MODE':'TEST','PORT':'8080','AUSTA_MAP_TRUSTED_PROXY_IPS':'127.0.0.1'}):
            settings=runpy.run_path('tools/geoapify/proxy/gunicorn_config.py')
        self.assertIsNone(settings['accesslog']);self.assertEqual(settings['workers'],2)
        self.assertFalse(settings['reload']);self.assertEqual(settings['timeout'],20)

    def test_public_config_is_key_free_wrong_host_tls_and_static_paths_denied(self):
        (status,_),body=self.call('/assets/map/runtime-config.json')
        self.assertTrue(status.startswith('200'));d=json.loads(body)
        self.assertEqual(d['proxyPath'],'/map-api');self.assertNotIn('geoapifyBrowserKey',d)
        self.assertNotIn(self.env['GEOAPIFY_SERVER_KEY'].encode(),body)
        for path in ['/tools/geoapify/proxy/core.py','/../usage.sqlite','/assets/map/../../usage.sqlite']:
            (status,_),_=self.call(path);self.assertTrue(status.startswith('404'))
        for change in [{'HTTP_HOST':'a-usta-webside.onrender.com'},{'wsgi.url_scheme':'http'}]:
            (status,_),_=self.call(**change);self.assertTrue(status.startswith('403'))
        for change in [{'AUSTA_MAP_MODE':'PRODUCTION'},{'AUSTA_MAP_TEST_ORIGIN':'https://a-usta-webside.onrender.com'},{'GEOAPIFY_SERVER_KEY':''},{'AUSTA_MAP_SESSION_SECRET':''}]:
            with self.assertRaises(Denied):create_application({**self.env,**change})
        for change in [{'HTTP_ORIGIN':'https://evil.invalid'},{'HTTP_X_AUSTA_MAP_SESSION':''},{'CONTENT_LENGTH':'12'}]:
            request={'REQUEST_METHOD':'POST','HTTP_ORIGIN':self.origin,'HTTP_X_AUSTA_MAP_SESSION':'1',**change}
            (status,_),_=self.call('/map-api/session',**request)
            self.assertTrue(status.startswith('403'))


if __name__=='__main__':unittest.main()
