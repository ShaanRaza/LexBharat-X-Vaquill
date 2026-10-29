# Data gaps: what LexBharat has, what it is missing, and what that costs a lawyer

**Biggest gap: we hold the full text of Acts but not of judgments: the website shows judgments as a list of case records (about 900 characters of opening text for 89% of Supreme Court cases, nothing for High Courts), so a lawyer cannot search, read or cite what a court actually held.**

*Report only. No code or data was changed and nothing was fetched from a blocked site (2026-10-25). Numbers come from our Neon database, the vector database, the files in the repo, the dataset on the SSD (`/Volumes/LAWSSD/open-india-law`, v2026.08) and the 9 India Code PDFs on disk. Impact = how much it matters to a practising lawyer (High / Medium / Low). Fix = free (we can do it with what we have), paid, needs permission (India Code / Vaquill / a download only you can do), or not fixable.*

## 0. Summary table

| Area | Gap | Count | Impact | Fix | Cost |
|---|---|---:|---|---|---|
| Judgments | No judgment text on the site: Supreme Court shows ~900 characters (opening text) for 32,946 of 37,014 cases; High Courts none | 37,014 SC + 14.2M HC case records | **High** | Text is in the dataset (SSD). Needs a place to store and search it (R2 / bigger database) and embeddings | paid / free-tier tricks |
| Judgments | High Court lists and search are **not live** (R2 not set up): production shows counts by year only | 25 High Courts, 14.2M records | **High** | Host the exported files (R2 free tier 10 GB, or compress) | free to small |
| Acts | Central Acts missing or only a stub: Customs Act 1962 (3 of 184 sections), Arms Act (0), Protection of Human Rights Act (0), SC/ST Atrocities Act (1), Child and Adolescent Labour Act (3), Employees' Compensation Act, Indian Trusts Act, Whistle Blowers Protection Act, Income-tax Act 2025 and other 2025 Acts | 103 Central in-force stubs (11 with 0 sections) + at least 8 missing important Acts | **High** | India Code PDFs, same method as W7b | needs permission / manual download |
| Acts | Status wrong or contradictory: CrPC 1973 shown in force (repealed by BNSS from 1 July 2024); 4 labour Acts appear both repealed and in force; 6 State-filed IPC, 31 CrPC and 4 Evidence Act copies shown in force | ~45 records | **High** | Override table (config), no new data | free |
| Acts | Confident missing section numbers still open | 706 in 256 Central Acts (+3,600 in 1,196 State Acts) | Medium | PDFs from India Code | needs permission |
| Acts | Schedules, Forms, Appendices, Rules not loaded except CPC, Limitation, Stamp (Sch. I), Constitution | all other Acts | **High** (CrPC/BNSS schedules, Companies Act schedules, CPC forms) | PDFs | needs permission |
| Acts | Regulator instruments are titles only on the site; 912 more (Law Commission, State GST) not even listed | 11,240 (+912) | Medium | Text is in the dataset; needs storage | free to small |
| Acts | State Acts: garbled text and incomplete sections | 1,819 garbled, 27,621 possibly incomplete | Low to Medium | re-extract from `source_url` PDFs (sites block automation) | needs permission |
| Search | Not searchable by meaning: judgments, regulators, 22 Central + 1,994 State sections; Hindi not searchable by keyword | see section 4 | Medium | small jobs | free |
| Judgments | Tribunals (15 forums, 813,168 matters, PDFs without text) not loaded at all | 813,168 | Medium | OCR job | paid |

## 1. ACTS: coverage

### 1.1 Totals (database, 2026-10-25)
| | Acts | with text (at least 1 section) | title only (0 sections) | in force | repealed / spent |
|---|---:|---:|---:|---:|---:|
| Central | 1,590 (incl. the Constitution; 21 are State-filed copies we re-labelled Central) | 1,488 | 102 | 880 | 710 |
| State and Union Territory | 8,523 | 7,395 | 1,128 | 8,523 | 0 |
| Regulator instruments (static list, not in the database) | 11,240 (10 bodies) | 9,541 have sections in the dataset but **none is shown on the site** | 1,699 | 10,862 | 378 superseded |

Central: 41,600 sections in the base data plus 1,987 units we added (1,701 new, 286 replace wrong text). State: 169,953 sections. Regulators: 89,698 sections in the dataset, not loaded.

Central in-force Acts: 880 (9,393 in force across all, of which State 8,523). Dataset check: the dataset's legislation files hold exactly the 10,112 Acts we load (+1 Constitution added by us). The regulator files hold 12,152 instruments; our list has 11,240. **The 912 missing are all Law Commission reports (558) and State GST notifications (354).**

State and UT Acts by state (Acts / with text):
Assam 987/603, West Bengal 715/676, Rajasthan 383/368, Maharashtra 379/370, Chhattisgarh 356/297, Uttar Pradesh 338/307, Kerala 322/308, Tamil Nadu 308/280, Punjab 298/273, Bihar 297/247, Odisha 282/224, Karnataka 279/279, Telangana 259/259, Chandigarh 254/235, Uttarakhand 244/175, Gujarat 226/205, Madhya Pradesh 215/173, Haryana 211/171, Nagaland 202/150, Himachal Pradesh 194/191, Andhra Pradesh 190/188, Manipur 187/159, Dadra Nagar Haveli 166/127, Goa 154/146, Jammu Kashmir 137/137, Jharkhand 132/124, Tripura 121/100, Arunachal Pradesh 115/105, Sikkim 111/85, Meghalaya 105/97, Delhi 95/88, Mizoram 83/74, Puducherry 78/78, Ladakh 55/55, Andaman Nicobar 45/41. No State is missing, but Assam (384 of 987), Uttarakhand (69 of 244), Nagaland (52 of 202), Madhya Pradesh (42 of 215) and Haryana (40 of 211) have the most title-only records. Impact: Medium for a lawyer who works in that State (State Acts matter more than the table suggests); fix: the same State records may exist as PDFs on the State's own site (not fetched).

### 1.2 The important-Acts check (170 Acts, one line each)
Chosen from the groups in the brief plus others lawyers use (Evidence, labour, tax, IP, environment, family, tribunals). Each was matched by title in the database. Column text: Central copy status, sections we hold, sections expected where we have a reference count or a trustworthy highest number (marked ~), possibly-incomplete count, and the known gaps. "Confident gaps" = numbers the gap checker is sure are missing after our fills. **Orders/Schedules are loaded only for the CPC (Orders and Rules), the Limitation Act, the Stamp Act (Schedule I) and the Constitution** (so for every other line below the answer to "Orders/Schedules present?" is No).

| Group | Act | What we hold |
|---|---|---|
| Criminal | Bharatiya Nyaya Sanhita, 2023 | central · 351 sections held / ~358 expected · 2 possibly incomplete · 7 confident gaps |
| Criminal | Bharatiya Nagarik Suraksha Sanhita, 2023 | central · 525 sections held / ~531 expected · 2 possibly incomplete · 6 confident gaps |
| Criminal | Bharatiya Sakshya Adhiniyam, 2023 | central · 166 sections held / ~170 expected · 3 possibly incomplete · 4 confident gaps |
| Criminal | Indian Penal Code, 1860 | central · 533 sections held / ~511 expected · 27 possibly incomplete · 24 confident gaps; repealed |
| Criminal | Code of Criminal Procedure, 1973 | promoted · 442 sections held / ~484 expected · 6 possibly incomplete · promoted State-filed copy |
| Criminal | Indian Evidence Act, 1872 | central · 175 sections held / ~167 expected · 8 possibly incomplete · 4 confident gaps; repealed |
| Criminal | NDPS Act, 1985 | central · 105 sections held / ~83 expected · 1 possibly incomplete · 7 confident gaps |
| Criminal | POCSO Act, 2012 | central · 41 sections held / ~46 expected · 2 possibly incomplete · no known gap |
| Criminal | PMLA, 2002 | central · 64 sections held / ~75 expected · 3 possibly incomplete · no known gap |
| Criminal | Prevention of Corruption Act, 1988 | central · 34 sections held / ~30 expected · 3 possibly incomplete · 13 filled by us |
| Criminal | Arms Act, 1959 | central · 0 sections held · 1 possibly incomplete · STUB; 1 possibly incomplete |
| Criminal | Unlawful Activities (Prevention) Act, 1967 | central · 65 sections held / ~53 expected · 3 possibly incomplete · 1 confident gaps |
| Criminal | Probation of Offenders Act, 1958 | central · 19 sections held / ~19 expected · 0 possibly incomplete · no known gap |
| Criminal | Prevention of Damage to Public Property Act, 1984 | central · 6 sections held / ~6 expected · 0 possibly incomplete · no known gap |
| Criminal | SC/ST (Prevention of Atrocities) Act, 1989 | central · 1 sections held / ~2 expected · 0 possibly incomplete · STUB |
| Criminal | Immoral Traffic (Prevention) Act, 1956 | central · 22 sections held / ~25 expected · 2 possibly incomplete · 3 confident gaps |
| Criminal | Protection of Women from Domestic Violence Act, 2005 | central · 36 sections held / ~37 expected · 0 possibly incomplete · 1 confident gaps |
| Criminal | Dowry Prohibition Act, 1961 | central · 10 sections held / ~10 expected · 0 possibly incomplete · no known gap |
| Criminal | Juvenile Justice Act, 2015 | central · 110 sections held / ~112 expected · 1 possibly incomplete · no known gap |
| Criminal | Criminal Law (Amendment) Act, 2013 | NO Central record: one Chandigarh-filed copy (18 sections); an amending Act, low use |
| Criminal | Code of Criminal Procedure (Identification) Act, 2022 | central · 10 sections held / ~10 expected · 1 possibly incomplete · no known gap |
| Criminal | Prisons Act, 1894 | central · 61 sections held / ~62 expected · 1 possibly incomplete · 1 confident gaps |
| Criminal | Customs Act, 1962 | STUB central `IND_central_2475` holds 3 sections; the full Act (184 sections) exists only as a Chandigarh-filed copy |
| Criminal | Official Secrets Act, 1923 | central · 14 sections held / ~14 expected · 1 possibly incomplete · 1 confident gaps |
| Criminal | Essential Commodities Act, 1955 | central · 19 sections held / ~16 expected · 1 possibly incomplete · no known gap |
| Criminal | Wildlife (Protection) Act, 1972 | central · 145 sections held / ~292 expected · 6 possibly incomplete · 7 confident gaps |
| Criminal | Environment (Protection) Act, 1986 | central · 19 sections held / ~26 expected · 0 possibly incomplete · no known gap |
| Civil | Code of Civil Procedure, 1908 | central · 172 sections held / ~158 expected · 45 possibly incomplete · 45 possibly incomplete; 887 filled by us (756 units) |
| Civil | Indian Contract Act, 1872 | central · 118 sections held / ~238 expected · 3 possibly incomplete · 203 filled by us |
| Civil | Specific Relief Act, 1963 | central · 43 sections held / ~44 expected · 1 possibly incomplete · 2 confident gaps; 8 filled by us |
| Civil | Transfer of Property Act, 1882 | central · 128 sections held / ~137 expected · 12 possibly incomplete · 9 confident gaps |
| Civil | Registration Act, 1908 | central · 76 sections held / ~93 expected · 0 possibly incomplete · no known gap |
| Civil | Limitation Act, 1963 | central · 43 sections held / ~32 expected · 1 possibly incomplete · 155 filled by us (137 units) |
| Civil | Indian Stamp Act, 1899 | central · 75 sections held · 16 possibly incomplete · 16 possibly incomplete; 152 filled by us (62 units) |
| Civil | Indian Succession Act, 1925 | central · 389 sections held / ~390 expected · 8 possibly incomplete · 3 confident gaps |
| Civil | Indian Partnership Act, 1932 | central · 74 sections held / ~74 expected · 5 possibly incomplete · 2 confident gaps |
| Civil | Sale of Goods Act, 1930 | central · 66 sections held / ~66 expected · 2 possibly incomplete · 1 confident gaps |
| Civil | Arbitration and Conciliation Act, 1996 | central · 102 sections held / ~86 expected · 16 possibly incomplete · 1 confident gaps; 16 possibly incomplete |
| Civil | Mediation Act, 2023 | central · 65 sections held / ~89 expected · 3 possibly incomplete · no known gap |
| Civil | Easements Act, 1882 | central · 64 sections held / ~64 expected · 2 possibly incomplete · no known gap |
| Civil | Trusts Act, 1882 | ABSENT (only the Charitable and Religious Trusts Act, 1920 exists) |
| Civil | Power of Attorney Act, 1882 | central · 7 sections held / ~6 expected · 0 possibly incomplete · no known gap |
| Civil | Notaries Act, 1952 | central · 15 sections held / ~15 expected · 0 possibly incomplete · no known gap |
| Civil | Indian Evidence-related: Bankers' Books Evidence Act, 1891 | central · 7 sections held / ~8 expected · 0 possibly incomplete · 1 confident gaps |
| Civil | Court Fees Act, 1870 | central · 41 sections held / ~36 expected · 11 possibly incomplete · 11 possibly incomplete |
| Civil | Legal Services Authorities Act, 1987 | central · 25 sections held / ~30 expected · 1 possibly incomplete · no known gap |
| Civil | Advocates Act, 1961 | central · 80 sections held / ~60 expected · 2 possibly incomplete · 1 confident gaps |
| Civil | Contempt of Courts Act, 1971 | central · 24 sections held / ~24 expected · 1 possibly incomplete · no known gap |
| Civil | Commercial Courts Act, 2015 | central · 22 sections held / ~23 expected · 7 possibly incomplete · 7 possibly incomplete |
| Civil | Interest Act, 1978 | central · 5 sections held / ~5 expected · 0 possibly incomplete · no known gap |
| Civil | Carriers Act, 1865 | central · 12 sections held / ~37 expected · 2 possibly incomplete · 2 possibly incomplete; repealed |
| Civil | Indian Railways Act, 1989 | central · 225 sections held / ~200 expected · 1 possibly incomplete · no known gap |
| Civil | Land Acquisition (RFCTLARR) Act, 2013 | central · 115 sections held / ~114 expected · 11 possibly incomplete · no known gap |
| Civil | Real Estate (Regulation and Development) Act, 2016 | central · 92 sections held / ~92 expected · 1 possibly incomplete · no known gap |
| Civil | Benami Transactions (Prohibition) Act, 1988 | central · 63 sections held / ~71 expected · 3 possibly incomplete · no known gap |
| Civil | Wakf Act, 1995 | PROMOTED copy `IND_state_10900` (81 sections); NOT updated for the Waqf (Amendment) Act 2025 (to check) |
| Family | Hindu Marriage Act, 1955 | central · 32 sections held / ~30 expected · 2 possibly incomplete · 16 filled by us |
| Family | Hindu Succession Act, 1956 | central · 30 sections held / ~31 expected · 3 possibly incomplete · 2 confident gaps |
| Family | Special Marriage Act, 1954 | central · 51 sections held / ~51 expected · 3 possibly incomplete · 3 confident gaps |
| Family | Hindu Adoptions and Maintenance Act, 1956 | central · 22 sections held / ~30 expected · 0 possibly incomplete · no known gap |
| Family | Hindu Minority and Guardianship Act, 1956 | central · 10 sections held / ~10 expected · 0 possibly incomplete · no known gap |
| Family | Guardians and Wards Act, 1890 | central · 50 sections held / ~51 expected · 2 possibly incomplete · no known gap |
| Family | Indian Divorce Act, 1869 | central · 53 sections held / ~62 expected · 4 possibly incomplete · 9 confident gaps |
| Family | Muslim Women (Protection of Rights on Divorce) Act, 1986 | central · 3 sections held / ~4 expected · 0 possibly incomplete · STUB |
| Family | Muslim Women (Protection of Rights on Marriage) Act, 2019 | central · 6 sections held / ~7 expected · 0 possibly incomplete · 1 confident gaps |
| Family | Prohibition of Child Marriage Act, 2006 | central · 12 sections held / ~21 expected · 2 possibly incomplete · 2 possibly incomplete |
| Family | Maintenance and Welfare of Parents and Senior Citizens Act, 2007 | central · 32 sections held / ~32 expected · 0 possibly incomplete · no known gap |
| Family | Family Courts Act, 1984 | central · 15 sections held / ~23 expected · 1 possibly incomplete · no known gap |
| Family | Christian Marriage Act, 1872 | central · 69 sections held / ~88 expected · 7 possibly incomplete · no known gap |
| Family | Parsi Marriage and Divorce Act, 1936 | central · 54 sections held / ~53 expected · 0 possibly incomplete · 1 confident gaps |
| Family | Foreign Marriage Act, 1969 | central · 28 sections held / ~29 expected · 3 possibly incomplete · no known gap |
| Family | Surrogacy (Regulation) Act, 2021 | central · 52 sections held / ~54 expected · 3 possibly incomplete · 2 confident gaps |
| Family | Transgender Persons (Protection of Rights) Act, 2019 | central · 22 sections held / ~23 expected · 0 possibly incomplete · 1 confident gaps |
| Family | Rights of Persons with Disabilities Act, 2016 | central · 100 sections held / ~102 expected · 1 possibly incomplete · no known gap |
| Family | Mental Healthcare Act, 2017 | central · 125 sections held / ~126 expected · 1 possibly incomplete · 1 confident gaps |
| Commercial | Companies Act, 2013 | central · 452 sections held / ~470 expected · 10 possibly incomplete · 27 confident gaps |
| Commercial | Insolvency and Bankruptcy Code, 2016 | central · 268 sections held / ~255 expected · 20 possibly incomplete · no known gap |
| Commercial | SARFAESI Act, 2002 | central · 49 sections held / ~42 expected · 1 possibly incomplete · no known gap |
| Commercial | Negotiable Instruments Act, 1881 | central · 140 sections held / ~148 expected · 3 possibly incomplete · 40 filled by us |
| Commercial | Competition Act, 2002 | central · 56 sections held · 5 possibly incomplete · no known gap |
| Commercial | Consumer Protection Act, 2019 | central · 105 sections held / ~107 expected · 0 possibly incomplete · no known gap |
| Commercial | FEMA, 1999 | central · 31 sections held / ~49 expected · 1 possibly incomplete · no known gap |
| Commercial | Central GST Act, 2017 | central · 173 sections held / ~174 expected · 6 possibly incomplete · no known gap |
| Commercial | Integrated GST Act, 2017 | central · 27 sections held / ~25 expected · 3 possibly incomplete · no known gap |
| Commercial | GST (Compensation to States) Act, 2017 | central · 15 sections held / ~14 expected · 1 possibly incomplete · no known gap |
| Commercial | Income-tax Act, 1961 | central · 560 sections held / ~298 expected · 45 possibly incomplete · no known gap |
| Commercial | Black Money Act, 2015 | central · 86 sections held / ~88 expected · 0 possibly incomplete · no known gap |
| Commercial | SEBI Act, 1992 | central · 66 sections held / ~35 expected · 1 possibly incomplete · 4 confident gaps |
| Commercial | Securities Contracts (Regulation) Act, 1956 | central · 50 sections held / ~30 expected · 1 possibly incomplete · no known gap |
| Commercial | Depositories Act, 1996 | central · 48 sections held / ~31 expected · 0 possibly incomplete · 2 confident gaps |
| Commercial | Banking Regulation Act, 1949 | central · 123 sections held / ~56 expected · 9 possibly incomplete · no known gap |
| Commercial | Reserve Bank of India Act, 1934 | central · 114 sections held · 9 possibly incomplete · 7 confident gaps |
| Commercial | Recovery of Debts and Bankruptcy Act, 1993 | central · 38 sections held / ~37 expected · 0 possibly incomplete · no known gap |
| Commercial | Limited Liability Partnership Act, 2008 | central · 80 sections held / ~81 expected · 5 possibly incomplete · no known gap |
| Commercial | Indian Contract-related: Payment and Settlement Systems Act, 2007 | central · 39 sections held / ~38 expected · 3 possibly incomplete · 1 confident gaps |
| Commercial | Trade Marks Act, 1999 | central · 160 sections held / ~159 expected · 1 possibly incomplete · 9 confident gaps |
| Commercial | Patents Act, 1970 | central · 146 sections held / ~162 expected · 9 possibly incomplete · 21 confident gaps |
| Commercial | Copyright Act, 1957 | central · 86 sections held / ~79 expected · 2 possibly incomplete · 5 confident gaps |
| Commercial | Designs Act, 2000 | central · 36 sections held / ~47 expected · 0 possibly incomplete · no known gap |
| Commercial | Geographical Indications Act, 1999 | central · 73 sections held / ~87 expected · 1 possibly incomplete · no known gap |
| Commercial | Legal Metrology Act, 2009 | central · 37 sections held / ~57 expected · 1 possibly incomplete · no known gap |
| Commercial | Micro, Small and Medium Enterprises Development Act, 2006 | central · 16 sections held / ~31 expected · 1 possibly incomplete · no known gap |
| Commercial | Insurance Act, 1938 | central · 131 sections held / ~123 expected · 4 possibly incomplete · no known gap |
| Commercial | Carriage by Road Act, 2007 | central · 22 sections held / ~22 expected · 0 possibly incomplete · no known gap |
| Commercial | Customs Tariff Act, 1975 | central · 17 sections held / ~15 expected · 11 possibly incomplete · 11 possibly incomplete |
| Commercial | Central Excise Act, 1944 | central · 109 sections held / ~40 expected · 13 possibly incomplete · 5 confident gaps |
| Commercial | Foreign Trade (Development and Regulation) Act, 1992 | central · 24 sections held / ~20 expected · 2 possibly incomplete · 2 confident gaps |
| Commercial | Indian Telegraph Act, 1885 | central · 39 sections held / ~34 expected · 1 possibly incomplete · 5 confident gaps; repealed |
| Commercial | Telecommunications Act, 2023 | central · 61 sections held / ~62 expected · 5 possibly incomplete · 1 confident gaps |
| Commercial | Electricity Act, 2003 | central · 183 sections held / ~185 expected · 4 possibly incomplete · no known gap |
| Commercial | Mines and Minerals (Development and Regulation) Act, 1957 | central · 20 sections held / ~21 expected · 7 possibly incomplete · 1 confident gaps; 7 possibly incomplete |
| Labour | Code on Wages, 2019 | central · 67 sections held / ~69 expected · 4 possibly incomplete · no known gap |
| Labour | Industrial Relations Code, 2020 | central · 104 sections held / ~104 expected · 8 possibly incomplete · no known gap |
| Labour | Code on Social Security, 2020 | central · 147 sections held / ~164 expected · 13 possibly incomplete · no known gap |
| Labour | Occupational Safety, Health and Working Conditions Code, 2020 | central · 142 sections held / ~143 expected · 6 possibly incomplete · 2 confident gaps |
| Labour | Industrial Disputes Act, 1947 | central · 78 sections held · 20 possibly incomplete · 1 confident gaps; 20 possibly incomplete |
| Labour | Payment of Gratuity Act, 1972 | promoted · 16 sections held / ~15 expected · 1 possibly incomplete · 2 confident gaps; promoted State-filed copy |
| Labour | Employees' Provident Funds Act, 1952 | central · 64 sections held / ~22 expected · 11 possibly incomplete · 11 possibly incomplete |
| Labour | Minimum Wages Act, 1948 | promoted · 34 sections held / ~31 expected · 5 possibly incomplete · 4 confident gaps; promoted State-filed copy |
| Labour | Payment of Wages Act, 1936 | promoted · 31 sections held / ~26 expected · 3 possibly incomplete · 1 confident gaps; promoted State-filed copy |
| Labour | Factories Act, 1948 | promoted · 131 sections held / ~119 expected · 28 possibly incomplete · 4 confident gaps; 28 possibly incomplete; promoted State-filed copy |
| Labour | Trade Unions Act, 1926 | central · 34 sections held / ~33 expected · 1 possibly incomplete · no known gap |
| Labour | Employees' State Insurance Act, 1948 | promoted · 117 sections held / ~100 expected · 3 possibly incomplete · promoted State-filed copy |
| Labour | Maternity Benefit Act, 1961 | promoted · 27 sections held / ~29 expected · 1 possibly incomplete · promoted State-filed copy |
| Labour | Sexual Harassment of Women at Workplace Act, 2013 | central · 29 sections held / ~30 expected · 1 possibly incomplete · 1 confident gaps |
| Labour | Equal Remuneration Act, 1976 | promoted · 16 sections held / ~18 expected · 0 possibly incomplete · 2 confident gaps; promoted State-filed copy |
| Labour | Contract Labour (Regulation and Abolition) Act, 1970 | PROMOTED copy `IND_state_14038` (35 sections); the Act may be repealed by the OSH Code 2020 (to check) |
| Labour | Employees' Compensation Act, 1923 | NO Central record: only State-filed copies (39 to 41 sections) |
| Labour | Bonded Labour System (Abolition) Act, 1976 | central · 27 sections held / ~27 expected · 0 possibly incomplete · no known gap |
| Labour | Child and Adolescent Labour Act, 1986 | STUB: 3 sections held (the Act has ~21) |
| Labour | Apprentices Act, 1961 | central · 41 sections held / ~37 expected · 4 possibly incomplete · no known gap |
| Public/Tech | Constitution of India | central · 512 sections held · 0 possibly incomplete · 513 filled by us (512 units) |
| Public/Tech | Information Technology Act, 2000 | central · 104 sections held / ~90 expected · 4 possibly incomplete · 4 confident gaps |
| Public/Tech | Digital Personal Data Protection Act, 2023 | central · 44 sections held / ~44 expected · 3 possibly incomplete · no known gap |
| Public/Tech | Right to Information Act, 2005 | central · 30 sections held / ~31 expected · 3 possibly incomplete · 1 confident gaps |
| Public/Tech | Motor Vehicles Act, 1988 | central · 216 sections held / ~217 expected · 1 possibly incomplete · 2 confident gaps |
| Public/Tech | Representation of the People Act, 1950 | central · 45 sections held / ~32 expected · 3 possibly incomplete · 2 confident gaps |
| Public/Tech | Representation of the People Act, 1951 | central · 178 sections held / ~170 expected · 8 possibly incomplete · no known gap |
| Public/Tech | Citizenship Act, 1955 | central · 18 sections held / ~19 expected · 0 possibly incomplete · no known gap |
| Public/Tech | Passports Act, 1967 | central · 26 sections held / ~27 expected · 0 possibly incomplete · no known gap |
| Public/Tech | Foreigners Act, 1946 | REPEALED (Act 13 of 2025) record `IND_REP_2406_1946` holds 0 sections; replaced by the Immigration and Foreigners Act, 2025 (8 sections held) |
| Public/Tech | Immigration and Foreigners Act, 2025 | central · 8 sections held / ~25 expected · 1 possibly incomplete · no known gap |
| Public/Tech | Protection of Human Rights Act, 1993 | central · 0 sections held · 0 possibly incomplete · STUB |
| Public/Tech | Right of Children to Free and Compulsory Education Act, 2009 | central · 31 sections held / ~38 expected · 0 possibly incomplete · no known gap |
| Public/Tech | Prevention of Food Adulteration / Food Safety and Standards Act, 2006 | central · 98 sections held / ~101 expected · 2 possibly incomplete · no known gap |
| Public/Tech | Drugs and Cosmetics Act, 1940 | central · 68 sections held / ~83 expected · 5 possibly incomplete · 2 confident gaps |
| Public/Tech | Clinical Establishments Act, 2010 | central · 33 sections held / ~56 expected · 1 possibly incomplete · no known gap |
| Public/Tech | National Green Tribunal Act, 2010 | central · 36 sections held / ~38 expected · 2 possibly incomplete · no known gap |
| Public/Tech | Water (Prevention and Control of Pollution) Act, 1974 | central · 63 sections held / ~64 expected · 1 possibly incomplete · no known gap |
| Public/Tech | Air (Prevention and Control of Pollution) Act, 1981 | central · 51 sections held / ~54 expected · 0 possibly incomplete · no known gap |
| Public/Tech | Forest (Conservation) Act, 1980 | PROMOTED copy (4 sections; the Act was renamed and amended in 2023, to check) |
| Public/Tech | Indian Forest Act, 1927 | central · 85 sections held / ~85 expected · 2 possibly incomplete · no known gap |
| Public/Tech | Administrative Tribunals Act, 1985 | central · 37 sections held / ~37 expected · 1 possibly incomplete · 1 confident gaps |
| Public/Tech | Lokpal and Lokayuktas Act, 2013 | central · 63 sections held / ~63 expected · 4 possibly incomplete · 1 confident gaps |
| Public/Tech | Whistle Blowers Protection Act, 2014 | ABSENT |
| Public/Tech | Places of Worship (Special Provisions) Act, 1991 | central · 7 sections held / ~7 expected · 1 possibly incomplete · no known gap |
| Public/Tech | Army Act, 1950 | central · 191 sections held / ~193 expected · 2 possibly incomplete · no known gap |
| Public/Tech | Air Force Act, 1950 | central · 193 sections held / ~194 expected · 1 possibly incomplete · 1 confident gaps |
| Public/Tech | Navy Act, 1957 | central · 189 sections held / ~188 expected · 0 possibly incomplete · no known gap |
| Public/Tech | Police Act, 1861 | central · 41 sections held · 4 possibly incomplete · no known gap |
| Public/Tech | Indian Post Office Act, 2023 | central · 16 sections held / ~16 expected · 1 possibly incomplete · no known gap |
| Public/Tech | Cinematograph Act, 1952 | central · 30 sections held / ~18 expected · 0 possibly incomplete · no known gap |
| Public/Tech | Press and Registration of Periodicals Act, 2023 | central · 22 sections held / ~22 expected · 0 possibly incomplete · no known gap |
| Public/Tech | Epidemic Diseases Act, 1897 | central · 8 sections held / ~5 expected · 2 possibly incomplete · 2 possibly incomplete |
| Public/Tech | Disaster Management Act, 2005 | central · 72 sections held / ~79 expected · 2 possibly incomplete · 11 confident gaps |
| Public/Tech | General Clauses Act, 1897 | central · 32 sections held / ~30 expected · 3 possibly incomplete · no known gap |
| Public/Tech | Indian Oaths Act, 1969 | central · 9 sections held / ~9 expected · 0 possibly incomplete · no known gap |
| Public/Tech | Public Premises (Eviction of Unauthorised Occupants) Act, 1971 | central · 24 sections held / ~20 expected · 2 possibly incomplete · no known gap |
| Public/Tech | Societies Registration Act, 1860 | central · 36 sections held / ~32 expected · 14 possibly incomplete · 1 confident gaps; 14 possibly incomplete |
| Public/Tech | Indian Registration/Identification: Aadhaar Act, 2016 | central · 40 sections held / ~58 expected · 1 possibly incomplete · no known gap |

**What the 170 lines show:** 162 of 170 have a Central record; 5 are stubs (3 sections or fewer: Arms Act, 1959, SC/ST (Prevention of Atrocities) Act, 1989, Muslim Women (Protection of Rights on Divorce) Act, 1986, Child and Adolescent Labour Act, 1986, Protection of Human Rights Act, 1993). Missing outright or only as State-filed copies: Customs Act 1962 (stub), Employees' Compensation Act 1923, Criminal Law (Amendment) Act 2013, Indian Trusts Act 1882, Whistle Blowers Protection Act 2014. Matching is by title, so an Act under an unusual title could be mis-reported (checked by hand for the ones listed above).

### 1.3 Acts passed or amended after our snapshot (v2026.08)
- The dataset holds **no Central Act of 2026** (latest year 2025: 10 Acts; 2024: 2; 2023: 15) and no information about amendments made after India Code was scraped (the column `amendment_count` is a count, not text).
- Present from 2025: Bills of Lading Act, Boilers Act, Carriage of Goods by Sea Act, Immigration and Foreigners Act, Mussalman Wakf (Repeal) Act, National Sports Governance Act, Protection of Interests in Aircraft Objects Act, Repealing and Amending Act, Tribhuvan Sahkari University Act, Health Security se National Security Cess Act.
- **To check (not in our data under their usual titles):** Income-tax Act, 2025; Waqf (Amendment) Act 2025 (our Waqf Act 1995 is the old text); Merchant Shipping Act, 2025 (we hold the 1958 Act with 532 sections); Indian Ports Act, 2025 (we hold the 1908 Act); Banking Laws (Amendment) Act, 2025; Jan Vishwas (Amendment of Provisions) Act, 2025; Online Gaming (Promotion and Regulation) Act, 2025; Insurance laws amendment 2025; the atomic energy legislation of 2025 (we hold the 1962 Act). These are from general knowledge of 2025 legislation, not from our data, so each is a "to check on India Code".
- The 9 PDFs on disk carry their own creation dates (for example Contract Act, CPC, NI Act and others were created by India Code in 2021 per `pdfinfo`) and the Constitution PDF is "as on 10 September 2026": amendments after those dates are not in them.
- **Four Labour Codes** (Wages, Industrial Relations, Social Security, OSH): all four are in our data as in force. The older labour Acts they replace are inconsistent (see 1.4).

### 1.4 Repealed / in-force status: 30 spot checks
Verdicts are mine, from the "Rep., Act N of YYYY" notes in the titles and what I know of the law; the ones marked *to check* depend on notification dates I cannot see.

| # | Act | Our status | Verdict |
|---:|---|---|---|
| 1 | Indian Penal Code, 1860 | repealed | right (repealed by BNS 2023) |
| 2 | Code of Criminal Procedure, 1973 | **in force** | **wrong** (repealed by BNSS 2023, in force since 1 July 2024). The Act page now carries "Repealed — see BNSS" but the status is unchanged |
| 3 | Indian Evidence Act, 1872 | repealed | right |
| 4 | Foreigners Act, 1946 | repealed | right (Act 13 of 2025) |
| 5 | Boilers Act, 1923 | repealed | right (Act 12 of 2025) |
| 6 | Aircraft Act, 1934 | repealed | right (Act 16 of 2024) |
| 7 | Indian Post Office Act, 1898 | repealed | right (Act 43 of 2023) |
| 8 | Mussalman Wakf Act, 1923 | repealed | right (Act 15 of 2025) |
| 9 | Mines Act, 1952 | repealed | right (OSH Code, Act 37 of 2020) |
| 10 | Payment of Bonus Act, 1965 | repealed | right (Code on Wages, Act 29 of 2019) |
| 11 | Companies Act, 1956 | repealed | right |
| 12 | Indian Telegraph Act, 1885 | repealed | right (Telecommunications Act 2023) |
| 13 | Minimum Wages Act, 1948 | **two records**: repealed `IND_REP_2463_1948` and in force `IND_state_8322` | **contradiction**: the in-force copy should be repealed, or both flagged |
| 14 | Payment of Wages Act, 1936 | two records, same | **contradiction** |
| 15 | Factories Act, 1948 | two records, same (Rep., Act 37 of 2020) | **contradiction** |
| 16 | Maternity Benefit Act, 1961 | two records, same (Rep., Act 36 of 2020) | **contradiction** |
| 17 | Payment of Gratuity Act, 1972 | in force | to check (Code on Social Security 2020 repeals it once in force) |
| 18 | Employees' Provident Funds Act, 1952 | in force | to check (same) |
| 19 | Employees' State Insurance Act, 1948 | in force | to check (same) |
| 20 | Industrial Disputes Act, 1947 | in force | to check (Industrial Relations Code 2020) |
| 21 | Trade Unions Act, 1926 | in force | to check (same) |
| 22 | Equal Remuneration Act, 1976 | in force | to check (Code on Wages) |
| 23 | Contract Labour (Regulation and Abolition) Act, 1970 | in force | to check (OSH Code) |
| 24 | Indian Partnership Act, 1932 | **two records** (repealed twin exists) | contradiction: a repealed duplicate title exists next to the in-force Act (a 1932 Act "Rep." by a 1952 Act is a different Act with the same title) |
| 25 | IPC copies filed under States | 6 shown **in force** | wrong (the Central IPC is repealed) |
| 26 | CrPC copies filed under States | 31 shown **in force** | wrong |
| 27 | Evidence Act copies filed under States | 4 shown **in force** | wrong |
| 28 | Information Technology Act, 2000 | in force | right |
| 29 | Companies Act, 2013 | in force | right |
| 30 | Bharatiya Nyaya Sanhita, 2023 | in force | right |

Result: 17 right, 7 wrong or contradictory (the CrPC, the four duplicated labour Acts, and the State-filed IPC, CrPC and Evidence Act copies), 7 to check. Impact: **High** (a lawyer can quote a repealed Act as law). Fix: free (a status-override table plus hiding repealed State copies), then re-verify against India Code.

## 2. ACTS: quality

### 2.1 Flags (sections, Central vs State)
| Flag | Central (41,600) | State (169,953) |
|---|---:|---:|
| Complete | 39,203 (94.2%) | 140,513 (82.7%) |
| Possibly incomplete | 2,397 (5.8%) | 27,621 (16.3%) |
| Garbled (text hidden) | 0 | 1,819 (1.1%) |
| Hindi pieces hidden | 10 | 1,033 |
| Contains Devanagari | 10 | 3,065 |
| Hindi not verifiable | 0 | 1,798 |
| Other Indic script | 0 | 123 |
| No section number | 630 | 2,536 |
| Lost characters | 2 | 2,212 |
| Part / sub-gap flags | 25 / 110 | 150 / 3,269 |
| Mixed structure / duplicates collapsed | 2,376 / 2,149 | 26,349 / 11,213 |
| No chapter label shown (labels appear only when they pass the checks) | 20,462 (49.2%) | 121,201 (71.3%) |

### 2.2 Missing or wrong section numbers (update of MISSING-SECTIONS.md)
- Confident gaps (the list that drives the "missing from source data" message), after our W7/W7b fills: **706 numbers in 256 Central Acts** (747 before the Constitution/units; 220 of those Acts are in force: 606 gaps), and 3,600 in 1,196 State Acts. Largest open Central gaps: New Delhi Municipal Council Act 1994 (34), Companies Act 2013 (27), Merchant Shipping Act 1958 (21), Patents Act 1970 (21), Disaster Management Act 2005 (11), Trade Marks Act 1999 (9), Divorce Act 1869 (9), Transfer of Property Act 1882 (9), Wild Life (Protection) Act (7), NDPS Act (7), RBI Act (7), BNS (7), BNSS (6).
- The earlier "100 most-used Central Acts" report (3,189 missing numbers, 182 confident, 3,007 uncertain, 146 sections starting with another number): re-run on the 74 of those 100 whose title still matches exactly: held 5226 → **5504** section numbers, **missing 1936 → 1529** (−407); 61 of 74 still miss at least one; 10 hold under half of what is expected. The other 26 (IPC, Evidence Act, Companies Act 1956, Motor Vehicles Act 1939 and similar repealed or oddly titled Acts) were not recomputed. These counts are lower-bound heuristics (the expected last section comes from the highest number held or cited), so treat the biggest ones as leads: Insolvency and Bankruptcy Code (218), Electricity Act (165), Army Act (156), Delhi Municipal Corporation Act (127), Income-tax Act (104), Companies Act 2013 (60), PMLA (59), Guardians and Wards Act (51).
- Wrong text: the 8 Acts we checked (W7b) are fixed (519 sections). The same "starts with another number" / "shared numbers" check was not run for other Acts.

### 2.3 Orders, Rules, Schedules, Forms, Appendices not loaded
Loaded: CPC (54 Orders, 709 Rules), Limitation (137 Articles), Stamp Act Schedule I (62 Articles), Constitution (12 Schedules; Preamble). **Not loaded, in order of use:** CrPC First and Second Schedules (classification of offences, forms) and the BNSS Schedules; CPC Appendices A to H (forms); Companies Act Schedules I to VII (Schedule III accounts, VII CSR) and Rules; IBC Schedules; Income-tax Act Schedules and Rules; GST Acts Schedules; NDPS Schedule; PMLA Schedule; Arbitration Act Fifth to Seventh Schedules; Trade Marks and Patents Schedules and Forms; Succession Act Schedules; Motor Vehicles Act Schedules; the Stamp Act Schedule I-A (State rates) and every State's own Stamp schedule; subordinate Rules of every Act (Supreme Court Rules, High Court Rules, Companies Rules, IT Rules 2021 and so on). In the base data only 9 Central Acts have even one unnumbered schedule-like row. Impact: **High**. Fix: PDFs per Act (needs permission / download), then the schedule extractor we already have.

### 2.4 Constitution
Preamble: loaded (its own unit). Articles 500, Schedules 12: loaded. **Appendices I to III** (100th Amendment land-boundary Schedules, the 2019 Order, the Article 370(3) declaration) are in the PDF but not loaded. The Constitution text is "as on 10 September 2026" with amendments up to the 106th (2023). Impact: Low. Fix: free (PDF already on disk).

### 2.5 Chapter and Part labels are unreliable (measured 2026-10-28)

Measured over all 10,112 Acts in the text snapshot (`ACTS_TEXT_DATA_DIR`, open-india-law v2026.08), 211,553 sections:

| What | Sections | Share |
|---|---:|---:|
| No chapter value at all | 100,330 | 47.4% |
| Conflicting chapter values across the section's chunks (two or more different chapters recorded for one section) | 6,520 | 3.1% |
| Chapter name with letters spaced apart ("O F C O M P E N S A T I O N") | 60 | 0.03% |
| Acts with at least one conflicting or letter-spaced chapter | 1,180 of 10,112 | 11.7% |

Worst Acts by sections affected: Arunachal Pradesh Municipal Act 2007 (103 of 461), West Bengal Sales Tax Act 1994 (79 of 106), Maharashtra Municipal Corporations Act (68 of 498), Telangana Land Revenue Act (57 of 164), Punjab Excise Act 1914 (53 of 226), Maharashtra Stamp Act (53 of 73), Wildlife (Protection) Act 1972 (50 of 117).

**Examples in the Negotiable Instruments Act, 1881** (the Act the mock-ups use):
- Seven chapter names are letter-spaced: "O F C O M P E N S A T I O N" (s.1), "O F N O T I NG A N D P R O T E S T" (s.99), "OF R E A S O N A B L E T I M E" (s.105), "S P E C I A L R U L E S O F E V I D E N C E" (s.118), "O F CROSSED C H E Q U E S" (s.123), "O F B I L L S I N S E T S" (s.132), "O F I N T E R N A T I O N A L LA W" (s.134).
- Section 138 is stored under chapter **XVI** "O F I N T E R N A T I O N A L LA W", which is the heading of the previous group (ss.134 to 137). The section belongs to chapter **XVII**, as the Supreme Court's own opening text in `2014_INSC_514` says ("Chapter XVII of Negotiable Instruments Act"). So the label is wrong, not only badly spaced.
- Section 1 carries three different chapters at once (`II`, `I`, `XII`).
- One unrelated garbled value: "`. . 3 , - ' p&Llhi'&k$+te?'`" (Tamil Nadu Land Reforms (Fixation of Ceiling on Land) Act 1961, s.4).

**Decision (2026-10-28):** the Law page contents list **section numbers and headings only**; no Part or Chapter headings are shown anywhere until the data is repaired. Fixing it needs the chapter headings re-read from each Act's PDF (the India Code supplement process); it is a data task and is not part of the restructure.

### 2.6 Printed typos in Section 138, Negotiable Instruments Act (checked 2026-10-28)

The dataset text of s.138 contains four oddities. We compared it against the on-disk India Code PDF (`content/supplement/pdfs/ni-act-1881.pdf`, India Code file a1881-26.pdf, created 2023-06-26), extracted with `scripts/supplement/extract-sections.mjs`:

| Where | Dataset text | India Code PDF (official) |
|---|---|---|
| Proviso (a) | "thecheque" (missing space) | same ("thecheque") |
| Proviso (b) | "giving a notice; in writing, to the drawer" | same |
| Explanation | "debt of other liability" (the section otherwise says "debt or other liability") | same |
| Punishment | "two years'" with a stray closing quote | `[a term which may be extended to two years’]`: an amendment bracket mark, not a typo |

**Finding:** the typos are in the published source, not introduced by the dataset or by our extraction, so there is no "official text" that differs. The India Code supplement holds 40 NI Act fill-in files (for example 137, 142A, 143, 145, 147, 148) but none for s.138. **Decision:** show statute text exactly as printed, never silently corrected; the Law page carries a margin note naming the two apparent typos; the stray amendment marks are stripped for display only. Re-check s.13's "two typos" note in `docs/MISSING-SECTIONS.md` the same way.

## 3. JUDGMENTS

### 3.1 Supreme Court (37,014 case records, 1950 to 2025)
- Cases per year: 43 (1950), 124 (1958), 276 (1960), ~300 to 400 (1961 to 1993), 623 (1994), 914 (1995), **1,534 (1996)**, 831 (1997), 491 (1998), then 500 to 1,300 a year (peak 1,322 in 2009), 744 (2024), **437 (2025, partial year)**.
- Suspiciously low or uneven: 1982 (104, half of 1981's 211), 1997 and 1998 (drops of 46% and 41% after the 1996 spike), 2020 (568, down 46% from 1,043), 2025 (437, partial). The Supreme Court actually decides far more than ~700 reportable judgments a year, so the dataset is the reported judgments (SCR / INSC), not every order. The dataset's own README lists 34,954 Supreme Court judgments; we hold 37,014 distinct case ids and have not reconciled the 2,060 difference.
- Field completeness: title 100%, citation 100%, decision date 100%, authoring judge 99.96%, bench size 100%, disposition 97.5% (927 blank), **case number from the dataset 0%** (extracted from the heading for 32.0%, 11,831 cases), **full bench printed in the report extracted for 65.5%** (24,229).
- Text we hold: only the first ~900 characters of the English report, kept as `preview.json` per year: **32,946 of 37,014 (89.0%)**; 1,422 cases have no clean start and 2,646 more failed the quality check. The full text (12.8M judgments in the dataset) is on the SSD but not in the app. **What this blocks:** searching inside judgments; "which cases cite section 138"; reading a holding; citing a paragraph; chat or drafting over case law; counting how often a section is applied; verifying a case is still good law. Statute links work only on those 900 characters (5,525 judgments, 16.8%).
- Impact: **High**. Fix: the dataset has the full text; storing and embedding 37,014 judgments (about 20 to 40 passages each) is a large job against the free Neon limit, so it needs R2 plus either a bigger vector store or paid Voyage rate; first step free: serve full text from R2 without embeddings and keyword-search only the SC.

### 3.2 High Courts (25 courts, 14.2M case records)
Years missing since 2000 and sudden drops are listed; "sparse" years (under 50 cases) are in the data but suspiciously thin. Judge field: only Bombay (84.5%), Gujarat (64.1%) and Orissa (44.5%) are exported; for the other 22 courts the judge field is 0% (unreliable in the dataset, so left out). Citation: 0% for every High Court (cite by case number).

| Court | Cases | Years | Years missing since 2000 | Sudden drops (year to year) | Cases without a year | Case number | Judges | Disposition | Parties |
|---|---:|---|---|---|---:|---:|---:|---:|---:|
| allahabad | 1,556,323 | 1973–2025 | 2000,2002,2006 | 2023→2024 (287,015→89,832) | 2 | 63.3% | 0.0% | 99.4% | 69.5% |
| andhra pradesh | 261,773 | 1962–2026 | – | – | 5 | 98.6% | 0.0% | 99.5% | 90.4% |
| bombay | 1,578,864 | 1908–2025 | – | 2019→2020 (96,634→32,718) | 0 | 99.0% | 84.5% | 99.3% | 92.6% |
| calcutta | 340,418 | 1950–2025 | – | – | 0 | 43.2% | 0.0% | 98.9% | 95.1% |
| chhattisgarh | 509,786 | 1963–2025 | – | – | 1 | 85.8% | 0.0% | 99.9% | 43.6% |
| delhi | 330,400 | 1957–2026 | – | 2008→2009 (2,388→33); 2020→2021 (13,312→4,518) | 1 | 70.9% | 0.0% | 85.0% | 77.8% |
| gauhati | 286,466 | 1962–2026 | – | – | 1 | 75.3% | 0.0% | 94.3% | 81.4% |
| gujarat | 405,840 | 1982–2025 | – | 2008→2009 (10,284→2); 2015→2016 (8,818→1); 2022→2023 (67,118→4,573); 2023→2024 (4,573→1,732) | 0 | 99.6% | 64.1% | 99.8% | 87.5% |
| jammu and kashmir and ladakh | 100,285 | 1956–2025 | 2002 | – | 0 | 97.0% | 0.0% | 98.4% | 58.5% |
| himachal pradesh | 254,825 | 1942–2025 | – | – | 0 | 98.9% | 0.0% | 98.8% | 90.1% |
| jharkhand | 420,729 | 1947–2025 | – | – | 0 | 99.8% | 0.0% | 99.7% | 78.6% |
| karnataka | 686,152 | 1968–2025 | – | 2012→2013 (29,925→8,927) | 4 | 97.2% | 0.0% | 99.8% | 95.0% |
| kerala | 1,018,714 | 1950–2024 | – | – | 1 | 100.0% | 0.0% | 100.0% | 95.0% |
| madhya pradesh | 646,344 | 1990–2024 | 2001,2006 | 2023→2024 (121,100→12,153) | 23 | 87.2% | 0.0% | 100.0% | 88.5% |
| madras | 1,498,010 | 1910–2025 | – | 2011→2012 (20,512→38) | 2 | 98.5% | 0.0% | 99.6% | 88.0% |
| manipur | 16,763 | 2016–2025 | – | 2019→2020 (2,523→883) | 0 | 99.6% | 0.0% | 99.6% | 73.6% |
| meghalaya | 10,827 | 2010–2025 | – | – | 0 | 98.9% | 0.0% | 100.0% | 87.5% |
| orissa | 685,646 | 1941–2025 | – | – | 2 | 99.8% | 44.5% | 99.5% | 80.9% |
| patna | 1,614,936 | 1924–2026 | – | – | 3 | 100.0% | 0.0% | 98.3% | 81.9% |
| punjab and haryana | 1,133,710 | 1945–2024 | – | 2011→2012 (67,506→52); 2022→2023 (111,864→6,305) | 0 | 52.4% | 0.0% | 99.9% | 97.0% |
| rajasthan | 1,056,767 | 1989–2025 | – | – | 0 | 95.6% | 0.0% | 99.7% | 51.2% |
| sikkim | 2,219 | 2000–2025 | – | – | 0 | 90.9% | 0.0% | 99.8% | 87.8% |
| telangana | 1,005,127 | 1952–2025 | – | – | 20 | 96.1% | 0.0% | 99.8% | 94.5% |
| tripura | 30,062 | 1981–2025 | 2000,2001,2003,2004,2005,2012 | – | 0 | 83.3% | 0.0% | 99.6% | 79.7% |
| uttarakhand | 205,475 | 1950–2025 | – | 2006→2007 (8,984→3,306) | 0 | 91.2% | 0.0% | 99.5% | 90.0% |

Reading the table: the **large drops are almost certainly the dataset's scraping coverage, not fewer judgments** (Punjab and Haryana 2022 to 2023 111,864 to 6,305, Allahabad 2023 to 2024 287,015 to 89,832, Madhya Pradesh 2023 to 2024 121,100 to 12,153, Gujarat 2022 to 2023 67,118 to 4,573, Madras 2011 to 2012 20,512 to 38, Delhi 2008 to 2009 2,388 to 33). Early years (before about 1990) are thin or missing for most courts: for example Allahabad's first listed year is 1973 and Madhya Pradesh's 1990, and the dataset README lists earliest years of 1992 for Allahabad and 2008 for Punjab and Haryana. Cases without a valid year: 71 across 12 courts (Madhya Pradesh 23, Telangana 20, Andhra Pradesh 5, Karnataka 4), now shown as a note on the court page. Impact: High for a lawyer who relies on case counts or "no case found" statements in a given court-year. Fix: re-scrape or fill from the AWS Open Data copy of High Court judgments (free download, large); not something we can do from the current dataset.

### 3.3 Tribunals and regulators' decisions
The dataset holds 15 forums, **813,168 matters** (CAT 162,439 + 181,429 case-information records; CESTAT 122,612; ITAT 115,074; DRT 108,395; NCLT 63,487; NGT 34,350; SAT 9,296; ATFP 3,359; CCI 2,944; APTEL 2,707; GST AAR 2,618; IBBI 1,580; RERA 1,530; TDSAT 1,348), indexed by case only: **2.1M PDFs with no text layer**, of which about 348,516 are reasoned decisions (the dataset's estimate). **We load none of it.** Impact: Medium (High for tax, company and IBC practitioners). Fix: OCR of the reasoned subset: paid (or very slow on the free Gemini quota); metadata-only listing is free.

### 3.4 What is live on the website and what is local only
| | Live on Vercel | Local only |
|---|---|---|
| Acts (Central, State) text, units, Constitution, search by keyword and by meaning, chat, drafting, review, vault and scans, feedback, admin | yes (Neon, Supabase, Voyage, Gemini are configured) | |
| Supreme Court case lists, filters, search, case page metadata | yes (the 37,014 records are static JSON in the repo) | |
| Supreme Court opening text (900 characters), statute links on case pages | no (needs `JUDGMENTS_DATA_DIR`, not set on Vercel) | yes |
| High Court case lists and search, year pages | **no** (R2 not set up: production shows counts by year and "Case lists for this court are not available yet") | yes (12 GB on disk) |
| Regulator instruments (titles list) | list yes; **text no** (not in the database or the Act-text store) | text only in the dataset |
| Tribunal decisions | no | not loaded anywhere |

## 4. SEARCH AND AI COVERAGE

| What | Searchable | Not |
|---|---|---|
| Keyword index (full-text) over displayed sections | **100%** of the 211,553 base sections have an index entry; the 1,987 units we added are searched directly | empty text: 1,819 garbled State sections |
| Smart search (meaning), Central | 41,578 of 41,600 sections (**99.9%**) | 22 complete sections without a vector |
| Smart search, State | 167,959 of 169,953 (**98.8%**) | 1,819 garbled and 175 others without a vector |
| Smart search, units we filled (Orders, Rules, Articles, Constitution, filled sections) | **1,987 of 1,987 (100%)** | none |
| Vectors | 76,701 Central + 462,198 State + 3,206 supplement passages | |
| Regulators (11,240 instruments, 89,698 sections) | titles only | not embedded, not searchable by text |
| Judgments (37,014 SC + 14.2M HC) | by party, title, case number | not embedded, not full-text searchable |
| Tribunal decisions | no | not loaded |

286 base sections replaced by our text and 11 State-filed copies hidden behind Central versions keep their old vectors in the database; they are ignored at query time (tested), so this is waste, not a leak.

**Hindi:** the keyword index and the Vault keyword ranker only look at Latin letters and digits, so Hindi words never match; the Acts search box says so. Smart search embeds Hindi text and queries, so it can work, but 3,065 State sections contain Devanagari (1,033 with Hindi pieces hidden and 1,798 not verifiable), only 10 Central sections do, and chat answers come from English sources only. Scanned Hindi documents are read and kept as printed (tested), and found by meaning, not by keyword. Impact: Medium (High for Hindi-belt practitioners). Fix: keyword index with a 'simple' configuration for Devanagari (free, small); Hindi Acts text from India Code (needs permission).

## 5. Top 20 fix list

Effort: S small, M medium, L large. Cost: free, paid, permission (India Code or a download only you can do). **Now ₹0** = can start today with what we hold.

| # | Fix | Effort | Cost | Now ₹0? |
|---:|---|---|---|---|
| 1 | Correct statuses: CrPC and the four duplicated labour Acts, hide repealed State-filed IPC/CrPC/Evidence copies, then verify the labour Acts replaced by the Codes | S | free | **Yes** |
| 2 | Judgment full text for the Supreme Court (37,014) from the dataset: store (R2) and keyword-search, embeddings later | L | free tier then paid | partly (storage free, embeddings paid) |
| 3 | Put High Court case lists and search live (export is on disk, 12 GB): host on R2 free tier or compress | M | free to small | **Yes**, once you create the R2 bucket |
| 4 | Fill the 103 stub Central Acts and the missing important ones (Customs Act 1962, Arms Act, Human Rights Act, SC/ST Act, Employees' Compensation, Trusts Act, Whistle Blowers) | M | permission | No (needs PDFs) |
| 5 | Add the 2025 Acts and amendments (Income-tax Act 2025, Waqf, Merchant Shipping, Ports, Banking Laws, Jan Vishwas, Online Gaming) | M | permission | No |
| 6 | CrPC and BNSS Schedules and forms; CPC Appendices (forms); Companies Act Schedules | M | permission | No |
| 7 | Fill the biggest open section gaps: IBC (218), Electricity (165), Army (156), Income-tax (104), Companies Act 2013 (60), PMLA (59) | M | permission | No |
| 8 | Reconcile the High Court holes: re-fetch the dropped years (Punjab and Haryana 2023, Allahabad 2024, Madhya Pradesh 2024, Gujarat 2023, Madras 2012, Delhi 2009) from the AWS Open Data copy | L | free (large download) | partly |
| 9 | Regulator text (RBI, SEBI, MCA, IRDAI first): load sections and make them searchable | L | free to small | partly (database limit) |
| 10 | Case-number, bench and judge fields for the Supreme Court and 22 High Courts (extract from the full text) | M | free once text is stored | No |
| 11 | Hindi keyword search (Devanagari full-text index) and Hindi chat sources | M | free | **Yes** (index) |
| 12 | State Acts: re-extract the 1,819 garbled and the worst of the 27,621 possibly incomplete sections from the State PDFs | L | permission | No |
| 13 | Add Law Commission reports (558) and State GST notifications (354) to the regulator list | S | free | **Yes** (metadata) |
| 14 | Tribunal decisions: list the 15 forums by case first, then OCR the ~348,516 reasoned decisions | L | paid | metadata only |
| 15 | Embed the 22 Central and 175 State sections that have no vector | S | free | **Yes** |
| 16 | Constitution Appendices I to III | S | free | **Yes** |
| 17 | Chapter headings for the 20,462 Central and 121,201 State sections that show none (read them from the PDFs' contents lists) | M | permission | partly |
| 18 | Supreme Court reconciliation: why 37,014 versus the dataset's 34,954, and the low years (1982, 1997 to 1998, 2020, 2025) | S | free | **Yes** |
| 19 | Re-run the missing-number and wrong-text checker on all Central Acts after each fill and publish the numbers on the site | S | free | **Yes** |
| 20 | A refresh process: pull the next dataset version (v2026.09+) when Vaquill publishes it, so amendments flow in | M | free | No (needs their release) |

## Method notes and limits
- Counts are exact where they come from SQL or the dataset files; "expected sections" and "missing numbers" are heuristics (highest number held or cited, or a reference count for 17 well-known Acts) and are marked as such.
- The 170-Act list matches by title; I checked every "missing" by hand with a second search, but a few Acts may exist under unusual titles. The status verdicts in 1.4 use my own legal knowledge for the ones marked *to check*.
- Nothing was fetched from India Code or any blocked site. Nothing in the database or code was changed.


## Amendment markers and joined words in the text of laws (found in Phase 4, Oct 2026)

Seen in the section text shown beside an Ask answer (NI Act s.138, s.142 and others):

- **Amendment brackets with a footnote number:** `5[within thirty days]`, `4[a term which may be extended to two years]`, and a stray `[1] [( 1 )]` at the start of a section. The number points to a footnote line at the end of the section (`> 5. Subs. by ...`). The reading desk now drops the bracket and number from the text and shows a small superscript mark where the amended words end (`src/lib/chat/amend.mjs`). The stored text is unchanged.
- **Spaced brackets:** `( a )`, `( 1 )`. Shown as `(a)`, `(1)`.
- **Joined words from the copying:** `thecheque` (seen in NI s.138(a)). The reading desk splits `the` + a word only when that word also appears on its own in the same section. Other prefixes are not touched (they would split real words such as "another" or "offence"). Joined words elsewhere (not starting with "the") are NOT repaired; to find them, search section text for long lower-case runs that are not words (a dictionary pass would be needed).
- **Not fixed in the data**, only at display time. If India Code PDFs are loaded later the markers come with them.

## Sections found garbled or missing while writing the hard evaluation set (Oct 2026)

| Act and section | Problem | Where it is tracked |
|---|---|---|
| Transfer of Property Act s.106 and s.108 | contents-list text / mixed with sub-headings | PDF-DOWNLOAD-LIST row 42 |
| IT Act s.43 and s.66 | missing (66C and 66D present) | row 41 |
| Arbitration Act s.34 | Schedule text mixed in | row 43 |
| Dowry Prohibition Act s.4 | only footnote text | row 40 |
| Hindu Succession Act s.6 | missing | row 44 |
