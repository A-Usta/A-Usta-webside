import tempfile
import hashlib
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import ssl
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('clipboard_preflight', Path(__file__).with_name('clipboard_preflight.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
KEY = 'sb_publishable_' + 'synthetic_not_a_real_key_1234567890'

class Response:
    status = 200
    def geturl(self): return m.URL
    def read(self, limit): return b'[]'
    def __enter__(self): return self
    def __exit__(self,*args): pass

class Transport:
    def __init__(self, response=None): self.calls=[]; self.response=response or Response()
    def open(self, request, timeout):
        self.calls.append(request)
        assert request.full_url == m.URL
        assert request.method == 'GET'
        assert request.data is None
        assert timeout == 10
        assert request.get_header('Apikey') == KEY
        assert not request.has_header('Authorization')
        return self.response

class Tests(unittest.TestCase):
    def test_publishable_only_no_whitespace_or_secret(self):
        self.assertEqual(m.validate_key(KEY),KEY)
        for bad in ['sb_secret_'+('x'*30),'sb_publishable_',KEY+'\n',' '+KEY,KEY+'\u200b','eyJ.fake.jwt','https://bad',1]:
            with self.assertRaises(m.Blocked):m.validate_key(bad)
    def test_fixed_test_scope_get_tls_and_no_mutations(self):
        t=Transport();r=m.probe(KEY,t)
        self.assertEqual(len(t.calls),1);self.assertEqual(r['hosted_mutations'],0)
        self.assertFalse(r['merge_ready']);self.assertEqual(r['storage_absence'],'NOT_VERIFIED')
        self.assertNotIn(KEY,json.dumps(r))
    def test_401_403_404_never_absence_or_success(self):
        for code in [301,401,403,404,500]:
            r=Response();r.status=code
            with self.assertRaises(m.Blocked):m.probe(KEY,Transport(r))
    def test_redirect_target_and_wrong_rows_rejected(self):
        r=Response();r.geturl=lambda:'https://other.supabase.co/'
        with self.assertRaises(m.Blocked):m.probe(KEY,Transport(r))
        r=Response();r.read=lambda n:b'[{"id":"wrong"}]'
        with self.assertRaises(m.Blocked):m.probe(KEY,Transport(r))
    def test_redirect_handler_denies(self):
        with self.assertRaises(m.Blocked):m.NoRedirect().redirect_request()
    def test_main_sanitizes_all_failures(self):
        out=io.StringIO()
        with patch.object(m,'verify_manifest'),patch.object(m,'clipboard_key',side_effect=RuntimeError(KEY)),patch.object(m.sys,'argv',['clipboard_preflight.py']),contextlib.redirect_stdout(out):
            self.assertEqual(m.main(),2)
        self.assertNotIn(KEY,out.getvalue());self.assertNotIn('RuntimeError',out.getvalue())
    def test_system_tls_cannot_be_disabled(self):
        ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT);ctx.check_hostname=False;ctx.verify_mode=ssl.CERT_NONE
        with patch.object(m.ssl,'create_default_context',return_value=ctx),self.assertRaises(m.Blocked):m.probe(KEY,Transport())
    def test_manifest_accepts_vendor_names_and_rejects_tamper_or_traversal(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            names=['clipboard_preflight.py','Start-R7W.ps1','test_clipboard_preflight.py','vendor/@scope/a+1.txt']
            lines=[]
            for name in names:
                p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'synthetic')
                lines.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+name)
            manifest=root/'MANIFEST.sha256';manifest.write_text('\n'.join(lines))
            m.verify_manifest(root)
            (root/names[0]).write_bytes(b'tampered')
            with self.assertRaises(m.Blocked):m.verify_manifest(root)
            manifest.write_text(hashlib.sha256(b'').hexdigest()+'  ../outside')
            with self.assertRaises(m.Blocked):m.verify_manifest(root)
    def test_powershell_reads_confirmation_before_python_clipboard(self):
        s=Path(__file__).with_name('Start-R7W.ps1').read_text()
        self.assertLess(s.index('Read-Host'),s.rindex("clipboard_preflight.py"))
        self.assertNotIn('Get-Clipboard',s);self.assertNotIn('$env:',s)

if __name__ == '__main__':unittest.main()
