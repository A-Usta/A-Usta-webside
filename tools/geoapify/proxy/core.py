"""Server-only Geoapify proxy core. Not registered with the production backend.

The host must supply verified session principals, trusted AZ boundary geometry,
one shared private durable store and TLS termination. No public token issuer.
"""
from __future__ import annotations
import hashlib
import json
import math
import os
from pathlib import Path
import re
import secrets
import sqlite3
import ssl
import stat
import time
import zlib
import http.client
from contextlib import closing
from dataclasses import dataclass

CATEGORIES = {
    'fuel': 'service.vehicle.fuel', 'charging': 'service.vehicle.charging_station',
    'repair': 'service.vehicle.repair', 'wash': 'service.vehicle.car_wash',
}
ENVELOPE = (44.7, 38.3, 50.8, 41.95)
MAX_BODY = 2_000_000

class Denied(Exception):
    """Only this constant code may leave the server. Never interpolate upstream errors."""
    def __init__(self, code='DENIED', status=403):
        self.code, self.status = code, status
        super().__init__(code)

@dataclass(frozen=True)
class Principal:
    # Construct only after host authentication, never from client IP/header/query.
    subject: str
    expires: float


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def pairs(values):
    if not isinstance(values, list) or any(not isinstance(p, (tuple, list)) or len(p) != 2 for p in values):
        raise Denied('PARAMETERS', 400)
    if any(not isinstance(k, str) or not isinstance(v, str) for k, v in values):
        raise Denied('PARAMETERS', 400)
    result = dict(values)
    if len(result) != len(values):
        raise Denied('PARAMETERS', 400)
    return result


class Boundary:
    """Pinned operator-supplied GeoJSON; never fetch geometry from a client URL."""
    def __init__(self, raw: bytes, expected_sha256: str):
        if len(raw) > MAX_BODY or hashlib.sha256(raw).hexdigest() != expected_sha256:
            raise Denied('BOUNDARY_CONFIG', 503)
        try:
            shape = json.loads(raw)
            if shape.get('type') == 'Polygon':
                polygons = [shape['coordinates']]
            elif shape.get('type') == 'MultiPolygon':
                polygons = shape['coordinates']
            else:
                raise ValueError()
            count = 0
            if not isinstance(polygons, list) or not polygons:
                raise ValueError()
            for polygon in polygons:
                if not isinstance(polygon, list) or not polygon:
                    raise ValueError()
                for ring in polygon:
                    if not isinstance(ring, list) or len(ring) < 4 or ring[0] != ring[-1]:
                        raise ValueError()
                    for point in ring:
                        if len(point) != 2 or not all(finite(v) for v in point):
                            raise ValueError()
                        x, y = point
                        if not ENVELOPE[0] <= x <= ENVELOPE[2] or not ENVELOPE[1] <= y <= ENVELOPE[3]:
                            raise ValueError()
                        count += 1
                        if count > 100_000:
                            raise ValueError()
            self.polygons = polygons
        except (ValueError, TypeError, KeyError, AttributeError):
            raise Denied('BOUNDARY_CONFIG', 503) from None

    @staticmethod
    def ring_contains(ring, x, y):
        inside = False
        for (a, b), (c, d) in zip(ring, ring[1:]):
            # Include boundary segments; holes are excluded by contains().
            if min(a, c) <= x <= max(a, c) and min(b, d) <= y <= max(b, d) and abs((x-a)*(d-b)-(y-b)*(c-a)) < 1e-12:
                return True
            if (b > y) != (d > y) and x < (c-a)*(y-b)/(d-b)+a:
                inside = not inside
        return inside

    def contains(self, x, y):
        return any(self.ring_contains(p[0], x, y) and not any(self.ring_contains(h, x, y) for h in p[1:]) for p in self.polygons)

    def viewport(self, value):
        try:
            box = tuple(float(x) for x in value.split(','))
        except (ValueError, AttributeError):
            raise Denied('BOUNDS', 400) from None
        if len(box) != 4 or not all(finite(v) for v in box):
            raise Denied('BOUNDS', 400)
        w, s, e, n = box
        if not (ENVELOPE[0] <= w < e <= ENVELOPE[2] and ENVELOPE[1] <= s < n <= ENVELOPE[3] and e-w <= .5 and n-s <= .5):
            raise Denied('BOUNDS', 400)
        if not self.contains((w+e)/2, (s+n)/2):
            raise Denied('BOUNDS', 400)
        return box


class Store:
    """One durable SQLite file shared by all workers on ONE host/volume.

    BEGIN IMMEDIATE serializes admission across independent processes. No refund
    after upstream failures. Losing the store must stop traffic, never recreate it.
    Initialization is explicit; request paths use mode=rw (never auto-create).
    """
    def __init__(self, path, *, initialize=False, daily=240, per_client_daily=120,
                 global_minute=60, client_minute=20, clock=time.time):
        self.path = Path(path).absolute()
        self.clock = clock
        self.limits = daily, per_client_daily, global_minute, client_minute
        if any(type(v) is not int or not 1 <= v <= 100_000 for v in self.limits):
            raise Denied('STORE_CONFIG', 503)
        parent = self.path.parent
        if parent.is_symlink() or parent.resolve() != parent or not parent.is_dir() or parent.stat().st_uid != os.getuid() or stat.S_IMODE(parent.stat().st_mode) & 0o077:
            raise Denied('STORE_CONFIG', 503)
        if initialize:
            fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
            os.close(fd)
        self._verify_file()
        if initialize:
            with closing(self._db()) as db:
                db.executescript('''
                PRAGMA journal_mode=WAL;
                CREATE TABLE meta(singleton INTEGER PRIMARY KEY CHECK(singleton=1), highwater REAL NOT NULL, policy TEXT NOT NULL);

                CREATE TABLE usage(day INTEGER, subject TEXT, units INTEGER NOT NULL, PRIMARY KEY(day,subject));
                CREATE TABLE rate(minute INTEGER, subject TEXT, calls INTEGER NOT NULL, PRIMARY KEY(minute,subject));
                CREATE TABLE cache(key TEXT PRIMARY KEY, expiry REAL NOT NULL, mime TEXT NOT NULL, body BLOB NOT NULL);
                CREATE TABLE lease(key TEXT PRIMARY KEY, owner TEXT NOT NULL, expiry REAL NOT NULL);
                ''')
                db.execute('INSERT INTO meta VALUES(1,0,?)', (json.dumps(self.limits),))
        # A replacement empty file or lost schema fails at startup too.
        with closing(self._db()) as db:
            policy = db.execute('SELECT policy FROM meta WHERE singleton=1').fetchone()
            if not policy or policy[0] != json.dumps(self.limits):
                raise Denied('STORE_CONFIG', 503)

    def _verify_file(self):
        try:
            info = self.path.lstat()
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
                raise ValueError()
        except (OSError, ValueError):
            raise Denied('STORE_UNAVAILABLE', 503) from None

    def _db(self):
        self._verify_file()
        db = None
        try:
            db = sqlite3.connect(self.path.as_uri()+'?mode=rw', uri=True, timeout=2, isolation_level=None)
            db.execute('PRAGMA synchronous=FULL')
            return db
        except sqlite3.Error:
            if db is not None:
                db.close()
            raise Denied('STORE_UNAVAILABLE', 503) from None

    def admit(self, key, subject, cost):
        if not re.fullmatch(r'[a-f0-9]{64}', key) or not re.fullmatch(r'[a-f0-9]{64}', subject) or type(cost) is not int or cost not in (1, 4, 12):
            raise Denied('ADMISSION', 503)
        now = self.clock()
        day, minute = int(now//86400), int(now//60)
        owner = secrets.token_hex(16)
        db = self._db()
        try:
            db.execute('BEGIN IMMEDIATE')
            high = db.execute('SELECT highwater FROM meta WHERE singleton=1').fetchone()[0]
            if now < high-5:
                raise Denied('CLOCK', 503)
            db.execute('UPDATE meta SET highwater=max(highwater,?)', (now,))
            for who, limit in [('*', self.limits[2]), (subject, self.limits[3])]:
                calls = db.execute('SELECT calls FROM rate WHERE minute=? AND subject=?', (minute, who)).fetchone()
                if calls and calls[0] >= limit:
                    raise Denied('RATE', 429)
                db.execute('INSERT INTO rate VALUES(?,?,1) ON CONFLICT(minute,subject) DO UPDATE SET calls=calls+1', (minute, who))
            cached = db.execute('SELECT mime,body FROM cache WHERE key=? AND expiry>?', (key, now)).fetchone()
            if cached:
                db.commit()
                return 'cached', cached
            busy = db.execute('SELECT expiry FROM lease WHERE key=?', (key,)).fetchone()
            if busy and busy[0] > now:
                db.commit()
                return 'wait', None
            for who, limit in [('*', self.limits[0]), (subject, self.limits[1])]:
                used = db.execute('SELECT units FROM usage WHERE day=? AND subject=?', (day, who)).fetchone()
                if used and used[0]+cost > limit or cost > limit:
                    raise Denied('BUDGET', 429)
                db.execute('INSERT INTO usage VALUES(?,?,?) ON CONFLICT(day,subject) DO UPDATE SET units=units+excluded.units', (day, who, cost))
            db.execute('INSERT INTO lease VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET owner=excluded.owner,expiry=excluded.expiry', (key, owner, now+15))
            db.execute('DELETE FROM rate WHERE minute<?', (minute-2,))
            db.execute('DELETE FROM usage WHERE day<?', (day-2,))
            db.execute('DELETE FROM cache WHERE expiry<=?', (now,))
            db.execute('DELETE FROM lease WHERE expiry<=?', (now,))
            db.commit()
            return 'owner', owner
        except sqlite3.Error:
            raise Denied('STORE_UNAVAILABLE', 503) from None
        finally:
            if db.in_transaction:
                db.rollback()
            db.close()

    def cached(self, key):
        with closing(self._db()) as db:
            return db.execute('SELECT mime,body FROM cache WHERE key=? AND expiry>?', (key, self.clock())).fetchone()

    def finish(self, key, owner, result=None, ttl=60):
        db = self._db()
        try:
            db.execute('BEGIN IMMEDIATE')
            lease = db.execute('SELECT owner,expiry FROM lease WHERE key=?', (key,)).fetchone()
            if not lease or lease[0] != owner or lease[1] <= self.clock():
                raise Denied('LEASE', 503)
            if result:
                mime, body = result
                db.execute('INSERT OR REPLACE INTO cache VALUES(?,?,?,?)', (key, self.clock()+ttl, mime, body))
                db.execute('DELETE FROM cache WHERE key IN (SELECT key FROM cache ORDER BY expiry DESC LIMIT -1 OFFSET 64)')
            db.execute('DELETE FROM lease WHERE key=? AND owner=?', (key, owner))
            db.commit()
        finally:
            if db.in_transaction:
                db.rollback()
            db.close()


def transport(url):
    # Fixed HTTPS hosts only; no environment proxy, cookies, redirects or custom CA.
    from urllib.parse import urlsplit
    u = urlsplit(url)
    if u.scheme != 'https' or u.netloc not in ('api.geoapify.com', 'maps.geoapify.com') or u.fragment:
        raise Denied('UPSTREAM', 502)
    conn = http.client.HTTPSConnection(u.netloc, timeout=8, context=ssl.create_default_context())
    deadline = time.monotonic()+8
    try:
        conn.connect()
        sock = conn.sock
        def remaining():
            value = deadline-time.monotonic()
            if value <= 0 or sock is None:
                raise Denied('UPSTREAM', 502)
            return value
        sock.settimeout(remaining())
        conn.request('GET', u.path+'?'+u.query, headers={'Accept': 'application/json,image/png'})
        sock.settimeout(remaining())
        response = conn.getresponse()
        if response.status != 200 or sock is None:
            raise Denied('UPSTREAM', 502)
        parts, size = [], 0
        while True:
            remaining = deadline-time.monotonic()
            if remaining <= 0:
                raise Denied('UPSTREAM', 502)
            sock.settimeout(remaining)
            chunk = response.read1(min(65536, MAX_BODY+1-size))
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_BODY:
                raise Denied('UPSTREAM', 502)
            parts.append(chunk)
        mime = response.getheader('Content-Type', '').split(';')[0].strip().lower()
        return mime, b''.join(parts)
    except Exception:
        raise Denied('UPSTREAM', 502) from None
    finally:
        conn.close()


class Proxy:
    def __init__(self, *, server_key, store, boundary, fetch=transport, clock=time.time):
        if not isinstance(server_key, str) or not re.fullmatch(r'[A-Za-z0-9_-]{20,100}', server_key) or server_key.startswith('sb_'):
            raise Denied('SERVER_CONFIG', 503)
        self._key, self.store, self.boundary, self.fetch, self.clock = server_key, store, boundary, fetch, clock

    def _plan(self, route, params):
        from urllib.parse import urlencode
        p = pairs(params)
        box = None
        if route == '/places':
            if set(p)-{'box', 'category', 'page', 'name'} or not {'box', 'category'} <= set(p):
                raise Denied('PARAMETERS', 400)
            box = self.boundary.viewport(p['box'])
            category = p['category']
            if category not in (*CATEGORIES, 'all') or p.get('page', '0') not in ('0', '1', '2'):
                raise Denied('PARAMETERS', 400)
            name = p.get('name', '')
            if len(name) > 120 or any(ord(c)<32 for c in name):
                raise Denied('PARAMETERS', 400)
            q = {'categories': CATEGORIES.get(category, ','.join(CATEGORIES.values())),
                 'filter': 'rect:'+','.join(format(v,'.8g') for v in box), 'limit': '20',
                 'offset': str(int(p.get('page','0'))*20), 'lang': 'az'}
            if name:
                q['name'] = name
            endpoint, cost, ttl = 'https://api.geoapify.com/v2/places', 12, 60
        elif route == '/geocode':
            if set(p) != {'text'} or not 2 <= len(p['text']) <= 120 or any(ord(c)<32 for c in p['text']):
                raise Denied('PARAMETERS', 400)
            q = {'text': p['text'], 'filter': 'countrycode:az', 'limit': '5', 'lang': 'az'}
            endpoint, cost, ttl = 'https://api.geoapify.com/v1/geocode/search', 4, 0
        elif route == '/tile':
            if set(p) != {'box','z','x','y'} or any(not re.fullmatch(r'\d{1,6}',p[k]) for k in ('z','x','y')):
                raise Denied('PARAMETERS', 400)
            box = self.boundary.viewport(p['box'])
            z, x, y = (int(p[k]) for k in ('z','x','y'))
            if not 12 <= z <= 18 or x >= 2**z or y >= 2**z:
                raise Denied('PARAMETERS', 400)
            def lat(row):
                return math.degrees(math.atan(math.sinh(math.pi*(1-2*row/2**z))))
            w, e, s, n = x/2**z*360-180, (x+1)/2**z*360-180, lat(y+1), lat(y)
            if e < box[0] or w > box[2] or n < box[1] or s > box[3]:
                raise Denied('BOUNDS', 400)
            endpoint, q, cost, ttl = f'https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png', {}, 1, 300
        else:
            raise Denied('ENDPOINT', 404)
        canonical = endpoint+'?'+urlencode(sorted(q.items()))
        # Spatial viewport is part of the tile identity/admission, never a URL override.
        cache_key = hashlib.sha256((canonical+str(box)+(secrets.token_hex(16) if route == '/geocode' else '')).encode()).hexdigest()
        q['apiKey'] = self._key
        return cache_key, endpoint+'?'+urlencode(q), cost, ttl, box

    def _response(self, route, mime, body, box):
        if not isinstance(body, bytes) or len(body) > MAX_BODY or self._key.encode() in body:
            raise Denied('UPSTREAM', 502)
        if route == '/tile':
            # Bounded complete PNG structure; reject truncation, bad CRC and metadata.
            if mime != 'image/png' or len(body)<45 or body[:8] != b'\x89PNG\r\n\x1a\n':
                raise Denied('UPSTREAM', 502)
            offset, chunks, ended, idat = 8, 0, False, False
            while offset < len(body):
                if offset+12 > len(body) or chunks >= 1024:
                    raise Denied('UPSTREAM', 502)
                size = int.from_bytes(body[offset:offset+4],'big')
                kind = body[offset+4:offset+8]
                end = offset+12+size
                if end > len(body) or kind not in (b'IHDR', b'PLTE', b'IDAT', b'tRNS', b'IEND'):
                    raise Denied('UPSTREAM', 502)
                if zlib.crc32(body[offset+4:end-4]) & 0xffffffff != int.from_bytes(body[end-4:end],'big'):
                    raise Denied('UPSTREAM', 502)
                if chunks == 0:
                    if kind != b'IHDR' or size != 13 or not all(1 <= int.from_bytes(body[i:i+4],'big') <= 512 for i in (16,20)):
                        raise Denied('UPSTREAM', 502)
                elif kind == b'IHDR':
                    raise Denied('UPSTREAM', 502)
                idat |= kind == b'IDAT'
                offset, chunks = end, chunks+1
                if kind == b'IEND':
                    if size or offset != len(body) or not idat:
                        raise Denied('UPSTREAM', 502)
                    ended = True
                    break
            if not ended:
                raise Denied('UPSTREAM', 502)
            return mime, body
        if mime not in ('application/json','application/geo+json'):
            raise Denied('UPSTREAM', 502)
        try:
            data = json.loads(body)
            if not isinstance(data, dict) or data.get('type') != 'FeatureCollection' or not isinstance(data.get('features'), list) or len(data['features']) > (5 if route == '/geocode' else 20):
                raise ValueError()
            features = []
            for f in data['features']:
                p, g = f['properties'], f['geometry']
                c = g['coordinates']
                if not isinstance(p, dict) or g.get('type') != 'Point' or not isinstance(c, list) or len(c) != 2 or not all(finite(v) for v in c):
                    raise ValueError()
                x,y = c
                if str(p.get('country_code','')).lower() != 'az' or not self.boundary.contains(x,y):
                    continue
                if box and not (box[0] <= x <= box[2] and box[1] <= y <= box[3]):
                    continue
                safe = {'country_code': 'az'}
                for field in ('name','formatted','city','county','address_line2','place_id'):
                    value = p.get(field)
                    if isinstance(value, str) and len(value) <= (2048 if field=='place_id' else 300):
                        if self._key in value or any(ord(c)<32 for c in value):
                            raise ValueError()
                        safe[field] = value
                if route == '/places':
                    cats = p.get('categories', [])
                    if not isinstance(cats, list):
                        raise ValueError()
                    safe['categories'] = [v for v in cats if isinstance(v,str) and len(v)<100 and any(v==base or v.startswith(base+'.') for base in CATEGORIES.values())][:20]
                    if not safe['categories']:
                        continue
                features.append({'type':'Feature','properties':safe,'geometry':{'type':'Point','coordinates':c}})
            return 'application/json', json.dumps({'type':'FeatureCollection','features':features},allow_nan=False,separators=(',',':')).encode()
        except (ValueError, TypeError, KeyError, AttributeError, UnicodeError):
            raise Denied('UPSTREAM', 502) from None

    def handle(self, principal, route, params):
        # Origin/Referer are intentionally not an authorization mechanism.
        if not isinstance(principal, Principal) or not isinstance(principal.subject, str) or not re.fullmatch(r'[A-Za-z0-9_-]{16,128}',principal.subject) or not finite(principal.expires) or not self.clock() < principal.expires <= self.clock()+900:
            raise Denied('AUTH', 401)
        key, url, cost, ttl, box = self._plan(route, params)
        # Hash identities; no session token, query text, key or raw URL is persisted.
        subject = hashlib.sha256(principal.subject.encode()).hexdigest()
        state, value = self.store.admit(key, subject, cost)
        if state == 'cached':
            return value
        if state == 'wait':
            deadline = time.monotonic()+10
            while time.monotonic() < deadline:
                result = self.store.cached(key)
                if result:
                    return result
                time.sleep(.025)
            raise Denied('BUSY', 503)
        try:
            result = self._response(route, *self.fetch(url), box)
            self.store.finish(key, value, result if ttl else None, ttl)
            return result
        except Exception:
            # Never expose upstream exception or secret-bearing URL. Failed attempts stay charged.
            try:
                self.store.finish(key, value)
            except Exception:
                pass
            raise Denied('UPSTREAM', 502) from None
