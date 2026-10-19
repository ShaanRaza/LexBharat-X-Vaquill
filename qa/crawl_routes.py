"""Enumerate every reachable internal route by crawling links from '/'. Writes qa/routes.txt (pages) and qa/assets.txt."""
import re,urllib.request,urllib.error,collections,concurrent.futures as cf
B='http://localhost:3100'
# Seeds: '/' plus hub index pages that no page links to (clauses, topics, playbooks are reachable only by URL / sitemap)
SEEDS=['/','/clauses','/topics','/playbooks','/blog','/engineering']
seen={x:None for x in SEEDS};q=collections.deque(SEEDS)
def get(p):
    try:
        r=urllib.request.urlopen(urllib.request.Request(B+p,headers={'User-Agent':'qa'}),timeout=120)
        return r.status,(r.read().decode('utf8','replace') if 'html' in (r.headers.get('content-type') or '') else '')
    except urllib.error.HTTPError as e: return e.code,''
    except Exception: return 0,''
# warm sequentially first (avoids dev cold-start compile races), then crawl
for w in ['/','/legal-api','/docs','/docs/api-guide/overview','/blog','/privacy','/terms','/dpa','/refund-policy','/delete-data','/security','/auth/login']: get(w)
with cf.ThreadPoolExecutor(4) as ex:
    pend={}
    while q or pend:
        while q and len(pend)<4: p=q.popleft(); pend[ex.submit(get,p)]=p
        done,_=cf.wait(pend,return_when=cf.FIRST_COMPLETED)
        for f in done:
            p=pend.pop(f); st,h=f.result(); seen[p]=st
            for l in set(re.findall(r'href="(/[^"#?]*)',h)):
                if l.startswith(('/_next','/api/')): continue
                if l not in seen: seen[l]=None; q.append(l)
for extra in ['/docs/introduction','/docs/guides/mcp-client','/docs/llms.txt']:
    if extra not in seen: seen[extra]=get(extra)[0]
pages=sorted(p for p in seen if not re.search(r'\.(svg|txt)$',p))
open('qa/routes.txt','w').write('\n'.join(pages)+'\n')
open('qa/assets.txt','w').write('\n'.join(sorted(p for p in seen if re.search(r'\.(svg|txt)$',p)))+'\n')
bad=[p for p,s in seen.items() if s!=200]
print('routes:',len(pages),'assets:',len(seen)-len(pages),'non-200:',bad)
