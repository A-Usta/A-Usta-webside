"""Offline real Gunicorn config/startup check; never binds a port or calls Geoapify."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from tools.geoapify.proxy.core import Store
from tools.geoapify.proxy.prepare_preview import prepare

with tempfile.TemporaryDirectory() as directory:
    root=Path(directory);preview=root/'preview';prepare(preview)
    meter=root/'meter.sqlite';Store(meter,initialize=True,network_client_minute=60)
    env={**os.environ,'AUSTA_MAP_MODE':'TEST','AUSTA_MAP_TEST_ORIGIN':'https://austa-map-test-fixture.onrender.com','AUSTA_MAP_PREVIEW_ROOT':str(preview),'AUSTA_MAP_LEDGER':str(meter),'GEOAPIFY_SERVER_KEY':'SYNTHETIC_TEST_HOST_CREDENTIAL_NOT_LIVE','AUSTA_MAP_SESSION_SECRET':'1'*64,'AUSTA_MAP_TRUSTED_PROXY_IPS':'127.0.0.1','PORT':'8080','PYTHONDONTWRITEBYTECODE':'1'}
    result=subprocess.run([sys.executable,'-B','-m','gunicorn','--check-config','--config','tools/geoapify/proxy/gunicorn_config.py','tools.geoapify.proxy.wsgi:application'],env=env,capture_output=True,timeout=20)
    if result.returncode:raise RuntimeError('TEST_HOST_CONFIG_FAILED')
print('TEST_HOST_CONFIG_PASS; network=0; listener=0; credentials=synthetic')
