"use client";
import { useState } from "react";
import HcSearchResults from "./HcSearchResults";
import ScSearchResults from "./ScSearchResults";
import SearchField from "./SearchField";

// The search bar on a court's own page (above its year grid): all years of that court, with the same bar and the same results as the browse page and the year lists.
export default function CourtSearch({ court, courtName, isSupreme }: { court: string; courtName: string; isSupreme: boolean }) {
  const [q, setQ] = useState(""), term = q.trim();
  return (
    <div className="mt-5">
      <SearchField id="court-q" value={q} onChange={setQ} label={`Search ${courtName}, all years`}
        placeholder={isSupreme ? "Try a party name, a title word, a citation or a case number like 5491/2024" : "Try a petitioner or respondent name, a case number like 933/2024, or a year"} />
      <p className="mt-2 text-[13px] text-[#535151]">{isSupreme ? "Searches the title (both parties), citation and case number from the judgment heading, in every year, newest first. Not judgment text." : "Searches party names, case numbers and case years as recorded in the dataset, in every year of this court, newest first. Not judgment text."}</p>
      {term.length >= 2 && (isSupreme ? <ScSearchResults q={term} /> : <HcSearchResults q={term} court={court} />)}
    </div>
  );
}
