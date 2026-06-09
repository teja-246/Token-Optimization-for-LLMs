package analytics

import "time"

type RequestLog struct {
	RequestID      string
	UserID         string

	Model          string

	InputTokens    int
	OutputTokens   int

	LatencyMs      int64

	CacheHit       bool
	CycleDetected  bool

	CostUSD        float64

	CreatedAt      time.Time
}