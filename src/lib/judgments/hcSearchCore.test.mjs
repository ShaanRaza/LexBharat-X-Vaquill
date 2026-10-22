// Unit tests for the High Court search core (tokenising, case-number keys, query planning). Run: npm run test:extract
import assert from "node:assert/strict";
import test from "node:test";
import { SHARDS, caseKeys, caseYears, planQuery, shardOf, tokenize } from "./hcSearchCore.mjs";

test("tokenize: whole words, accent-free, no stop words or case-type words, each once", () => {
  assert.deepEqual(tokenize("GURUKRUPA INDUSTRIES THROUGH SUNIL GHANSHAMDAS PANCH"), ["gurukrupa", "industries", "sunil", "ghanshamdas", "panch"]);
  assert.deepEqual(tokenize("State of U.P. and Another"), ["state"]);
  assert.deepEqual(tokenize("Writ Petition (Civil) of Kumar Kumar"), ["kumar"]);
  assert.deepEqual(tokenize("Jośeph Çelik"), ["joseph", "celik"]);
  assert.deepEqual(tokenize(""), []);
  assert.deepEqual(tokenize(null), []);
});

test("caseKeys: every way a number is written gives the same key; a type code with digits does not create false keys", () => {
  assert.deepEqual(caseKeys("933 of 2024"), ["#933/2024"]);
  assert.deepEqual(caseKeys("933/2024"), ["#933/2024"]);
  assert.deepEqual(caseKeys("24 of2020"), ["#24/2020"]);
  assert.deepEqual(caseKeys("WP/933/2024 of A Vs B"), ["#933/2024"]);
  assert.deepEqual(caseKeys("0933/2024"), ["#933/2024"]);
  assert.deepEqual(caseKeys("A482/42016/2023 of RACHIT CHAUHAN Vs STATE"), ["#42016/2023"]);   // regression: this used to also index #6/2023 and #482/4201
  assert.deepEqual(caseKeys("100453 of 2027"), ["#100453/2027"]);
  assert.deepEqual(caseKeys("933 of 2024", "WP/933/2024 of X"), ["#933/2024"]);                   // recorded number and title reference agree: one key
  assert.deepEqual(caseKeys("1742/9 of 2019"), ["#9/2019"]);
  assert.deepEqual(caseKeys("see 12 of 1066"), []);                                               // implausible year
});

test("planQuery: a case number and words are separated", () => {
  assert.deepEqual(planQuery("933/2024"), { keys: ["#933/2024"], words: [] });
  assert.deepEqual(planQuery("Rajesh Kumar"), { keys: [], words: ["rajesh", "kumar"] });
  assert.deepEqual(planQuery("state of up 12 of 2020"), { keys: ["#12/2020"], words: ["state", "up"] });
  assert.deepEqual(planQuery("of the"), { keys: [], words: [] });
});

test("shardOf: stable, in range, words sharing three letters share a shard", () => {
  assert.equal(shardOf("kumar"), shardOf("kumari"));
  assert.equal(shardOf("kumar"), shardOf("kum"));
  for (const t of ["a", "ab", "sharma", "#933/2024", "zz"]) assert.ok(shardOf(t) >= 0 && shardOf(t) < SHARDS);
  assert.equal(shardOf("sharma"), shardOf("sharma"));
});

test("years: a bare year is a query by itself (regression: '2024' on the Bombay 2025 page gave 0 because digits never reach the word index)", () => {
  assert.deepEqual(planQuery("2024"), { keys: ["@2024"], words: [] });
  assert.deepEqual(planQuery("kumar 2024"), { keys: ["@2024"], words: ["kumar"] });
  assert.deepEqual(planQuery("1999 and 2015"), { keys: ["@1999", "@2015"], words: [] });
  assert.deepEqual(planQuery("933/2024"), { keys: ["#933/2024"], words: [] });                  // a case number is one key, not a number plus a year
  assert.deepEqual(planQuery("12345"), { keys: [], words: [] });                                // other bare numbers are not indexed
  assert.deepEqual(planQuery("year 2400"), { keys: [], words: ["year"] });                      // not a plausible year
  assert.deepEqual(caseYears("933 of 2024", "WP/933/2024 of X", "1742/9 of 2019"), ["@2024", "@2019"]);
  assert.deepEqual(caseYears("A482/42016/2023 of X"), ["@2023"]);
  assert.deepEqual(caseYears(null, "no number here"), []);
  assert.equal(shardOf("@2024"), shardOf("@2024"));
  assert.ok(shardOf("@2024") >= 0 && shardOf("@2024") < SHARDS);
});
