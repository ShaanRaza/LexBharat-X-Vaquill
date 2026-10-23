-- Saved drafts (main Neon database). Small on purpose: the draft as editor JSON, the answers to the form, citation METADATA (no section text), a few version snapshots, and a per-day usage counter.
-- The email address a user types for "email me when it's ready" is NEVER stored.
CREATE TABLE IF NOT EXISTS drafts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  browser_id   text NOT NULL,
  title        text NOT NULL,
  template_id  text NOT NULL,
  fields       jsonb NOT NULL,                     -- the form answers
  extra        text,                               -- the user's extra instructions
  basis        jsonb NOT NULL DEFAULT '[]',        -- [{n, actId, sectionKey, actTitle, number, heading, status, relied, why}]
  checklist    jsonb NOT NULL DEFAULT '[]',        -- [{id, text}] reminders flagged "check"
  sections     jsonb NOT NULL DEFAULT '[]',        -- [{id, title, status: ok|failed, text}] as generated (the text is kept so a failed section can be retried in context)
  warnings     jsonb NOT NULL DEFAULT '{}',        -- {unverified: [..], amounts: [..]}
  doc          jsonb NOT NULL,                     -- the draft as editor JSON (the latest edit)
  model        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS drafts_browser_idx ON drafts (browser_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS draft_versions (
  id          bigserial PRIMARY KEY,
  draft_id    uuid NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  label       text NOT NULL,                       -- generated | checkpoint | saved | before-restore
  doc         jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS draft_versions_idx ON draft_versions (draft_id, id);
CREATE TABLE IF NOT EXISTS draft_usage (
  browser_id  text NOT NULL,
  day         date NOT NULL,                       -- India time
  count       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (browser_id, day)
);
