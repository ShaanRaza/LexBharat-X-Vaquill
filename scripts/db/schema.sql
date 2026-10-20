-- Target Postgres schema for the later AWS move (RDS/Aurora Postgres). NOT used today: Phase 1-3 serve bundled JSON through the ActsStore/JudgmentsStore
-- interfaces. A Postgres store implements the same interfaces, so routes and UI do not change. Load from the processed exports in src/data/ (never from the raw SSD).

CREATE TABLE acts (
  act_id         text PRIMARY KEY,                 -- ActItem.actId
  title          text NOT NULL,
  year           integer,                          -- NULL when the dataset has none
  category       text NOT NULL CHECK (category IN ('central','state','regulatory')),
  state          text,                             -- slug, e.g. west-bengal
  department     text,                             -- regulators only, slug e.g. sebi
  act_number     text,                             -- derived from title "N of YYYY", often NULL
  act_status     text NOT NULL CHECK (act_status IN ('in_force','repealed','superseded','spent')),
  enactment_date date,                             -- no source field today; stays NULL
  citation       text NOT NULL,                    -- constructed (= title)
  section_count  integer NOT NULL DEFAULT 0,       -- 0 = not countable from the data
  title_tsv      tsvector GENERATED ALWAYS AS (to_tsvector('simple', title)) STORED
);
CREATE INDEX acts_filter_idx ON acts (category, act_status, year DESC);
CREATE INDEX acts_state_idx  ON acts (state) WHERE state IS NOT NULL;
CREATE INDEX acts_title_fts  ON acts USING gin (title_tsv);
CREATE INDEX acts_title_trgm ON acts USING gin (title gin_trgm_ops);   -- needs: CREATE EXTENSION pg_trgm;

CREATE TABLE court_years (
  court text NOT NULL, year integer NOT NULL, cases bigint NOT NULL, PRIMARY KEY (court, year)   -- distinct case_id
);

CREATE TABLE sc_cases (
  case_id text PRIMARY KEY, year integer NOT NULL, title text NOT NULL, citation text, disposition text, decision_date date,
  petitioner text, respondent text, case_number text, bench_strength integer, judges text[]
);
CREATE INDEX sc_cases_year_idx ON sc_cases (year, decision_date);

-- Future, only after chunk ordering is validated: act_sections(act_id, section_number, ord, title, text). Deliberately not created yet.
