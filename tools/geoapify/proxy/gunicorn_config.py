"""Bounded TEST-only server configuration; does not create a service or disk."""
import ipaddress
import os
if os.environ.get('AUSTA_MAP_MODE')!='TEST':
    raise RuntimeError('TEST_SCOPE')
port=os.environ.get('PORT','8080')
if not port.isdigit() or not 1024<=int(port)<=65535:
    raise RuntimeError('TEST_PORT')
bind='0.0.0.0:'+port
workers=2
worker_class='sync'
threads=1
timeout=20
graceful_timeout=20
keepalive=2
backlog=64
limit_request_line=2048
limit_request_fields=40
limit_request_field_size=4096
accesslog=None
errorlog='-'
loglevel='warning'
capture_output=False
reload=False
max_requests=1000
max_requests_jitter=100
# Explicit IPs only; never blindly trust '*'. The actual Render ingress must
# be verified before setting this protected host configuration.
trusted=os.environ.get('AUSTA_MAP_TRUSTED_PROXY_IPS','127.0.0.1').split(',')
try:
    forwarded_allow_ips=','.join(str(ipaddress.ip_address(v.strip())) for v in trusted)
except ValueError:
    raise RuntimeError('TEST_PROXY_TRUST') from None
