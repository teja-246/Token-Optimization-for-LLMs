-- +goose Up
CREATE TABLE IF NOT EXISTS token_metrics (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    window_start    TIMESTAMPTZ NOT NULL,
    total_requests  INT         DEFAULT 0,
    cache_hits      INT         DEFAULT 0,
    tokens_saved    INT         DEFAULT 0,
    cost_saved_usd  NUMERIC(10,4) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS token_metrics;