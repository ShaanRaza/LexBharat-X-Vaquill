-- Chat storage (main Neon database). Small on purpose: titles, messages, citation METADATA (no section text, no embeddings), and a per-day usage counter for the limits.
CREATE TABLE IF NOT EXISTS chats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  browser_id  text NOT NULL,                       -- the anonymous browser id (cookie lb_bid)
  title       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chats_browser_idx ON chats (browser_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS chat_messages (
  id            bigserial PRIMARY KEY,
  chat_id       uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('user', 'assistant')),
  content       text NOT NULL,
  citations     jsonb,                             -- [{n, actId, sectionKey, actTitle, number, heading, status}] for assistant messages
  check_result  jsonb,                             -- {label: supported|partial|check, unsupported: [..]}
  model         text,                              -- provider:model that wrote the answer
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_chat_idx ON chat_messages (chat_id, id);
CREATE TABLE IF NOT EXISTS chat_usage (
  browser_id  text NOT NULL,
  day         date NOT NULL,                       -- India time
  count       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (browser_id, day)
);
