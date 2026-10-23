// Section counts of a few very well-known Central Acts, used ONLY to stop the missing-number check from overshooting (extra numbered text filed under an Act, such as
// amending Acts or schedules, can push the highest number we hold above the real last section). Written from general knowledge, NOT checked against India Code:
// confirm against India Code before filling any gap from it. PURE data + one helper.
export const KNOWN_SECTION_COUNTS = {
  "negotiable instruments act 1881": 148, "indian penal code 1860": 511, "indian evidence act 1872": 167, "code of criminal procedure 1973": 484,
  "code of civil procedure 1908": 158, "indian contract act 1872": 238, "limitation act 1963": 32, "transfer of property act 1882": 137,
  "arbitration and conciliation act 1996": 86, "specific relief act 1963": 44, "hindu marriage act 1955": 30, "hindu succession act 1956": 31,
  "motor vehicles act 1988": 217, "companies act 2013": 470, "information technology act 2000": 90, "sale of goods act 1930": 66,
  "narcotic drugs and psychotropic substances act 1985": 83,
};
/** "The Indian Contract Act, 1872, 9 of 1872 (Rep., ...)" -> "indian contract act 1872". */
export function titleKey(title) {
  const m = /^(.*?\b[12]\d{3})\b/.exec(String(title).replace(/\([^)]*\)/g, " ").replace(/\b(?:no\.?\s*)?\d{1,3}\s+of\s+(?=[12]\d{3}\b)/gi, " "));
  return (m ? m[1] : String(title)).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, "");
}
export const knownMaxFor = (title) => KNOWN_SECTION_COUNTS[titleKey(title)] ?? 0;
