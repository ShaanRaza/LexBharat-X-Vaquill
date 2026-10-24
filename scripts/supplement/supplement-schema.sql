-- Sections filled in by hand from content/supplement/ (W7). NEVER touches the open-india-law rows in act_sections: it adds a separate table and a read-only VIEW
-- (act_sections_v) that the app reads instead of act_sections. The view = every open-india-law row, except rows a supplement says it REPLACES (wrong text) and the same-numbered rows of State-filed copies of that Act, plus the supplement rows.
-- Run by scripts/supplement/load-supplement.mjs on every load (idempotent). Statements are separated by "-- @@" lines. scripts/acts/neon-schema.sql drops the view before a re-load of the Acts.
CREATE TABLE IF NOT EXISTS act_sections_supplement (
  act_id      text NOT NULL,                 -- no foreign key on purpose: re-loading the Acts must not fail or erase this table
  number      text NOT NULL,                 -- 28, 11A
  section_key text NOT NULL,                 -- same shape as the dataset's keys: s028
  ord         integer NOT NULL,              -- reading order (the replaced section's, or the previous section's)
  heading     text,
  body        text NOT NULL,
  replaces    boolean NOT NULL DEFAULT false,
  source      text NOT NULL,                 -- "India Code"
  source_url  text NOT NULL,
  copied_on   date NOT NULL,                 -- the date the person copied the text
  file_name   text NOT NULL,
  file_hash   text NOT NULL,
  loaded_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (act_id, number)
);
-- @@
-- State-filed copies of a Central Act (same title, e.g. the Code of Civil Procedure filed under Chhattisgarh): filled by the loader. A copy's section is hidden wherever the Central Act has a filled section
-- with the same number, so the copy's (often wrong or garbled) text can never show up next to, or above, the Central filled version.
CREATE TABLE IF NOT EXISTS act_copy_of (
  copy_id    text PRIMARY KEY,
  central_id text NOT NULL
);
-- @@
CREATE OR REPLACE VIEW act_sections_v AS
SELECT s.act_id, s.section_key, s.ord, s.number, s.heading, s.chapter, s.status, s.flags, s.chunk_count, s.body, s.tsv
FROM act_sections s
WHERE NOT EXISTS (SELECT 1 FROM act_sections_supplement x WHERE x.act_id = s.act_id AND x.replaces AND upper(x.number) = upper(s.number))
  AND NOT EXISTS (SELECT 1 FROM act_copy_of c JOIN act_sections_supplement x ON x.act_id = c.central_id WHERE c.copy_id = s.act_id AND upper(x.number) = upper(s.number))
UNION ALL
SELECT x.act_id, x.section_key, x.ord, x.number, x.heading, NULL::text, 'complete'::text, ARRAY['supplement']::text[], 1, x.body,
       setweight(to_tsvector('english', coalesce(x.heading, '')), 'A') || setweight(to_tsvector('english', left(x.body, 600000)), 'B')
FROM act_sections_supplement x
