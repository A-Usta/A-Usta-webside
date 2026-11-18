"""Create a secret-free map-only TEST preview outside the repository."""
from pathlib import Path
import shutil
import sys

HTML='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A-USTA proxy TEST map</title><p>TEST PREVIEW · Supabase disconnected · source: Geoapify when configured</p><main id="home"><div id="austaTopUrgentV24"></div></main><link rel="stylesheet" href="assets/map/map.css"><script>window.AUSTA_SUPABASE={rpc:async()=>({data:[]})};</script><script src="assets/map/config.js"></script><script src="assets/map/data.js"></script><script src="assets/map/publication.js"></script><script src="assets/map/map.js"></script>'''


def prepare(output):
    source=Path(__file__).resolve().parents[3]
    target=Path(output).absolute()
    if target.resolve()!=target or target==source or source in target.parents or target.exists():
        raise ValueError('PREVIEW_TARGET')
    target.mkdir(parents=True,mode=0o750)
    for folder in ('assets/map','assets/vendor/leaflet-1.9.4'):
        dest=target/folder;dest.mkdir(parents=True)
        for entry in (source/folder).iterdir():
            if entry.is_symlink():raise ValueError('PREVIEW_SYMLINK')
            if entry.is_file() and entry.name!='runtime-config.json':shutil.copyfile(entry,dest/entry.name)
    (target/'index.html').write_text(HTML,encoding='utf-8')

if __name__=='__main__':
    try:
        if len(sys.argv)!=2:raise ValueError()
        prepare(sys.argv[1]);print('KEY_FREE_TEST_PREVIEW_CREATED')
    except Exception:
        print('TEST_PREVIEW_BLOCKED');sys.exit(2)
