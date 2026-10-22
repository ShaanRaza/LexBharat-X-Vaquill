# Search smoke test

Run against http://localhost:3100 on 2026-10-22 with `node --experimental-websocket scripts/judgments/qa-search-smoke.mjs`. **64 of 64 checks pass.**
HC targets are real records drawn from the exported pages with a fixed seed. "Garbage" rows must answer 200 with no results or 422 with a message, in under 5 s, as JSON.

| Group | Check | Query | Results | Result | Detail |
|---|---|---|---|---|---|
| SC | cross-year search finds the 1973 case | Kesavananda | 1 | PASS | 1973_INSC_91 |
| SC | in-year search | insurance (1990) | 2 | PASS | every result contains the word |
| SC | bad court parameter -> 422, no crash | search?court=bogus | - | PASS | HTTP 422 |
| SC | bad court parameter -> 422, no crash | list?court=bogus | - | PASS | HTTP 422 |
| HC | bad court parameter -> 422, no crash | search-hc?court=bogus | - | PASS | HTTP 422 |
| HC | Supreme Court slug on the HC endpoint -> 422 | search-hc?court=supreme-court-of-india | - | PASS | HTTP 422 |
| HC | party name, Bombay (2025 page) | SANJAY VASANTRAO | 4 | PASS | target found, every hit holds the words |
| HC | party name, Bombay (all years of the court) | SANJAY VASANTRAO | 69 | PASS | all-years total is at least the single-year total |
| HC | case number, Bombay (2025 page) | 248/2006 | 1 | PASS | target found, every hit carries the number |
| HC | party name, Delhi (2019 page) | HITESH GABA | 2 | PASS | target found, every hit holds the words |
| HC | party name, Delhi (all years of the court) | HITESH GABA | 2 | PASS | all-years total is at least the single-year total |
| HC | case number, Delhi (2019 page) | 2723/2019 | 2 | PASS | target found, every hit carries the number |
| HC | party name, Kerala (2024 page) | JOHNY | 53 | PASS | target found, every hit holds the words |
| HC | party name, Kerala (all years of the court) | JOHNY | 1576 | PASS | all-years total is at least the single-year total |
| HC | case number, Kerala (2024 page) | 1998/2024 | 2 | PASS | target found, every hit carries the number |
| HC | party name, Madras (2021 page) | Sumayaa | 1 | PASS | target found, every hit holds the words |
| HC | party name, Madras (all years of the court) | Sumayaa | 1 | PASS | all-years total is at least the single-year total |
| HC | case number, Madras (2021 page) | 10794/2021 | 5 | PASS | target found, every hit carries the number |
| Year page SC | common word | state (1990) | 120 | PASS |  |
| Year page SC | case number (from the judgment heading) | 5491/2024 (2024) | 1 | PASS | Muskan Enterprises 2024_INSC_1046 |
| Year page SC | literal year string on a 2025 page | 2024 (2025) | 48 | PASS | every hit holds 2024 in its case number or citation |
| Year page HC | common word | state (Bombay 2025) | 22275 | PASS |  |
| Year page HC | case number | 933/2024 (Bombay 2025) | 3 | PASS | Gurukrupa Industries WP/933/2024 is listed on the 2025 page |
| Year page HC | literal year string on a 2025 page | 2024 (Bombay 2025) | 10637 | PASS | every hit is numbered x/2024 and listed under 2025 |
| Toggle | HC: this year vs all years | gurukrupa (Bombay) | 1 -> 93 | PASS |  |
| Toggle | SC: this year vs all years | kesavananda (1990 vs all) | 0 -> 1 | PASS |  |
| Links | result links land on the right case page | 10 links (SC and HC) | 10/10 | PASS |  |
| Garbage | empty string -> SC search | "" | - | PASS | HTTP 422, 1 ms, q must be 2 to 200 characters. |
| Garbage | empty string -> SC year list | "" | 401 | PASS | HTTP 200, 1 ms |
| Garbage | empty string -> HC search | "" | - | PASS | HTTP 422, 1 ms, q must be 2 to 200 characters. |
| Garbage | random characters -> SC search | "xqzjwvkp" | 0 | PASS | HTTP 200, 7 ms |
| Garbage | random characters -> SC year list | "xqzjwvkp" | 0 | PASS | HTTP 200, 3 ms |
| Garbage | random characters -> HC search | "xqzjwvkp" | 0 | PASS | HTTP 200, 4 ms |
| Garbage | special characters -> SC search | "<>%$&" | 0 | PASS | HTTP 200, 1 ms |
| Garbage | special characters -> SC year list | "<>%$&" | 0 | PASS | HTTP 200, 2 ms |
| Garbage | special characters -> HC search | "<>%$&" | 0 | PASS | HTTP 200, 0 ms |
| Garbage | percent and null bytes -> SC search | "%00%0a%25" | 0 | PASS | HTTP 200, 8 ms |
| Garbage | percent and null bytes -> SC year list | "%00%0a%25" | 0 | PASS | HTTP 200, 2 ms |
| Garbage | percent and null bytes -> HC search | "%00%0a%25" | 0 | PASS | HTTP 200, 1 ms |
| Garbage | quote and SQL -> SC search | "'; DROP TABLE cases;--" | 0 | PASS | HTTP 200, 8 ms |
| Garbage | quote and SQL -> SC year list | "'; DROP TABLE cases;--" | 0 | PASS | HTTP 200, 1 ms |
| Garbage | quote and SQL -> HC search | "'; DROP TABLE cases;--" | 0 | PASS | HTTP 200, 13 ms |
| Garbage | very long input (1,000 chars) -> SC search | "kumar kumar kumar kuma"… | - | PASS | HTTP 422, 2 ms, q must be 2 to 200 characters. |
| Garbage | very long input (1,000 chars) -> SC year list | "kumar kumar kumar kuma"… | - | PASS | HTTP 422, 2 ms, search must be 2 to 200 characters. |
| Garbage | very long input (1,000 chars) -> HC search | "kumar kumar kumar kuma"… | - | PASS | HTTP 422, 1 ms, q must be 2 to 200 characters. |
| Garbage | non-Latin characters -> SC search | "名前★" | 0 | PASS | HTTP 200, 1 ms |
| Garbage | non-Latin characters -> SC year list | "名前★" | 0 | PASS | HTTP 200, 2 ms |
| Garbage | non-Latin characters -> HC search | "名前★" | 0 | PASS | HTTP 200, 1 ms |
| Garbage | single character -> SC search | "a" | - | PASS | HTTP 422, 1 ms, q must be 2 to 200 characters. |
| Garbage | single character -> SC year list | "a" | - | PASS | HTTP 422, 0 ms, search must be 2 to 200 characters. |
| Garbage | single character -> HC search | "a" | - | PASS | HTTP 422, 1 ms, q must be 2 to 200 characters. |
| Garbage | accented letters fold, not split | ñandú vs nandu | SC 6/6, HC 4369/4369 | PASS | same results with and without accents |
| Page SC | year page has the search bar | ?year=1990 | - | PASS |  |
| Page SC | in-year search on the page | insurance | 2 | PASS | 2 case records in 1990 match |
| Page SC | this year / all years toggle | insurance | 2 -> 526 | PASS | 526 cases match “insurance” across all years of Supreme Court of India |
| Page SC | Kesavananda across years from a 1990 page | kesavananda (all years) | 1 | PASS | /workspace/browse/judgments/supreme-court-of-india/1973/1973_INSC_91?p=1&lp=1 |
| Page HC | "2024" on the Bombay 2025 page | 2024 | 10637 | PASS | 10,637 cases match “2024” in 2025 \| first: CIVIL APPEAL 2695 of 2024  ANITA WAMAN JAGTAP v. THE STATE OF MAHARASH |
| Page HC | this year / all years toggle | gurukrupa | 1 -> 93 | PASS | 93 cases match “gurukrupa” across all years of Bombay High Court |
| Page SC | court page (year grid) has the same search bar | kesavananda | - | PASS |  |
| Page HC | court page (year grid) has the same search bar | gurukrupa | - | PASS |  |
| Page garbage | special characters in the browse search bar | <>%$& | - | PASS | graceful empty state, no error alert |
| Page garbage | random characters in the browse search bar | xqzjwvkp | - | PASS | graceful empty state, no error alert |
| Page garbage | 600-character paste in the search bar | kumar kumar ... | 200 | PASS | input clamps at 200 characters, no error |
| Pages | no uncaught script errors during the page checks | - | 0 | PASS |  |
