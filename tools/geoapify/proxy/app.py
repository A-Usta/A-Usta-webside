"""WSGI adapter: mount on an ISOLATED TEST host only after infrastructure review.
No listener, credential loader, production import or deployment side effect.
"""
import json
import re
from urllib.parse import parse_qsl, urlsplit
from .core import Denied


def application(proxy, *, authenticate, allowed_origin):
    # authenticate(environ) must verify a server-side session; never trust a
    # caller-supplied Principal, X-Forwarded-For or unsigned identity header.
    u = urlsplit(allowed_origin)
    if u.scheme != 'https' or u.netloc != u.hostname or u.path or u.query or u.fragment or not callable(authenticate):
        raise Denied('SERVER_CONFIG', 503)

    def app(environ, start_response):
        headers = [('Cache-Control', 'no-store'), ('X-Content-Type-Options','nosniff'), ('Vary','Origin')]
        try:
            if environ.get('REQUEST_METHOD') != 'GET':
                raise Denied('METHOD', 405)
            # Additional browser check, NOT the authentication boundary.
            origin = environ.get('HTTP_ORIGIN')
            if origin:
                if origin != allowed_origin:
                    raise Denied('ORIGIN', 403)
            else:
                # Native same-origin GET fetch omits Origin. Referer is only a
                # browser CSRF signal; a verified principal is still required.
                referer = urlsplit(environ.get('HTTP_REFERER', ''))
                if (referer.scheme+'://'+referer.netloc != allowed_origin or
                        environ.get('HTTP_SEC_FETCH_SITE', 'same-origin') != 'same-origin'):
                    raise Denied('ORIGIN', 403)
            query = environ.get('QUERY_STRING', '')
            if len(query) > 2048 or re.search(r'%(?![a-fA-F0-9]{2})', query):
                raise Denied('PARAMETERS', 400)
            principal = authenticate(environ)
            params = parse_qsl(query, keep_blank_values=True, strict_parsing=True, max_num_fields=8, errors='strict')
            mime, body = proxy.handle(principal, environ.get('PATH_INFO',''), params)
            headers += [('Content-Type', mime), ('Access-Control-Allow-Origin', allowed_origin)]
            status = 200
        except Denied as error:
            status = error.status
            body = json.dumps({'error': error.code}, separators=(',',':')).encode()
            headers.append(('Content-Type','application/json'))
        except Exception:
            # Never serialize raw URL, traceback, credential, auth or provider errors.
            status, body = 503, b'{"error":"UNAVAILABLE"}'
            headers.append(('Content-Type','application/json'))
        headers.append(('Content-Length',str(len(body))))
        start_response(str(status)+' '+{200:'OK',400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',405:'Method Not Allowed',429:'Too Many Requests',502:'Bad Gateway',503:'Service Unavailable'}.get(status,'Error'), headers)
        return [body]
    return app
