"""Build only key-free TEST modules outside checkout. Never consume credentials."""
import base64,hashlib,json,mimetypes,sys
sys.dont_write_bytecode=True
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[3]))
from tools.geoapify.proxy.prepare_preview import prepare

def build(target):
    target=Path(target).absolute()
    root=Path(__file__).resolve().parents[3]
    if target.exists() or root==target or root in target.parents:raise ValueError('TARGET')
    target.mkdir(parents=True)
    preview=target/'preview';prepare(preview)
    # Replace only this isolated Cloudflare preview's stub; generic host preview is unchanged.
    index=preview/'index.html'
    html=index.read_text().replace('TEST PREVIEW · Supabase disconnected · source: Geoapify when configured','TEST PREVIEW · A-USTA-TEST public discovery · Geoapify external data')
    html=html.replace('<script>window.AUSTA_SUPABASE={rpc:async()=>({data:[]})};</script>','<script src="assets/map/test-providers.js"></script>')
    index.write_text(html)
    (preview/'assets/map/test-providers.js').write_text((Path(__file__).parent/'test-providers.js').read_text())
    assets={}
    for f in preview.rglob('*'):
        if f.is_file():
            rel=f.relative_to(preview).as_posix()
            assets['/' if rel=='index.html' else '/'+rel]={'body':base64.b64encode(f.read_bytes()).decode(),'mime':mimetypes.guess_type(rel)[0] or 'application/octet-stream'}
    raw=(root/'tools/geoapify/proxy/aze-adm0.geojson').read_bytes()
    assert hashlib.sha256(raw).hexdigest()=='8578487282384781be5bf87fb4d4fe0635c1323a2bec08cd331f67f8122266fc'
    modules={'assets.mjs':'export default '+json.dumps(assets,separators=(',',':'))+';', 'boundary.mjs':'export default '+raw.decode()+';'}
    for name in ('worker.mjs','policy.mjs'):modules[name]=(Path(__file__).parent/name).read_text()
    for name,content in modules.items():(target/name).write_text(content)
    (target/'modules.json').write_text(json.dumps(modules))
    print('KEY_FREE_WORKER_BUILD_PASS')
if __name__=='__main__':build(sys.argv[1])
