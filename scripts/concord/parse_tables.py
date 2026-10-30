# Extracts the old-law -> new-law section pairs from two Government documents, as text (pdftotext -layout), and prints nothing: build-law-mapping.py imports `pairs()`.
#   1. NCRB / Ministry of Home Affairs "Corresponding Section Table of BNS|BNSS|BSA with Repealed Act":  https://www.ncrb.mha.gov.in/uploads/SankalanPortal/DownloadPDF/{BNS,BNSS,BSA}2023.pdf   -> <dir>/ncrb-{BNS,BNSS,BSA}/{BNS,BNSS,BSA}.txt
#   2. CAPT Bhopal "Correspondence table and comparison summary" (hosted by Kerala Prisons): https://www.keralaprisons.gov.in/userfiles/act-and-rules/comparison_summary_{BNS_to_IPC,BNSS_to_CrPC,BSA_to_IEA}.pdf -> <dir>/concord-bns/bns.txt, concord-bnss/bnss.txt, concord-bsa/bsa.txt
# usage: CONCORD_DIR=<dir with the text files> python3 build-law-mapping.py
import re, json, collections, os
S=os.environ.get("CONCORD_DIR",".")
NUM=r"\d{1,3}[A-Z]{0,2}"; SUB=r"(?:\s?\([0-9a-zA-Z]{1,4}\))*"
def rec(store, ref, old):
    b=re.match(NUM,ref).group(0); store[(b,old)].add(ref.replace(" ",""))
def two_col_line(l):
    m=re.match(rf"^\s*({NUM}{SUB})\.?\s+\S",l)
    if not m: return None
    m2=re.search(rf"(?:^|\s)({NUM})\.\s+[A-Z“‘\"]",l[24:62])
    return (m.group(1),m2.group(1)) if m2 else None
def s1_bns():
    st=collections.defaultdict(set); lines=open(f"{S}/ncrb-BNS/BNS.txt",encoding="utf8").read().split("\n")
    start=next(i for i,l in enumerate(lines) if l.startswith("CORRESPONDING SECTION TABLE OF BNS")); end=next(i for i,l in enumerate(lines) if i>start+100 and re.match(r"^\s*CHAPTER I\s*$",l)); cur=None
    for l in lines[start:end]:
        t=two_col_line(l)
        if t: rec(st,t[0],t[1]); continue
        m2=re.match(rf"^\s*({NUM}{SUB})\s*(?:\S[^0-9]{{0,40}})?$",l)
        if m2 and len(l.strip())<50: cur=m2.group(1)
        m3=re.match(rf"^\s{{15,}}({NUM})\.\s+[A-Z]",l)
        if m3 and cur: rec(st,cur,m3.group(1))
        m4=re.match(rf"^\s*({NUM}{SUB})(?:\s+[‘'].*?[’'])?\s{{3,}}({NUM})\.\s+[A-Z“]",l)
        if m4: rec(st,m4.group(1),m4.group(2))
    return st
def s1_two_col(name):
    st=collections.defaultdict(set); lines=open(f"{S}/ncrb-{name}/{name}.txt",encoding="utf8").read().split("\n")
    start=next(i for i,l in enumerate(lines) if re.match(rf"^\s*Corresponding Section Table of {name} with Repealed Act\s*$",l) and i>100)
    for l in lines[start:]:
        t=two_col_line(l)
        if t: rec(st,t[0],t[1])
    return st
def s2(path, bsa=False):
    st=collections.defaultdict(set)
    for l in open(path,encoding="utf8").read().split("\n"):
        if bsa:
            m=re.match(rf"^\s*({NUM}{SUB})\s+(?:IEA\s+)?({NUM})(?:,\s*para\s*\d+)?(?:\s*(?:and|,|&)\s*({NUM}))?(?=\s{{2,}}|\s+[\"“])",l)
            if m:
                rec(st,m.group(1),m.group(2))
                if m.group(3): rec(st,m.group(1),m.group(3))
        else:
            m=re.match(rf"^\s*({NUM}{SUB})\s+\S.*?\s{{2,}}({NUM})(?:\([0-9a-zA-Z ]+\))*\]?\s{{1,}}\S",l)
            if m: rec(st,m.group(1),m.group(2)); continue
            m=re.match(rf"^\s*({NUM}{SUB})\s+\S",l)   # the subject can run right up to the old-section column ("... not 304     Minimum ..."): look for a number followed by a gap in that column
            if m:
                m2=re.search(rf"(?:^|\s)({NUM})(?:\([0-9a-zA-Z ]+\))*\]?\s{{2,}}\S",l[28:68])
                if m2: rec(st,m.group(1),m2.group(1))
    return st
CODES={"IPC-BNS":("BNS",s1_bns(),s2(f"{S}/concord-bns/bns.txt")),"CrPC-BNSS":("BNSS",s1_two_col("BNSS"),s2(f"{S}/concord-bnss/bnss.txt")),"IEA-BSA":("BSA",s1_two_col("BSA"),s2(f"{S}/concord-bsa/bsa.txt",bsa=True))}
def pairs():
    rows=[]
    for code,(new,a,b) in CODES.items():
        for key in sorted(set(a)|set(b), key=lambda k:(int(re.match(r"\d+",k[0]).group(0)),k)):
            srcs=[n for n,st in (("ncrb",a),("capt",b)) if key in st]
            refs=sorted(set(a.get(key,set()))|set(b.get(key,set())))
            rows.append({"code":code,"new":key[0],"old":key[1],"newRef":[r for r in refs if r!=key[0]],"tables":srcs})
    return rows
