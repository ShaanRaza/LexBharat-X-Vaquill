"""Static audit of every route's server-rendered HTML. Run: python3 -I qa/audit_static.py"""
import re,json,html,urllib.request,collections
from html.parser import HTMLParser
B='http://localhost:3100'
routes=[r for r in open('qa/routes.txt').read().split() if r]
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.d=collections.defaultdict(list); s.stack=[]; s.txt=''; s.cur=None
    def handle_starttag(s,t,a):
        a=dict(a); s.stack.append((t,a))
        if t in('script','style'): s.skip=t
        if t=='title': s.cur='title'
        if t in('a','button','h1','h2','h3','label','th'): s.cur=t; s.txt=''
        if t=='img': s.d['img'].append(a)
        if t in('input','select','textarea'): s.d['field'].append(a)
        if t=='a': s.d['a'].append(a)
        if t=='html': s.d['html'].append(a)
        if t=='meta': s.d['meta'].append(a)
        if 'id' in a: s.d['ids'].append(a['id'])
        if t in('h1','h2','h3','h4'): s.d['heads'].append(t)
        if t=='button': s.d['btn'].append(a)
        if t=='svg': s.d['svg'].append(a)
    def handle_endtag(s,t):
        if s.cur==t or (s.cur=='title' and t=='title'):
            x=re.sub(r'\s+',' ',html.unescape(s.txt)).strip()
            if s.cur=='title': s.d['title'].append(x)
            elif s.cur=='a': s.d['a_text'].append(x)
            elif s.cur=='button': s.d['btn_text'].append(x)
            elif s.cur=='h1': s.d['h1'].append(x)
            s.cur=None
        if s.stack: s.stack.pop()
    def handle_data(s,d):
        if s.cur: s.txt+=d
issues=collections.defaultdict(list)
titles=collections.defaultdict(list)
LEAK=re.compile(r'brandname|vaquill|example\.invalid|vq_key|lorem ipsum|undefined|\[object|NaN\b|TODO|FIXME|Harvey',re.I)
pages={}
for r in routes:
    try:
        resp=urllib.request.urlopen(urllib.request.Request(B+r,headers={'User-Agent':'qa'}),timeout=120); h=resp.read().decode('utf8','replace')
    except Exception as e:
        issues[r].append(('critical','fetch-failed',str(e))); continue
    pages[r]=h
    p=P(); p.feed(h); d=p.d
    t=d['title'][0] if d['title'] else ''
    titles[t].append(r)
    if not t: issues[r].append(('high','missing-title',''))
    if not any(m.get('name')=='description' for m in d['meta']): issues[r].append(('low','missing-meta-description',''))
    if not d['html'] or not d['html'][0].get('lang'): issues[r].append(('medium','missing-html-lang',''))
    if not any(m.get('name')=='viewport' for m in d['meta']): issues[r].append(('medium','missing-viewport',''))
    n1=len(d['h1'])
    if n1!=1: issues[r].append(('medium' if n1==0 else 'low','h1-count',str(n1)))
    for im in d['img']:
        if 'alt' not in im: issues[r].append(('medium','img-missing-alt',im.get('src','')[:60]))
    for f in d['field']:
        if f.get('type') in('hidden','submit'): continue
        if not (f.get('id') or f.get('aria-label')): issues[r].append(('medium','field-no-id-or-label',str(f)[:80]))
        elif f.get('id') and not re.search(r'for="%s"'%re.escape(f['id']),h) and not f.get('aria-label'): issues[r].append(('medium','field-label-missing',f['id']))
    ids=d['ids']; dup=[i for i,c in collections.Counter(ids).items() if c>1]
    if dup: issues[r].append(('low','duplicate-ids',','.join(dup[:5])))
    for a,tx in zip(d['a'],d['a_text']+['']*len(d['a'])):
        pass
    # empty-name links/buttons: crude—look for <a ...></a> / aria-label
    for m in re.finditer(r'<a [^>]*>(\s*(?:<svg[^>]*>.*?</svg>)?\s*)</a>',h,re.S):
        if 'aria-label' not in m.group(0): issues[r].append(('medium','link-no-accessible-name',m.group(0)[:80]))
    for m in re.finditer(r'<button[^>]*>(\s*(?:<svg[^>]*>.*?</svg>)?\s*)</button>',h,re.S):
        if 'aria-label' not in m.group(0): issues[r].append(('medium','button-no-accessible-name',m.group(0)[:80]))
    hashlinks=len(re.findall(r'href="#"',h))
    if hashlinks: issues[r].append(('low','dead-href-hash',str(hashlinks)))
    vis=re.sub(r'<script.*?</script>|<style.*?</style>','',h,flags=re.S); vis=re.sub(r'<[^>]+>',' ',vis); vis=html.unescape(vis)
    for m in LEAK.finditer(vis):
        ctx=vis[max(0,m.start()-30):m.end()+30].replace('\n',' ')
        issues[r].append(('medium','text-leak:'+m.group(0).lower(),re.sub(r'\s+',' ',ctx)))
    # heading order skips
    hs=[int(x[1]) for x in d['heads']]
    for a,b in zip(hs,hs[1:]):
        if b-a>1: issues[r].append(('low','heading-level-skip',f'h{a}->h{b}')); break
# in-page anchors
for r,h in pages.items():
    ids=set(re.findall(r'\sid="([^"]+)"',h))
    for a in set(re.findall(r'href="#([^"]+)"',h)):
        if a not in ids: issues[r].append(('medium','anchor-target-missing','#'+a))
# internal links to non-routes
rs=set(routes)|set(open('qa/assets.txt').read().split())
for r,h in pages.items():
    for l in set(re.findall(r'href="(/[^"#?]*)',h)):
        if l.startswith(('/_next','/api')): continue
        if l not in rs: issues[r].append(('high','link-to-unknown-route',l))
# duplicate titles
for t,rr in titles.items():
    if len(rr)>1 and len(rr)<60 and t: 
        for r in rr: issues[r].append(('low','duplicate-title',t[:60]))
sev=collections.Counter(); kinds=collections.Counter()
for r,l in issues.items():
    for s_,k,_ in l: sev[s_]+=1; kinds[(s_,k.split(':')[0] if k.startswith('text-leak') else k)]+=1
json.dump({r:l for r,l in issues.items()},open('qa/logs/static-audit.json','w'),indent=1)
print('pages audited:',len(pages),'pages with issues:',len(issues)); print(dict(sev))
for (s_,k),c in sorted(kinds.items(),key=lambda x:(['critical','high','medium','low'].index(x[0][0]),-x[1])): print(s_,k,c)
