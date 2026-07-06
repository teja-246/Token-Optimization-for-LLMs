-- +goose Up
CREATE TABLE IF NOT EXISTS request_logs (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id     TEXT        NOT NULL,
    user_id        TEXT,
    model          TEXT,
    input_tokens   INT         DEFAULT 0,
    output_tokens  INT         DEFAULT 0,
    latency_ms     BIGINT      DEFAULT 0,
    cache_hit      BOOLEAN     DEFAULT FALSE,
    cycle_detected BOOLEAN     DEFAULT FALSE,
    cost_usd       NUMERIC(10,6) DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_logs_request_id  ON request_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id     ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at  ON request_logs(created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS request_logs;