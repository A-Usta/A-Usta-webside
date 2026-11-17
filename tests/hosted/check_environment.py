"""Read-only GitHub protection metadata gate; never reads or creates DB secrets."""
import json
import os
import urllib.request

BASE='https://api.github.com/repos/A-Usta/A-Usta-webside/environments/austa-test-only'
class Blocked(Exception):pass
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise Blocked()

def validate(env,policies):
    if env.get('name')!='austa-test-only' or env.get('can_admins_bypass') is not False:raise Blocked()
    rules=env.get('protection_rules',[])
    if not any(r.get('type')=='required_reviewers' and r.get('reviewers') for r in rules):raise Blocked()
    if env.get('deployment_branch_policy')!={'protected_branches':False,'custom_branch_policies':True}:raise Blocked()
    items=policies.get('branch_policies',[])
    if policies.get('total_count')!=1 or len(items)!=1 or items[0].get('name')!='feat/v355-automotive-map' or items[0].get('type')!='branch':raise Blocked()

def check(token):
    if not token:raise Blocked()
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
    def get(url):
        req=urllib.request.Request(url,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'})
        with opener.open(req,timeout=10) as response:
            if response.status!=200 or response.geturl()!=url:raise Blocked()
            raw=response.read(262145)
            if len(raw)>262144:raise Blocked()
            return json.loads(raw)
    validate(get(BASE),get(BASE+'/deployment-branch-policies'))

if __name__=='__main__':
    try:
        check(os.environ.pop('AUSTA_GITHUB_METADATA_TOKEN',''))
        print('{"environment_protection":"PASS"}')
    except BaseException:
        print('{"environment_protection":"BLOCKED","database_requests":0}')
        raise SystemExit(2)
