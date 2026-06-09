-- +goose Up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  request_id TEXT NOT NULL,
  user_id TEXT,

  model TEXT,

  input_tokens INT,
  output_tokens INT,

  latency_ms INT,

  cache_hit BOOLEAN DEFAULT FALSE,
  cycle_detected BOOLEAN DEFAULT FALSE,

  cost_usd NUMERIC(10,6),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE token_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  window_start TIMESTAMPTZ,

  total_requests INT,
  cache_hits INT,

  tokens_saved INT,

  cost_saved_usd NUMERIC(10,4)
);

-- +goose Down
DROP TABLE IF EXISTS token_metrics;
DROP TABLE IF EXISTS request_logs;