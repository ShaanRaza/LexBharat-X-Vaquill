-- Regulator instruments (RBI, SEBI, MCA, ... plus Law Commission reports and tribunal-filed instruments): text for the Act page and keyword search.
-- Same shape as acts / act_sections (neon-schema.sql) under reg_ names, so it can live in the main database (small tests) or in its own free Neon project (REG_DATABASE_URL).
-- Space: no stored tsvector column; the GIN index is built on the expression (queries must use the same expression, see src/lib/acts/regSearch.ts).
CREATE TABLE IF NOT EXISTS reg_acts (
  act_id        text PRIMARY KEY,
  title         text NOT NULL,
  department    text NOT NULL,
  year          integer,
  act_status    text NOT NULL,
  source_url    text,
  section_count integer NOT NULL
);
CREATE TABLE IF NOT EXISTS reg_sections (
  act_id      text NOT NULL REFERENCES reg_acts(act_id),
  section_key text NOT NULL,
  ord         integer NOT NULL,
  number      text,
  heading     text,
  chapter     text,
  status      text NOT NULL,
  flags       text[] NOT NULL,
  chunk_count integer NOT NULL,
  body        text,
  PRIMARY KEY (act_id, section_key)
);
CREATE INDEX IF NOT EXISTS reg_sections_fts ON reg_sections USING GIN ((setweight(to_tsvector('english', coalesce(heading, '')), 'A') || setweight(to_tsvector('english', left(coalesce(body, ''), 600000)), 'B')));
CREATE INDEX IF NOT EXISTS reg_acts_dept ON reg_acts (department);
CREATE INDEX IF NOT EXISTS reg_acts_title_lower ON reg_acts (lower(title) text_pattern_ops);
