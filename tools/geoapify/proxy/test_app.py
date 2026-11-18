"""Inactive same-origin TEST preview host factory; no listener or production import."""
import hashlib
import json
import mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from .core import Boundary, Denied, Proxy, Store
from .app import application
from .sessions import GuestSessions

BOUNDARY_SHA='8578487282384781be5bf87fb4d4fe0635c1323a2bec08cd331f67f8122266fc'


def create_application(env, *, fetch=None):
    # No guessed production origin, auto-initialized ledger or browser-key fallback.
    origin=env.get('AUSTA_MAP_TEST_ORIGIN','')
    host=urlsplit(origin)
    if (env.get('AUSTA_MAP_MODE')!='TEST' or host.scheme!='https' or
            host.netloc!=host.hostname or host.path or host.query or host.fragment or
            not host.hostname.startswith('austa-map-test-') or not host.hostname.endswith('.onrender.com')):
        raise Denied('TEST_SCOPE',503)
    root=Path(env.get('AUSTA_MAP_PREVIEW_ROOT','')).resolve()
    source=Path(__file__).resolve().parents[3]
    if not root.is_dir() or root==source or source in root.parents or not (root/'index.html').is_file():
        raise Denied('PREVIEW_CONFIG',503)
    store=Store(env.get('AUSTA_MAP_LEDGER',''),network_client_minute=60)
    raw=(Path(__file__).parent/'aze-adm0.geojson').read_bytes()
    boundary=Boundary(raw,BOUNDARY_SHA)
    options={'server_key':env.get('GEOAPIFY_SERVER_KEY'),'store':store,'boundary':boundary}
    if fetch is not None:options['fetch']=fetch
    proxy=Proxy(**options)
    sessions=GuestSessions(env.get('AUSTA_MAP_SESSION_SECRET'),store)
    api=application(proxy,authenticate=sessions.authenticate,allowed_origin=origin)

    def reply(start,status,body,kind='application/json',extra=()):
        headers=[('Content-Type',kind),('Content-Length',str(len(body))),('Cache-Control','no-store'),('X-Content-Type-Options','nosniff'),*extra]
        start(status,headers);return [body]

    def app(e,start):
        try:
            if e.get('HTTP_HOST')!=host.netloc or e.get('wsgi.url_scheme')!='https':
                raise Denied('TLS_HOST',403)
            path=e.get('PATH_INFO','')
            if path=='/map-api/session':
                if (e.get('REQUEST_METHOD')!='POST' or e.get('HTTP_ORIGIN')!=origin or
                        e.get('HTTP_X_AUSTA_MAP_SESSION')!='1' or e.get('QUERY_STRING') or
                        e.get('CONTENT_LENGTH','') not in ('','0')):
                    raise Denied('SESSION_REQUEST',403)
                cookie=sessions.issue(e)
                return reply(start,'200 OK',b'{"ready":true}',extra=[('Set-Cookie',cookie)] if cookie else [])
            if path.startswith('/map-api/'):
                q=dict(e);q['PATH_INFO']=path[len('/map-api'):]
                return api(q,start)
            if e.get('REQUEST_METHOD')!='GET':raise Denied('METHOD',405)
            if path=='/assets/map/runtime-config.json':
                return reply(start,'200 OK',json.dumps({'proxyPath':'/map-api','allowedOrigins':[origin]}).encode())
            if path=='/health':return reply(start,'200 OK',b'{"mode":"TEST","ready":true}')
            relative='index.html' if path=='/' else path.lstrip('/')
            if (relative!='index.html' and not relative.startswith(('assets/map/','assets/vendor/leaflet-1.9.4/'))) or '..' in relative.split('/'):
                raise Denied('NOT_FOUND',404)
            file=(root/relative).resolve()
            if root not in file.parents or not file.is_file() or file.stat().st_size>2_000_000:
                raise Denied('NOT_FOUND',404)
            return reply(start,'200 OK',file.read_bytes(),mimetypes.guess_type(str(file))[0] or 'application/octet-stream',[
                ('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"),
                ('Referrer-Policy','same-origin')])
        except Denied as error:
            return reply(start,str(error.status)+' Error',json.dumps({'error':error.code}).encode())
        except Exception:
            return reply(start,'503 Unavailable',b'{"error":"UNAVAILABLE"}')
    return app
