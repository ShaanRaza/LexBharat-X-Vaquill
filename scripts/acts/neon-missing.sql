-- Section numbers we are confident are missing from an Act's data (rule: src/lib/acts/gaps.mjs). The Act page shows a "missing from our source data" notice for them.
DROP TABLE IF EXISTS act_missing_sections;
CREATE TABLE act_missing_sections (act_id text NOT NULL REFERENCES acts(act_id), number integer NOT NULL, PRIMARY KEY (act_id, number));
