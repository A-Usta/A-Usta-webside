"""Bounded guest admission for public map data; not an A-USTA account session."""
import base64
import hashlib
import hmac
import ipaddress
import json
from http.cookies import SimpleCookie
import re
import time
from .core import Denied, Principal

COOKIE = '__Host-austa-map'


class GuestSessions:
    def __init__(self, secret, store, clock=time.time):
        if not isinstance(secret,str) or not re.fullmatch(r'[a-f0-9]{64}',secret):
            raise Denied('SESSION_CONFIG',503)
        self.secret=bytes.fromhex(secret)
        self.store,self.clock=store,clock

    def _subject(self,environ):
        try:
            address=str(ipaddress.ip_address(environ.get('REMOTE_ADDR','')))
        except ValueError:
            raise Denied('SESSION_PEER',403) from None
        # Do not trust client-supplied X-Forwarded-For. A reviewed ingress adapter
        # must provide the actual peer; shared proxy peers safely share a limit.
        return hmac.new(self.secret,b'peer:'+address.encode(),hashlib.sha256).hexdigest()

    def authenticate(self,environ):
        try:
            raw=environ.get('HTTP_COOKIE','')
            if len(raw)>4096 or raw.count(COOKIE+'=')!=1:
                return None
            cookies=SimpleCookie();cookies.load(raw)
            token=cookies[COOKIE].value
            if len(token)>512:
                return None
            payload,signature=token.split('.')
            expected=hmac.new(self.secret,payload.encode(),hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature,expected):
                return None
            data=json.loads(base64.urlsafe_b64decode(payload+'='*((-len(payload))%4)))
            if set(data)!={'s','e'} or data['s']!=self._subject(environ) or type(data['e']) is not int or not self.clock()<data['e']<=self.clock()+900:
                return None
            return Principal('guest_'+data['s'],data['e'])
        except Exception:
            return None

    def issue(self,environ):
        existing=self.authenticate(environ)
        if existing:
            return None
        subject=self._subject(environ)
        now=self.clock();minute=int(now//60)
        db=self.store._db()
        try:
            db.execute('BEGIN IMMEDIATE')
            high=db.execute('SELECT highwater FROM meta WHERE singleton=1').fetchone()[0]
            if now<high-5:
                raise Denied('CLOCK',503)
            db.execute('UPDATE meta SET highwater=max(highwater,?)',(now,))
            for who,limit in [('session:*',20),('session:'+subject,2)]:
                count=db.execute('SELECT calls FROM rate WHERE minute=? AND subject=?',(minute,who)).fetchone()
                if count and count[0]>=limit:
                    raise Denied('SESSION_RATE',429)
                db.execute('INSERT INTO rate VALUES(?,?,1) ON CONFLICT(minute,subject) DO UPDATE SET calls=calls+1',(minute,who))
            db.execute('DELETE FROM rate WHERE minute<?',(minute-2,))
            db.commit()
        finally:
            if db.in_transaction:db.rollback()
            db.close()
        payload=base64.urlsafe_b64encode(json.dumps({'s':subject,'e':int(now)+899},separators=(',',':')).encode()).decode().rstrip('=')
        signature=hmac.new(self.secret,payload.encode(),hashlib.sha256).hexdigest()
        return COOKIE+'='+payload+'.'+signature+'; Path=/; Max-Age=899; Secure; HttpOnly; SameSite=Strict'
