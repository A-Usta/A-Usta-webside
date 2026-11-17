"""TEST-only public API preflight. No Auth sessions or hosted mutations.
The copied publishable key stays in this process; never in argv, environment, files or output.
"""
import ctypes
from ctypes import wintypes
import hashlib
import json
from pathlib import Path
import re
import ssl
import sys
import urllib.error
import urllib.request

REF = 'xnhxneziasqthkhhntkv'
LISTING = '825fdd09-3ccf-4e4f-be8c-2015ee38ea25'
URL = 'https://' + REF + '.supabase.co/rest/v1/public_service_provider_listings?id=eq.' + LISTING + '&select=id'

class Blocked(Exception):
    pass


def validate_key(key):
    # Opaque publishable keys carry no locally verifiable project claim.
    # Scope is established only by a successful authenticated HTTPS request to the fixed TEST host.
    if not isinstance(key, str) or re.fullmatch(r'sb_publishable_[A-Za-z0-9_-]{20,200}', key) is None:
        raise Blocked('COPY_TEST_PUBLISHABLE_KEY')
    return key


def clipboard_key():
    if sys.platform != 'win32':
        raise Blocked('NATIVE_WINDOWS_REQUIRED')
    user32 = ctypes.WinDLL('user32', use_last_error=True)
    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    user32.OpenClipboard.argtypes = [wintypes.HWND]; user32.OpenClipboard.restype = wintypes.BOOL
    user32.GetClipboardData.argtypes = [wintypes.UINT]; user32.GetClipboardData.restype = wintypes.HANDLE
    user32.CloseClipboard.argtypes = []; user32.CloseClipboard.restype = wintypes.BOOL
    kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]; kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]; kernel32.GlobalUnlock.restype = wintypes.BOOL
    kernel32.GlobalSize.argtypes = [wintypes.HGLOBAL]; kernel32.GlobalSize.restype = ctypes.c_size_t
    if not user32.OpenClipboard(None):
        raise Blocked('CLIPBOARD_UNAVAILABLE')
    handle = pointer = None
    try:
        handle = user32.GetClipboardData(13)  # CF_UNICODETEXT only; never execute clipboard content.
        size = kernel32.GlobalSize(handle) if handle else 0
        if not handle or not 2 <= size <= 4096:
            raise Blocked('CLIPBOARD_FORMAT')
        pointer = kernel32.GlobalLock(handle)
        if not pointer:
            raise Blocked('CLIPBOARD_UNAVAILABLE')
        key = ctypes.wstring_at(pointer, size // 2).split('\x00', 1)[0]
        return validate_key(key)
    finally:
        if pointer:
            kernel32.GlobalUnlock(handle)
        user32.CloseClipboard()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise Blocked('REDIRECT_BLOCKED')


def probe(key, opener=None):
    validate_key(key)
    # System trust store, certificate chain + fixed TEST hostname verification; proxies disabled.
    context = ssl.create_default_context()
    if context.verify_mode != ssl.CERT_REQUIRED or not context.check_hostname:
        raise Blocked('TLS_REQUIRED')
    transport = opener or urllib.request.build_opener(urllib.request.ProxyHandler({}),
        urllib.request.HTTPSHandler(context=context), NoRedirect())
    request = urllib.request.Request(URL, method='GET', headers={
        'apikey': key, 'Cache-Control': 'no-store', 'Accept-Encoding': 'identity'})
    try:
        try:
            response = transport.open(request, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            if response.status != 200:
                raise Blocked('TEST_KEY_NOT_VERIFIED')
            if response.geturl() != URL:
                raise Blocked('TARGET_CHANGED')
            data = response.read(65537)
            if len(data) > 65536:
                raise Blocked('RESPONSE_LIMIT')
            rows = json.loads(data.decode('utf-8-sig'))
            if not isinstance(rows, list) or len(rows) > 1 or any(row != {'id': LISTING} for row in rows):
                raise Blocked('TEST_RESPONSE_SHAPE')
        return {'test_scope_tls_public_key': 'PASS', 'target': REF,
                'http_requests': 1, 'hosted_mutations': 0, 'auth_AB': 'NOT_TESTED',
                'storage_absence': 'NOT_VERIFIED', 'merge_ready': False}
    finally:
        request = key = None


def verify_manifest(root):
    lines = (root / 'MANIFEST.sha256').read_text(encoding='ascii').splitlines()
    seen = set()
    for line in lines:
        match = re.fullmatch(r'([0-9a-f]{64})  ([A-Za-z0-9_./-]+)', line)
        if not match:
            raise Blocked('MANIFEST_FORMAT')
        digest, name = match.groups()
        path = (root / name).resolve()
        if root.resolve() not in path.parents or name in seen or path.is_symlink():
            raise Blocked('MANIFEST_PATH')
        seen.add(name)
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise Blocked('MANIFEST_HASH')
    if not {'clipboard_preflight.py', 'Start-R7W.ps1', 'test_clipboard_preflight.py'} <= seen:
        raise Blocked('MANIFEST_INCOMPLETE')


def main():
    key = None
    try:
        if len(sys.argv) != 1:
            raise Blocked('NO_KEY_ARGUMENTS_ACCEPTED')
        verify_manifest(Path(__file__).resolve().parent)
        key = clipboard_key()
        result = probe(key)
        print(json.dumps(result, sort_keys=True))
        # Preflight success is never a full Gate1/cleanup/merge certificate.
        return 0
    except BaseException:
        print('{"result":"PREFLIGHT_BLOCKED","hosted_mutations":0,"merge_ready":false}')
        return 2
    finally:
        key = None

if __name__ == '__main__':
    sys.exit(main())
