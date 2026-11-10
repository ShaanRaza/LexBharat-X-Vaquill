# Search smoke test

Run against http://localhost:3100 on 2026-11-10 with `node --experimental-websocket scripts/judgments/qa-search-smoke.mjs`. **64 of 64 checks pass.**
HC targets are real records drawn from the exported pages with a fixed seed. "Garbage" rows must answer 200 with no results or 422 with a message, in under 5 s, as JSON.

| Group | Check | Query | Results | Result | Detail |
|---|---|---|---|---|---|
| SC | cross-year search finds the 1973 case | Kesavananda | 1 | PASS | 1973_INSC_91 |
| SC | in-year search | insurance (1990) | 2 | PASS | every result contains the word |
| SC | bad court parameter -> 422, no crash | search?court=bogus | - | PASS | HTTP 422 |
| SC | bad court parameter -> 422, no crash | list?court=bogus | - | PASS | HTTP 422 |
| HC | bad court parameter -> 422, no crash | search-hc?court=bogus | - | PASS | HTTP 422 |
| HC | Supreme Court slug on the HC endpoint -> 422 | search-hc?court=supreme-court-of-india | - | PASS | HTTP 422 |
| HC | party-name query finds nothing, Bombay | state of | 0 | PASS | High Courts are not searched by party name |
| HC | case number, Bombay (all years of the court) | 150/2016 | 67 | PASS | target found across all years |
| HC | case number, Bombay (2025 page) | 150/2016 | 2 | PASS | target found, every hit carries the number (from the title or as recorded) |
| HC | party-name query finds nothing, Delhi | state of | 0 | PASS | High Courts are not searched by party name |
| HC | case number, Delhi (all years of the court) | 2744/2019 | 3 | PASS | target found across all years |
| HC | case number, Delhi (2019 page) | 2744/2019 | 2 | PASS | target found, every hit carries the number (from the title or as recorded) |
| HC | party-name query finds nothing, Kerala | state of | 0 | PASS | High Courts are not searched by party name |
| HC | case number, Kerala (all years of the court) | 119/2024 | 12 | PASS | target found across all years |
| HC | case number, Kerala (2024 page) | 119/2024 | 12 | PASS | target found, every hit carries the number (from the title or as recorded) |
| HC | party-name query finds nothing, Madras | state of | 0 | PASS | High Courts are not searched by party name |
| HC | case number, Madras (all years of the court) | 10790/2021 | 4 | PASS | target found across all years |
| HC | case number, Madras (2021 page) | 10790/2021 | 4 | PASS | target found, every hit carries the number (from the title or as recorded) |
| Year page SC | common word | state (1990) | 120 | PASS |  |
| Year page SC | case number (from the judgment heading) | 5491/2024 (2024) | 1 | PASS | Muskan Enterprises 2024_INSC_1046 |
| Year page SC | literal year string on a 2025 page | 2024 (2025) | 48 | PASS | every hit holds 2024 in its case number or citation |
| Year page HC | a word finds nothing (no party-name search) | state (Bombay 2025) | 0 | PASS |  |
| Year page HC | case number | 933/2024 (Bombay 2025) | 3 | PASS | WP/933/2024 is listed on the 2025 page |
| Year page HC | literal year string on a 2025 page | 2024 (Bombay 2025) | 10635 | PASS | every hit is numbered x/2024 and listed under 2025 |
| Toggle | HC: this year vs all years | 933/2024 (Bombay) | 3 -> 14 | PASS |  |
| Toggle | SC: this year vs all years | kesavananda (1990 vs all) | 0 -> 1 | PASS |  |
| Links | result links land on the right case page | 10 links (SC and HC) | 10/10 | PASS |  |
| Garbage | empty string -> SC search | "" | - | PASS | HTTP 422, 14 ms, q must be 2 to 200 characters. |
| Garbage | empty string -> SC year list | "" | 401 | PASS | HTTP 200, 22 ms |
| Garbage | empty string -> HC search | "" | - | PASS | HTTP 422, 13 ms, q must be 2 to 200 characters. |
| Garbage | random characters -> SC search | "xqzjwvkp" | 0 | PASS | HTTP 200, 443 ms |
| Garbage | random characters -> SC year list | "xqzjwvkp" | 0 | PASS | HTTP 200, 14 ms |
| Garbage | random characters -> HC search | "xqzjwvkp" | 0 | PASS | HTTP 200, 10 ms |
| Garbage | special characters -> SC search | "<>%$&" | 0 | PASS | HTTP 200, 10 ms |
| Garbage | special characters -> SC year list | "<>%$&" | 0 | PASS | HTTP 200, 10 ms |
| Garbage | special characters -> HC search | "<>%$&" | 0 | PASS | HTTP 200, 9 ms |
| Garbage | percent and null bytes -> SC search | "%00%0a%25" | 0 | PASS | HTTP 200, 16 ms |
| Garbage | percent and null bytes -> SC year list | "%00%0a%25" | 0 | PASS | HTTP 200, 9 ms |
| Garbage | percent and null bytes -> HC search | "%00%0a%25" | 0 | PASS | HTTP 200, 10 ms |
| Garbage | quote and SQL -> SC search | "'; DROP TABLE cases;--" | 0 | PASS | HTTP 200, 17 ms |
| Garbage | quote and SQL -> SC year list | "'; DROP TABLE cases;--" | 0 | PASS | HTTP 200, 11 ms |
| Garbage | quote and SQL -> HC search | "'; DROP TABLE cases;--" | 0 | PASS | HTTP 200, 9 ms |
| Garbage | very long input (1,000 chars) -> SC search | "kumar kumar kumar kuma"… | - | PASS | HTTP 422, 10 ms, q must be 2 to 200 characters. |
| Garbage | very long input (1,000 chars) -> SC year list | "kumar kumar kumar kuma"… | - | PASS | HTTP 422, 9 ms, search must be 2 to 200 characters. |
| Garbage | very long input (1,000 chars) -> HC search | "kumar kumar kumar kuma"… | - | PASS | HTTP 422, 9 ms, q must be 2 to 200 characters. |
| Garbage | non-Latin characters -> SC search | "名前★" | 0 | PASS | HTTP 200, 9 ms |
| Garbage | non-Latin characters -> SC year list | "名前★" | 0 | PASS | HTTP 200, 10 ms |
| Garbage | non-Latin characters -> HC search | "名前★" | 0 | PASS | HTTP 200, 8 ms |
| Garbage | single character -> SC search | "a" | - | PASS | HTTP 422, 10 ms, q must be 2 to 200 characters. |
| Garbage | single character -> SC year list | "a" | - | PASS | HTTP 422, 8 ms, search must be 2 to 200 characters. |
| Garbage | single character -> HC search | "a" | - | PASS | HTTP 422, 14 ms, q must be 2 to 200 characters. |
| Garbage | accented letters fold, not split | ñandú vs nandu | SC 6/6, HC 0/0 | PASS | same results with and without accents |
| Page SC | year page has the search bar | ?year=1990 | - | PASS |  |
| Page SC | in-year search on the page | insurance | 2 | PASS | 2 case records in 1990 match |
| Page SC | this year / all years toggle | insurance | 2 -> 526 | PASS | 526 cases match “insurance” across all years of Supreme Court of India |
| Page SC | Kesavananda across years from a 1990 page | kesavananda (all years) | 1 | PASS | /workspace/browse/judgments/supreme-court-of-india/1973/1973_INSC_91?p=1&lp=1&ya=1 |
| Page HC | "2024" on the Bombay 2025 page | 2024 | 10637 | PASS | 10,637 cases match “2024” in 2025 \| first: CIVIL APPEAL 2695 of 2024  14 Nov 2025 Case no. 2695 of 2024 · 1 page  |
| Page HC | this year / all years toggle | 933/2024 | 3 -> 14 | PASS | 14 cases match “933/2024” across all years of Bombay High Court |
| Page SC | court page (year grid) has the same search bar | kesavananda | - | PASS |  |
| Page HC | court page (year grid) has the same search bar | 933/2024 | - | PASS |  |
| Page garbage | special characters in the browse search bar | <>%$& | - | PASS | graceful empty state, no error alert |
| Page garbage | random characters in the browse search bar | xqzjwvkp | - | PASS | graceful empty state, no error alert |
| Page garbage | 600-character paste in the search bar | kumar kumar ... | 200 | PASS | input clamps at 200 characters, no error |
| Pages | no uncaught script errors during the page checks | - | 0 | PASS |  |
