-- +goose Up
ALTER TABLE request_logs
  ADD COLUMN IF NOT EXISTS remediation_applied BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS original_tokens     INT         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pruned_tokens       INT         DEFAULT 0;

-- +goose Down
ALTER TABLE request_logs
  DROP COLUMN IF EXISTS remediation_applied,
  DROP COLUMN IF EXISTS original_tokens,
  DROP COLUMN IF EXISTS pruned_tokens;