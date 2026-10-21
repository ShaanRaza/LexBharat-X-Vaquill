#!/usr/bin/env python3
"""Extracts two fields from the opening text of Supreme Court reports and merges them into src/data/judgments/sc/<year>.json. Standard library only.
usage: extract-sc-fields.py <opening.ndjson> <judges.ndjson>
  opening.ndjson  {caseId, text}    first ~3000 characters of the English document start (see export-sc-fields.sh)
  judges.ndjson   {caseId, judges}  the dataset's own `judges` field (the authoring judge), used to validate the bench and to spell names

Fields written (each ONLY when the match is clean; otherwise the field is absent, never guessed):
  benchExtracted      [names]  the full bench, from the report heading "[A and B, JJ.]" / "(A, B and C, JJ.)"
  caseNumberExtracted string   e.g. "Criminal Appeal No. 512 of 2020", from the heading "(Criminal Appeal No. 512 of 2020)"
Both are extracted from report text and shown in the app as extracted, never as dataset fields."""
import collections, glob, json, os, re, sys

opening = [json.loads(l) for l in open(sys.argv[1], encoding="utf-8")]
judges = {j["caseId"]: j.get("judges") or [] for j in map(json.loads, open(sys.argv[2], encoding="utf-8"))}
key = lambda n: re.sub(r"[^A-Z]", "", n.upper())

# --- name dictionary from the dataset's own judges field (clean in the Supreme Court): canonical spelling = the most common one
spell = collections.defaultdict(collections.Counter)
for js in judges.values():
    for n in js:
        n = re.sub(r"\s+", " ", n).strip()
        if n: spell[key(n)][n] += 1
known = {k: c.most_common(1)[0][0] for k, c in spell.items() if sum(c.values()) >= 2 and len(k) >= 4}

# --- bench
BLOCK = re.compile(r"[\[(]\s*([^\[\]()]{6,500}?)\s*[\])]")
END = re.compile(r"\bJ{1,2}\s*\.?\s*[,.]?\s*$|\bC\.?\s?J\.?\s?I?\.?\s*$")
TAIL = re.compile(r"[,\s]*\b(?:C\.?\s?J\.?\s?I?|J{1,2})\s*\.?\s*$")
DESIG = re.compile(r"^(?:C\.?\s?J\.?\s?I?\.?|J\.?|JJ\.?)$", re.I)
INIT = re.compile(r"^[A-Z]\.?$|^(?:[A-Z]\.){2,}[A-Z]?\.?$")
CAPS = re.compile(r"^[A-Z][A-Z'’-]+\.?$"); TITLE = re.compile(r"^[A-Z][a-z'’-]+\.?$"); HON = re.compile(r"^(?:DR|Dr|SHRI|Smt|MR|MRS|MS)\.?$")

def clean_name(p):
    """Two OCR repairs, both confirmed afterwards by the exact dictionary match below: a stray dot inside a word ("PALEK.AR"), and the initial K read as "IC" ("IC K. MATHEW")."""
    p = re.sub(r"\s+", " ", p)
    p = re.sub(r"(?<=[A-Za-z])\.(?=[A-Za-z]{2})", "", p) if re.search(r"[A-Za-z]{3,}\.[A-Za-z]{2,}", p) else p
    return re.sub(r"\bIC\.?(?=\s)", "K.", p)

def valid_name(n):
    ws = n.split()
    if not 1 <= len(ws) <= 5: return False
    styles, real = set(), 0
    for w in ws:
        if INIT.match(w) or HON.match(w): continue
        if CAPS.match(w): styles.add("c")
        elif TITLE.match(w): styles.add("t")
        else: return False
        real += 1
    return real >= 1 and len(styles) == 1

def raw_bench(text):
    """Names of the first bracketed block that ends in J./JJ./C.J., or None if there is no such block or any name is not shaped like a person's name."""
    for m in BLOCK.finditer(text[:1800]):
        raw = m.group(1).strip()
        if not END.search(raw): continue
        body = TAIL.sub("", raw).replace("*", "").strip(" ,.")
        parts = [p.strip(" ,") for p in re.split(r"\s*,\s*|\s+(?:AND|and)\s+|\s+&\s+", body) if p.strip(" ,")]
        names = [clean_name(p) for p in parts if not DESIG.match(p)]
        return names if names and all(valid_name(n) for n in names) else None
    return None  # the first such block is the bench; if it is not clean, nothing is shown

# Which spellings can be trusted? A name is accepted when it is in the dataset's own judge list, or when it is the dominant spelling in the reports:
# printed on at least 10 different benches AND not a one-letter variant of a spelling at least 5 times more common (that is an OCR slip, e.g. PATTANAJK for PATTANAIK).
printed = {r["caseId"]: raw_bench(r["text"]) for r in opening}
seen = collections.defaultdict(collections.Counter)
for names in printed.values():
    for n in names or []: seen[key(n)][n] += 1
freq = {k: sum(c.values()) for k, c in seen.items()}
def one_off(a, b):
    if abs(len(a) - len(b)) > 1 or a == b: return False
    if len(a) == len(b): return sum(x != y for x, y in zip(a, b)) == 1
    s_, l_ = sorted((a, b), key=len)
    return any(l_[:i] + l_[i + 1:] == s_ for i in range(len(l_)))
by_prefix = collections.defaultdict(list)
for k in freq: by_prefix[k[:3]].append(k)
dominant = set()
for k, n in freq.items():
    if n < 10: continue
    near = [o for o in set(by_prefix[k[:3]]) | set(sum((by_prefix[x] for x in {k[:3]}), [])) if one_off(k, o)]
    near += [o for o in freq if o[:2] == k[:2] and one_off(k, o)] if not near else []
    if all(freq[o] * 5 > n for o in near): dominant.add(k)
tidy = lambda n: re.sub(r"(?<=\b[A-Z]\.) (?=[A-Z]\.)", "", n)   # "H. R. KHANNA" -> "H.R. KHANNA", the dataset's own style
canon = {k: tidy(known.get(k) or seen[k].most_common(1)[0][0]) for k in set(known) | dominant}

def parse_bench(names, authoring):
    if not names: return None
    out = [canon.get(key(n)) for n in names]
    if any(o is None for o in out) or len(set(out)) != len(out): return None
    if authoring and not all(key(a) in {key(o) for o in out} for a in authoring): return None   # the dataset's own judge must be on the bench
    return out

# --- case number
TYPE = r"(?:Criminal|Civil)\s+Appeals?|(?:Writ|Special\s+Leave|Transfer|Review|Contempt)\s+Petitions?\s*\((?:Civil|Criminal|Crl\.?)\)"
CASE = re.compile(r"[\[(]\s*(" + TYPE + r")\s*(Nos?)\.?\s*(\d{1,6}(?:\s*[-–]\s*\d{1,6})?(?:\s*(?:,|and|&)\s*\d{1,6})*)\s*(?:/|of)\s*(\d{4})\s*[\])]", re.I)
def parse_case_number(text, decided_year):
    m = CASE.search(text[:1500])
    if not m: return None
    kind, no, nums, yr = m.groups(); yr = int(yr)
    if not (1900 <= yr <= decided_year): return None   # a case cannot be filed after it was decided
    kind = re.sub(r"\s+", " ", kind).title().replace("(Crl", "(Crl").replace("Crl)", "Crl.)") if "Crl" in kind.title() else re.sub(r"\s+", " ", kind).title()
    nums = re.sub(r"\s*([-–])\s*", r"\1", re.sub(r"\s+", " ", nums))
    return f"{kind} {'Nos.' if no.lower() == 'nos' or re.search(r'[-–,&]|and', nums) else 'No.'} {nums} of {yr}"

bench, caseno, stats = {}, {}, collections.Counter()
for r in opening:
    cid, text = r["caseId"], r["text"]; decided = int(cid[:4])
    b = parse_bench(printed.get(cid), judges.get(cid)); stats["bench" if b else "no_bench"] += 1
    if b: bench[cid] = b
    c = parse_case_number(text, decided + 1); stats["case_no" if c else "no_case_no"] += 1   # +1: the report year can trail the decision year
    if c: caseno[cid] = c

n_rows = 0
for f in sorted(glob.glob("src/data/judgments/sc/*.json")):
    rows = json.load(open(f, encoding="utf-8"))
    for c in rows:
        c.pop("benchExtracted", None); c.pop("caseNumberExtracted", None)
        if c["caseId"] in bench: c["benchExtracted"] = bench[c["caseId"]]
        if c["caseId"] in caseno: c["caseNumberExtracted"] = caseno[c["caseId"]]
        n_rows += 1
    with open(f, "w", encoding="utf-8") as fh:
        fh.write("[\n" + ",\n".join("\t" + json.dumps(c, ensure_ascii=False, separators=(",", ":")) for c in rows) + "\n]\n")
print(json.dumps({"cases": n_rows, "english_openings": len(opening), "bench_extracted": len(bench), "case_number_extracted": len(caseno), "known_judge_names": len(known)}), file=sys.stderr)
