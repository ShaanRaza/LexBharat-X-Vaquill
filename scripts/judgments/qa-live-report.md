# Supreme Court case pages: live spot check

Site: https://lexbharat-bay.vercel.app on 2026-10-21. Browser: headless Google Chrome over the DevTools protocol (Playwright is not installed in this project). Sample seed 7. **28 of 30 pages passed.**
Checks per page: HTTP 200; heading; the record's citation (or the "No citation recorded" note); no undefined / NaN / null / [object Object]; no empty value cells; provenance panel with its field rows; the stored extracted bench and case number are shown; the back link returns to the year's case list. Screenshots of failures: `qa/screenshots/live/<caseId>.jpg`.

| Result | Case | Year | Group | Title | Citation | HTTP | Problems |
|---|---|---|---|---|---|---|---|
| PASS | 1951_INSC_17 | 1951 | QA flag (sweep failure or reviewed flag) | SREE SREE ISWAR GOPAL JIEU THAKUR  ver | [1951] 1 S.C.R. 332 | 200 |  |
| PASS | 1993_INSC_118 | 1993 | Edge case: no disposition recorded | HINDUSTAN PAPER CORPN. LTD. ETC. ETC.  | [1993] 2 S.C.R. 655 | 200 |  |
| PASS | 2024_INSC_86 | 2024 | Edge case: no authoring judge | JAGMOHAN AND ANOTHER versus BADRI NATH | [2024] 2 S.C.R. 123 | 200 |  |
| PASS | 2018_INSC_277 | 2018 | Edge case: no bench and no case number, modern | SATPAL SINGH versus THE STATE OF PUNJA | [2018] 3 S.C.R. 739 | 200 |  |
| PASS | 1998_INSC_396 | 1998 | Edge case: bench but no case number | STATE OF MAHARASHTRA versus VITHALRAO  | [1998] SUPP. 2 S.C.R. 323 | 200 |  |
| PASS | 1958_INSC_112 | 1958 | 1950-1999 | SETH BADRI PRASAD AND OTHERS versus SE | [1959] SUPP. 1 S.C.R. 769 | 200 |  |
| PASS | 1996_INSC_1086 | 1996 | 1950-1999 | THE STATE OF KARNATAKA AND ANR. versus | [1996] SUPP. 6 S.C.R. 607 | 200 |  |
| PASS | 1975_INSC_257 | 1975 | 1950-1999 | HIND OVERSEAS PRIVATE LIMITED versus R | [1976] 2 S.C.R. 226 | 200 |  |
| PASS | 1959_INSC_50 | 1959 | 1950-1999 | DOLGOBINDA PARICHA versus NIMAI CHARAN | [1959] SUPP. 2 S.C.R. 814 | 200 |  |
| PASS | 1960_INSC_138 | 1960 | 1950-1999 | THE STATE OF BOMBAY versus PAHSHOTTAM  | [1961] 1 S.C.R. 458 | 200 |  |
| PASS | 2009_INSC_1184 | 2009 | 2000-2009 | INDIAN HUME PIPE CO. LTD. versus STATE | [2009] 15 S.C.R. 254 | 200 |  |
| PASS | 2009_INSC_1086 | 2009 | 2000-2009 | SUCHITA SRIVASTAVA & ANR. versus CHAND | [2009] 13 S.C.R. 989 | 200 |  |
| PASS | 2006_INSC_726 | 2006 | 2000-2009 | SURESH PATHRELLA versus ORIENTAL BANK  | [2006] SUPP. 7 S.C.R. 564 | 200 |  |
| PASS | 2006_INSC_5 | 2006 | 2000-2009 | STATE OF BIHAR AND ORS. versus PROJECT | [2006] 1 S.C.R. 14 | 200 |  |
| PASS | 2006_INSC_874 | 2006 | 2000-2009 | KALYAN SINGH versus STATE OF MADHYA PR | [2006] SUPP. 9 S.C.R. 249 | 200 |  |
| PASS | 2019_INSC_795 | 2019 | 2010-2025 | SRI A.M.C.S. SWAMY ADE/DPE/HYD (CENTRA | [2019] 9 S.C.R. 695 | 200 |  |
| PASS | 2022_INSC_472 | 2022 | 2010-2025 | DELHI DEVELOPMENT AUTHORITY versus BHI | [2022] 2 S.C.R. 1164 | 200 |  |
| PASS | 2022_INSC_510 | 2022 | 2010-2025 | UNION OF INDIA & ORS. versus ASHISH AG | [2022] 3 S.C.R. 638 | 200 |  |
| FAIL | 2016_INSC_586 | 2016 | 2010-2025 | VIJAY KUMAR MISHRA AND ANR. versus HIG | [2016] 3 S.C.R. 806 | 200 | stored bench not shown (0/2): production data may be older than the repo; no 'Bench (from judgment text)' row |
| PASS | 2017_INSC_818 | 2017 | 2010-2025 | STATE OF GUJARAT AND ANOTHER versus TH | [2017] 11 S.C.R. 787 | 200 |  |
| PASS | 2023_INSC_272 | 2023 | 2010-2025 | SEEMANT KUMAR SINGH versus MAHESH PS & | [2023] 3 S.C.R. 587 | 200 |  |
| PASS | 2015_INSC_494 | 2015 | 2010-2025 | KIRPAL KAUR versus JITENDER PAL SINGH  | [2015] 8 S.C.R. 51 | 200 |  |
| PASS | 2017_INSC_989 | 2017 | 2010-2025 | PANKAJBHAI RAMESHBHAI ZALAVADIYA versu | [2017] 12 S.C.R. 1028 | 200 |  |
| PASS | 2011_INSC_218 | 2011 | 2010-2025 | COMMERCIAL TAXES OFFICER versus M/S. J | [2011] 3 S.C.R. 951 | 200 |  |
| PASS | 2022_INSC_3 | 2022 | 2010-2025 | SMALL INDUSTRIES DEVELOPMENT BANK OF I | [2022] 1 S.C.R. 913 | 200 |  |
| PASS | 1973_INSC_91 | 1973 | Known: Kesavananda Bharati | HIS HOLINESS KESAVANANDA BHARATI SRIPA | [1973] SUPP. 1 S.C.R. 1 | 200 |  |
| PASS | 2024_INSC_1046 | 2024 | Known: Muskan Enterprises | MUSKAN ENTERPRISES & ANR. versus THE S | [2024] 12 S.C.R. 1273 | 200 |  |
| PASS | 2025_INSC_1184 | 2025 | Known: Nazim | NAZIM & ORS. versus THE STATE OF UTTAR | [2025] 10 S.C.R. 263 | 200 |  |
| PASS | 2022_INSC_326 | 2022 | Known: Vijay Kumar Ghai | VIJAY KUMAR GHAI & ORS. versus THE STA | [2022] 1 S.C.R. 884 | 200 |  |
| FAIL | 2025_INSC_1288 | 2025 | Known: Mihir Rajesh Shah | MIHIR RAJESH SHAH versus STATE OF MAHA | [2025] 11 S.C.R. 291 | 200 | stored bench not shown (1/2): production data may be older than the repo; no 'Bench (from judgment text)' row |
