"""Summarise headless-Chrome console/network logs for one breakpoint: python3 -I qa/analyze_logs.py desktop"""
import sys,glob,re,collections,os
bp=sys.argv[1]
noise=re.compile(r'React DevTools|Fast Refresh|\[HMR\]|hot-reloader|report-hmr')
res=collections.defaultdict(list)
for f in glob.glob(f'qa/logs/{bp}/*.log'):
    page=os.path.basename(f)[:-4]
    for l in open(f,errors='replace'):
        if noise.search(l): continue
        m=re.sub(r'^\[[^\]]*\]\s*','',l.strip())
        res[m[:230]].append(page)
print(bp,'pages with non-noise messages:',len({p for v in res.values() for p in v}))
for m,p in sorted(res.items(),key=lambda x:-len(x[1]))[:15]:
    print(len(p),'x',m[:200],'| e.g.',p[0])
fails=f'qa/logs/{bp}/_failures.txt'
print('screenshot failures:',open(fails).read().split() if os.path.exists(fails) else 'none')
