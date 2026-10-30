#!/usr/bin/env python3
# Builds src/config/law-mapping.json: one row per old section (IPC -> BNS, CrPC -> BNSS, Evidence Act -> BSA).
#  - The pairings come ONLY from two Government documents (see parse_tables.py). A pairing both documents agree on is `pairing_confirmed`.
#  - `linkable` = both sections are in our Acts data (not garbled) AND their titles correspond (word overlap of at least 50%, or a hand check recorded in an existing row).
#  - `status` is "verified" only when pairing_confirmed AND linkable. Anything else is "unverified" and is never used as fact (see src/config/README-law-mapping.md).
#  - Existing rows of the file are kept exactly as they are (they carry hand checks); this script only adds the new fields to them and appends rows that are not there yet.
# usage: CONCORD_DIR=<dir with the table texts> python3 scripts/concord/build-law-mapping.py <headings.json from dump-headings.mjs> [--date 2026-10-30]
import json, re, sys, collections, os
sys.path.insert(0, os.path.dirname(__file__))
import parse_tables as T
HEAD=json.load(open(sys.argv[1])); DATE=sys.argv[sys.argv.index("--date")+1] if "--date" in sys.argv else "2026-10-30"
PATH="src/config/law-mapping.json"; data=json.load(open(PATH,encoding="utf8"))
OLD={"IPC-BNS":"ipc","CrPC-BNSS":"crpc","IEA-BSA":"evidence"}; NEW={"IPC-BNS":"bns","CrPC-BNSS":"bnss","IEA-BSA":"bsa"}
LABEL={"ipc":"IPC","crpc":"CrPC","evidence":"Evidence Act","bns":"BNS","bnss":"BNSS","bsa":"BSA"}
STOP=set("of the and or for in to a an by with under any it its is are as on at from be shall".split())
toks=lambda t:{w for w in re.findall(r"[a-z]{3,}",(t or "").lower()) if w not in STOP}
def clean(t):
    if not t: return None
    t=re.sub(r"\*+|_+","",t); t=re.sub(r"\s+"," ",t).strip(); t=re.sub(r"^\d+[A-Z]*\.\s*","",t); t=re.sub(r"\s*[.—-]+\s*$","",t)
    return t[:90] or None
def sec(law,num):
    h=HEAD[law].get(num.upper()); ok=bool(h and h["s"]!="garbled")
    return ok, (clean(h["h"]) if h else None)
def overlap(a,b):
    x,y=toks(a),toks(b); return len(x&y)/max(1,min(len(x),len(y))) if x and y else None
base=lambda s:re.match(r"\d+[A-Za-z]*",str(s)).group(0).upper()
pairs=T.pairs(); by=collections.defaultdict(list)
for p in pairs: by[(OLD[p["code"]],p["old"].upper())].append(p)
TABLES={"ncrb":"NCRB / Ministry of Home Affairs 'Corresponding Section Table ... with Repealed Act' (Sankalan portal PDF)","capt":"CAPT Bhopal correspondence table (hosted by Kerala Prisons)"}
def tables_text(p): return " and ".join(TABLES[t] for t in p["tables"])
# 1. keep the existing rows, add the new fields
rows=[]; have=set()
for r in data["rows"]:
    k=(r["old_law"],base(r["old_section"])); have.add(k); nb=base(r["new_section"])
    agree=[p for p in by.get(k,[]) if p["new"].upper()==nb]
    r["tables"]=agree[0]["tables"] if agree else []
    r["old_text_in_data"]=sec(r["old_law"],base(r["old_section"]))[0]; r["new_text_in_data"]=sec(r["new_law"],nb)[0]
    r["pairing_confirmed"]=bool(agree and len(agree[0]["tables"])==2)
    r["linkable"]=r.get("old_in_data") is True and r.get("new_in_data") is True
    keep_verified=r["status"]=="verified"
    r["status"]="verified" if (r["pairing_confirmed"] and r["linkable"] and keep_verified) else "unverified"
    if keep_verified and r["status"]=="unverified": r["source"]+=" NOT confirmed by both government tables, so it is no longer marked verified."
    elif r["status"]=="verified" and "government correspondence tables" not in r["source"]: r["source"]+=" Pairing also confirmed by both Government correspondence tables ("+tables_text(agree[0])+")."
    rows.append(r)
# 2. add the rows of the tables that are not there yet
added=collections.Counter()
for (ol,on),ps in sorted(by.items(),key=lambda kv:(["ipc","crpc","evidence"].index(kv[0][0]),int(re.match(r"\d+",kv[0][1]).group(0)),kv[0][1])):
    if (ol,on) in have: continue
    code=[c for c,v in OLD.items() if v==ol][0]; nl=NEW[code]
    ps=sorted(ps,key=lambda p:(len(p["tables"])<2,int(re.match(r"\d+",p["new"]).group(0)),p["new"]))
    def mk(p):
        o_ok,o_t=sec(ol,on); n_ok,n_t=sec(nl,p["new"]); ov=overlap(o_t,n_t) if (o_ok and n_ok) else None
        conf=len(p["tables"])==2; link=bool(o_ok and n_ok and ov is not None and ov>=0.5)
        return p,o_ok,o_t,n_ok,n_t,ov,conf,link
    first=mk(ps[0]); p,o_ok,o_t,n_ok,n_t,ov,conf,link=first
    ref=p["newRef"][0] if p["newRef"] else p["new"]
    status="verified" if conf and link else "unverified"
    if status=="verified": src=f'Checked against our data on {DATE}: {LABEL[ol]} s{on} "{o_t}" and {LABEL[nl]} s{ref} "{n_t}" are both in our Acts data and their titles correspond ({round(100*ov)}% of the title words are shared). Pairing confirmed by both Government correspondence tables: {tables_text(p)}.'
    else:
        why=[]
        if not conf: why.append(f"only one Government table lists this pairing ({tables_text(p)})")
        if not (o_ok and n_ok): why.append("one of the two sections is not in our Acts data"+(f" (not held or garbled: {LABEL[ol]} s{on})" if not o_ok else "")+(f" (not held or garbled: {LABEL[nl]} s{p['new']})" if not n_ok else ""))
        elif not link: why.append(f"the titles do not correspond ({'no heading in our data' if ov is None else str(round(100*ov))+'% shared words'})")
        src=f"Pairing from: {tables_text(p)}. Not marked verified: "+"; ".join(why)+"."
    row={"old_law":ol,"old_section":on,"old_title":o_t or "(no heading in our data)","new_law":nl,"new_section":ref,"new_title":n_t or "(no heading in our data)","status":status,"source":src,"pairing_confirmed":conf,"linkable":link,"tables":p["tables"],"old_text_in_data":o_ok,"new_text_in_data":n_ok}
    # old_in_data / new_in_data keep the meaning the page relies on ("this section may be linked"): true only when linkable; false when the section is not held; left out when it is held but the titles do not correspond
    if link: row["old_in_data"]=row["new_in_data"]=True
    else:
        if not o_ok: row["old_in_data"]=False
        if not n_ok: row["new_in_data"]=False
    if len(ps)>1:
        row["also_new_sections"]=[]
        for q in ps[1:]:
            _,_,_,qn_ok,qn_t,qov,qconf,qlink=mk(q)
            row["also_new_sections"].append({"new_section":q["newRef"][0] if q["newRef"] else q["new"],"new_title":qn_t or "(no heading in our data)","new_text_in_data":qn_ok,"pairing_confirmed":qconf,"linkable":qlink,"tables":q["tables"]})
    rows.append(row); added[(ol,status)]+=1
keep=len(data["rows"]); head,tail=rows[:keep],rows[keep:]   # the existing rows keep their place (the page and its tests read the file in order); new rows follow in section order
data["rows"]=head+sorted(tail,key=lambda r:(["ipc","crpc","evidence"].index(r["old_law"]),int(re.match(r"\d+",r["old_section"]).group(0)),r["old_section"].upper()))
data["_note"]=data.get("_note","")+" | Oct 30 2026: rows added from the Government tables; fields pairing_confirmed / linkable / tables added to every row (scripts/concord/build-law-mapping.py)."
json.dump(data,open(PATH,"w",encoding="utf8"),ensure_ascii=False,indent=1)
print("rows",len(data["rows"]),dict(collections.Counter((r["old_law"],r["status"]) for r in data["rows"])))
print("pairing_confirmed",sum(r["pairing_confirmed"] for r in data["rows"]),"linkable",sum(r["linkable"] for r in data["rows"]),"verified",sum(r["status"]=="verified" for r in data["rows"]))
