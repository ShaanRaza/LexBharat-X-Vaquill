#!/usr/bin/env node
// W10 item 9: keyword index for Hindi (Devanagari) text that the site SHOWS. Only sections whose shown body contains Devanagari and that are not garbled (garbled text is never loaded, so never indexed).
// Table act_sections_hi (act_id, section_key) with a word-array index (GIN on text[]): the Postgres parsers split Devanagari words at vowel signs, so words are cut here instead; no stemming, exact word forms. Re-run after every Acts reload. usage: node scripts/w10/hindi-index.mjs
import { q } from "./env.mjs";
await q(`DROP TABLE IF EXISTS act_sections_hi`);
await q(`CREATE TABLE act_sections_hi (act_id text NOT NULL, section_key text NOT NULL, words text[] NOT NULL, PRIMARY KEY (act_id, section_key))`);
await q(`INSERT INTO act_sections_hi SELECT act_id, section_key, ARRAY(SELECT DISTINCT w FROM unnest(regexp_split_to_array(lower(left(body, 600000)), '[^[:alnum:]\u0900-\u097F]+')) AS w WHERE w <> '') FROM act_sections WHERE status <> 'garbled' AND body ~ '[\u0900-\u097F]'`);
await q(`INSERT INTO act_sections_hi SELECT act_id, section_key, ARRAY(SELECT DISTINCT w FROM unnest(regexp_split_to_array(lower(left(body, 600000)), '[^[:alnum:]\u0900-\u097F]+')) AS w WHERE w <> '') FROM act_sections_supplement WHERE body ~ '[\u0900-\u097F]' ON CONFLICT DO NOTHING`);
await q(`CREATE INDEX act_sections_hi_fts ON act_sections_hi USING GIN (words)`);
console.log((await q(`SELECT count(*)::int n, pg_size_pretty(pg_total_relation_size('act_sections_hi')) size FROM act_sections_hi`))[0]);
