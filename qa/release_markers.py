"""Scan every route (default http://localhost:3100) for dev/demo markers in visible text, <title> and meta description."""
import re,html,sys,urllib.request,collections,concurrent.futures as cf
B='http://localhost:3100'
routes=[r for r in open('qa/routes.txt').read().split() if r]
PAT={
 'banner text ("local build" / "MOCKED")':r'local build|all backend behavior is MOCKED|is a MOCK: no accounts',
 'badge text (MOCK / data source / titles only / recreated / fictional ...)':r'\b(MOCK FORM|MOCK CONSOLE|SIMULATED DATABASE|DATA SOURCE|TITLES ONLY|RECREATED PLACEHOLDER|PLACEHOLDER VIDEO|PLACEHOLDER FIGURES|PLACEHOLDER PLANS|FICTIONAL|NO ADD-IN EXISTS|REDIRECT SHELL|ORIGINAL PLACEHOLDER ARTWORK)\b',
 'badge element classes':r'text-warning"[^>]*>\s*(mock|data source|titles only|recreated|fictional|placeholder|simulated|alias|original|illustrative|redirect|no add-in|no content)',
 '"(local mock)" / "(mock copy)" / "mocked backend"':r'\(local mock\)|\(mock copy\)|mocked backend',
 '"data source" strip text':r'Static data \(checked into the repo\)|Mock API data \(local route handlers\)|Hardcoded placeholder content|Mixed: static \+ placeholder',
 '"/api/mock" visible':r'/api/mock',
 '"this build" / "local build" wording in content':r'this build|this local build|in this build|local stub',
 '"placeholder" word in visible content':r'[Pp]laceholder',
 'dev file paths (src/data/..)':r'src/(data|lib|components|app)/',
}
def fetch(r):
    try: return r,urllib.request.urlopen(urllib.request.Request(B+r,headers={'User-Agent':'qa'}),timeout=60).read().decode('utf8','replace')
    except Exception as e: return r,''
res=collections.defaultdict(lambda:[0,[],0]); titles=[]
with cf.ThreadPoolExecutor(6) as ex:
    for r,h in ex.map(fetch,routes):
        t=re.search(r'<title>([^<]*)',h); titles.append((r,html.unescape(t.group(1)) if t else ''))
        md=re.search(r'<meta name="description" content="([^"]*)"',h)
        head=(t.group(1) if t else '')+' '+(md.group(1) if md else '')
        vis=re.sub(r'<script.*?</script>|<style.*?</style>','',h,flags=re.S)
        raw=vis; txt=html.unescape(re.sub(r'<[^>]+>',' ',vis))
        for k,p in PAT.items():
            src=raw if k=='badge element classes' else txt+' '+head
            n=len(re.findall(p,src,flags=0 if 'MOCK' in p or 'PLACEHOLDER' in p else re.I)) if k!='"placeholder" word in visible content' else len(re.findall(p,txt))
            if n: res[k][0]+=1; res[k][2]+=n; res[k][1].append(r) if len(res[k][1])<3 else None
print('pages scanned:',len(routes))
for k in PAT:
    c,ex,tot=res[k]; print(f'{c:4d} pages | {tot:5d} hits | {k} | e.g. {ex[:2]}')
print('titles containing "mock"/"local":',[x for x in titles if re.search(r'mock|local',x[1],re.I)][:3])
