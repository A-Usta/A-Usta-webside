# Isolated TEST host configuration — prepared, not deployed

`test_app.create_application(env)` mounts the real proxy on `/map-api`, issues
bounded signed guest cookies on `/map-api/session`, serves an isolated map-only
preview and returns key-free runtime configuration. It accepts only HTTPS
`austa-map-test-*.onrender.com` TEST origins. The production backend is not imported.

Populate the blank configuration fields in `test-config.example.json` only via
the selected TEST host's protected configuration. Never commit a filled file.
`GEOAPIFY_SERVER_KEY` must be a separate TEST credential; the factory does not
read `GEOAPIFY_BROWSER_KEY`. `AUSTA_MAP_SESSION_SECRET` is an independent random
64-hex-character server secret, not a public signing key. Neither is sent to JS.

Prepare the preview with the existing `tools/geoapify/preview.cjs` outside the
repository, and set AUSTA_MAP_PREVIEW_ROOT to that directory. The preview uses
the actual map modules but disconnects Supabase; it does not invent A-USTA rows.
The source frontend on a same-origin integrated site retains its existing
public-provider RPC, Account and order flows.

AUSTA_MAP_LEDGER must point to an existing owner-only ledger on a verified durable
local volume, outside the checkout. Provision it once through
`Store(path, initialize=True, network_client_minute=60)` in an owner-only 0700
directory. Startup never initializes, deletes or resets a missing ledger.
Do not add initialization to a deploy or restart command. An older meter with
a different persisted policy fails closed: any explicit policy upgrade must
preserve usage/rate/cache state and be reviewed, never delete the meter.

The TEST factory separates 60 total network requests/minute per principal from
20 JSON requests/minute. Global 60/minute and daily 60 credits/per-principal
30 credits remain. This accommodates visible tiles without treating them as
JSON searches. Cache hits consume rate admission. Guest creation has a separate
persistent 20/minute global and 2/minute per verified network peer limit.
All admission paths share the same private transactional store. Clearing the
cookie does not change the peer-bound budget principal. Tokens expire after
899 seconds, are HMAC verified, IP bound and Secure/HttpOnly/SameSite=Strict.
They authorize only public external map data, never A-USTA account/private data.

Mount the WSGI factory in a reviewed HTTPS host. The host must set a verified
HTTPS `wsgi.url_scheme`, preserve the exact Host and provide the actual trusted
network peer as REMOTE_ADDR. Do not copy arbitrary X-Forwarded-For into it.
If the ingress peer is shared, users safely share limits; confirm the ingress
adapter before live availability certification. Configure a bounded worker pool,
hard request/DNS/header deadlines and access logs without queries/cookies/tokens.
This package supplies no unrestricted listener or public debug console.

## Zero-extra-cost constraint

The Render connection currently has no selected workspace, so no service or
persistent volume has been identified or modified. Resource absence is not
claimed. Current Render disk documentation says runtime files are ephemeral by
default and service-attached persistent disks require a paid service:
https://render.com/docs/disks

No plan, disk, database, service, Blueprint sync or automatic deploy was created.
An existing approved TEST service with an already-funded durable volume may be
usable after inventory. A new free ephemeral filesystem cannot be called a
persistent budget store. If no eligible existing resource is available, this
host remains blocked under the no-extra-cost instruction; do not silently
replace durable admission with memory or reset it after restart.

## Live gates still required

Verify TEST project/key identity and egress restrictions without printing keys.
Check provider dashboard usage before and a few minutes after bounded testing.
Alfiya Tarasenko's earlier 15 November guidance confirms there is no usage API
or guaranteed ten-second accounting latency; geocoding costs one credit and
OPTIONS costs zero. The 18 November security follow-up has no reply at this check.
No duplicate mail was sent.

Run actual nine-region desktop/mobile tile/marker/filter/geocode/directions/
retry/empty-state QA only against this verified TEST host with a separately
configured server key and appropriate bounded test budget. Record provider
coverage honestly. The supplied ADM0 geometry is pinned real cartographic data;
see BOUNDARY.md for provenance, attribution and precision limits.

Only after successful live server-side verification, update dependent TEST
clients, revoke/rotate the old browser key through the authenticated provider
account, and verify old-key denial independently (including headerless calls).
Do not publish either key in a report, screenshot, trace, URL log or ZIP.
No key rotation or account setting change has been made by this implementation.

## Prepared Python host entry point (not activated)

The Python-only `prepare_preview` module creates a new, secret-free map preview
outside the checkout and refuses an existing destination or source-tree write.
The TEST server entry point is `tools.geoapify.proxy.wsgi:application`; bounded
Gunicorn settings are in `gunicorn_config.py`. Its single pinned official PyPI
wheel is hash locked in `requirements-test-host.txt`. No optional dependencies,
automatic deploy or ledger-reset hook are included. The two synchronous workers
have hard timeouts, bounded request lines/headers/backlog, no access log, no
reload/debug mode and explicit trusted proxy IPs (no wildcard). TLS termination
and actual ingress peer forwarding remain host verification gates.

The agent can apply this prepared configuration to a verified existing TEST
resource only after the Render workspace/resource and zero incremental cost are
confirmed. It is deliberately not an automatically applied render.yaml or a new
paid service declaration. The example has blank secret/origin/path fields and
fails closed until populated through protected TEST configuration.
