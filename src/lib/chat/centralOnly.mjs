// A question that names a central Act ("the Indian Penal Code") is about that Act. A state or UT copy that has the same name (the Madhya Pradesh "Indian Penal Code") is a different text:
// it is never cited in the central Act's place, and nothing from it is shown, unless the question names that state. PURE logic.
import { shortActName } from "../docs/docType.mjs";

/** Short names (lower case) of the central Acts a lookup matched: [{ category, actTitle }] -> Set. */
export const centralNames = (acts) => new Set(acts.filter((a) => a && a.category === "central" && a.actTitle).map((a) => shortActName(a.actTitle).toLowerCase()));

/** Hits without the state/UT copies of the named central Acts. `names` is a Set from centralNames; `statePicked` is true when the question names a state (nothing is dropped then). */
export const withoutStateCopies = (hits, names, statePicked = false) => (!names.size || statePicked ? hits : hits.filter((h) => h.category === "central" || !names.has(shortActName(h.actTitle).toLowerCase())));
