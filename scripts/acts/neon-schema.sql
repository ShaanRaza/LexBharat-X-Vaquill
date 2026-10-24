-- Section search schema (Neon Postgres). Loaded by scripts/acts/load-neon.sh from ../lexbharat-data/acts-text. Central and State/UT Acts only.
-- FTS config: 'english' (see docs/ACTS-SEARCH-W1B.md): stemming (dishonour / dishonoured, cheque / cheques) and stop-word removal shrink the index; the text is English
-- legal prose (Hindi pieces are not loaded). Headings weigh more (A) than the body (B).
DROP VIEW IF EXISTS act_sections_v;   -- the hand-filled sections view (scripts/supplement); recreated by `npm run load:supplement`
DROP TABLE IF EXISTS act_missing_sections;
DROP TABLE IF EXISTS act_sections;
DROP TABLE IF EXISTS acts;
CREATE TABLE acts (
  act_id        text PRIMARY KEY,
  title         text NOT NULL,
  year          integer,
  category      text NOT NULL,          -- central | state
  state         text,
  act_status    text NOT NULL,
  source_url    text,
  section_count integer NOT NULL,
  raw_category  text,                   -- the dataset's own value; `category` may be corrected by scripts/acts/fix-misfiled-central.mjs (run after every load)
  raw_state     text,
  category_note text,
  title_tsv     tsvector GENERATED ALWAYS AS (to_tsvector('english', title)) STORED
);
CREATE TABLE act_sections (
  act_id      text NOT NULL REFERENCES acts(act_id),
  section_key text NOT NULL,            -- s138, s11A, b004 (blocks)
  ord         integer NOT NULL,         -- reading order inside the Act
  number      text,                     -- as shown: 138, 11A (null for unnumbered blocks)
  heading     text,                     -- cleaned, null when unreliable
  chapter     text,                     -- only when it passed the chapter checks
  status      text NOT NULL,            -- complete | possibly_incomplete | garbled
  flags       text[] NOT NULL,
  chunk_count integer NOT NULL,
  body        text,                     -- display text; NULL for garbled sections (their text is never loaded)
  tsv         tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('english', coalesce(heading, '')), 'A') ||
                setweight(to_tsvector('english', left(coalesce(body, ''), 600000)), 'B')
              ) STORED,
  PRIMARY KEY (act_id, section_key)
);
