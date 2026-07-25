package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AnalyticsHandler serves read-only dashboard data from PostgreSQL.
// All queries are scoped to the last 24 hours by default.
type AnalyticsHandler struct {
	db *pgxpool.Pool
}

func NewAnalyticsHandler(db *pgxpool.Pool) *AnalyticsHandler {
	return &AnalyticsHandler{db: db}
}

// ── GET /analytics/summary ────────────────────────────────────────────────────
// Aggregate stats for the last 24 hours — feeds the four summary cards.

func (h *AnalyticsHandler) Summary(c *gin.Context) {
	row := h.db.QueryRow(c.Request.Context(), `
		SELECT
			COUNT(*)                                                          AS total_requests,
			COALESCE(SUM(CASE WHEN cache_hit         THEN 1 ELSE 0 END), 0) AS cache_hits,
			COALESCE(SUM(CASE WHEN cycle_detected    THEN 1 ELSE 0 END), 0) AS cycles_detected,
			COALESCE(SUM(CASE WHEN remediation_applied THEN 1 ELSE 0 END),0) AS remediations,
			COALESCE(ROUND(AVG(latency_ms)::NUMERIC, 0), 0)                 AS avg_latency_ms,
			COALESCE(SUM(input_tokens),    0)                               AS total_input_tokens,
			COALESCE(SUM(output_tokens),   0)                               AS total_output_tokens,
			COALESCE(SUM(original_tokens), 0)                               AS total_original_tokens,
			COALESCE(SUM(pruned_tokens),   0)                               AS total_pruned_tokens
		FROM request_logs
		WHERE created_at > NOW() - INTERVAL '24 hours'
	`)

	var (
		totalRequests       int64
		cacheHits           int64
		cyclesDetected      int64
		remediations        int64
		avgLatencyMs        int64
		totalInputTokens    int64
		totalOutputTokens   int64
		totalOriginalTokens int64
		totalPrunedTokens   int64
	)

	if err := row.Scan(
		&totalRequests, &cacheHits, &cyclesDetected, &remediations,
		&avgLatencyMs, &totalInputTokens, &totalOutputTokens,
		&totalOriginalTokens, &totalPrunedTokens,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	cacheHitRate := 0.0
	if totalRequests > 0 {
		cacheHitRate = float64(cacheHits) / float64(totalRequests) * 100
	}

	tokensSaved := totalOriginalTokens - totalPrunedTokens
	if tokensSaved < 0 {
		tokensSaved = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"total_requests":        totalRequests,
		"cache_hits":            cacheHits,
		"cache_hit_rate":        cacheHitRate,
		"cycles_detected":       cyclesDetected,
		"remediations_applied":  remediations,
		"avg_latency_ms":        avgLatencyMs,
		"total_input_tokens":    totalInputTokens,
		"total_output_tokens":   totalOutputTokens,
		"tokens_saved_pruning":  tokensSaved,
		"window":                "24h",
	})
}

// ── GET /analytics/timeseries ─────────────────────────────────────────────────
// Hourly data for the last 24 hours — feeds the cache hit rate and latency charts.

func (h *AnalyticsHandler) Timeseries(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT
			date_trunc('hour', created_at)                                    AS hour,
			COUNT(*)                                                          AS total,
			COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END), 0)         AS hits,
			COALESCE(ROUND(AVG(latency_ms)::NUMERIC, 0), 0)                 AS avg_latency,
			COALESCE(SUM(original_tokens - pruned_tokens), 0)               AS tokens_saved
		FROM request_logs
		WHERE created_at > NOW() - INTERVAL '24 hours'
		GROUP BY hour
		ORDER BY hour ASC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type point struct {
		Hour        string  `json:"hour"`
		Total       int64   `json:"total"`
		Hits        int64   `json:"hits"`
		HitRate     float64 `json:"hit_rate"`
		AvgLatency  int64   `json:"avg_latency_ms"`
		TokensSaved int64   `json:"tokens_saved"`
	}

	var points []point
	for rows.Next() {
		var p point
		var hourStr string
		if err := rows.Scan(&hourStr, &p.Total, &p.Hits, &p.AvgLatency, &p.TokensSaved); err != nil {
			continue
		}
		p.Hour = hourStr
		if p.Total > 0 {
			p.HitRate = float64(p.Hits) / float64(p.Total) * 100
		}
		points = append(points, p)
	}

	if points == nil {
		points = []point{}
	}

	c.JSON(http.StatusOK, gin.H{"data": points})
}

// ── GET /analytics/models ─────────────────────────────────────────────────────
// Model usage breakdown — feeds the model usage pie chart.

func (h *AnalyticsHandler) Models(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT
			model,
			COUNT(*)                                                      AS requests,
			COALESCE(SUM(input_tokens + output_tokens), 0)               AS total_tokens,
			COALESCE(ROUND(AVG(latency_ms)::NUMERIC, 0), 0)             AS avg_latency
		FROM request_logs
		WHERE created_at > NOW() - INTERVAL '24 hours'
		GROUP BY model
		ORDER BY requests DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type modelStat struct {
		Model       string `json:"model"`
		Requests    int64  `json:"requests"`
		TotalTokens int64  `json:"total_tokens"`
		AvgLatency  int64  `json:"avg_latency_ms"`
	}

	var stats []modelStat
	for rows.Next() {
		var s modelStat
		if err := rows.Scan(&s.Model, &s.Requests, &s.TotalTokens, &s.AvgLatency); err != nil {
			continue
		}
		stats = append(stats, s)
	}

	if stats == nil {
		stats = []modelStat{}
	}

	c.JSON(http.StatusOK, gin.H{"data": stats})
}

// ── GET /analytics/requests ───────────────────────────────────────────────────
// Most recent 50 requests — feeds the recent requests table.

func (h *AnalyticsHandler) Requests(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT
			request_id,
			user_id,
			model,
			input_tokens,
			output_tokens,
			latency_ms,
			cache_hit,
			cycle_detected,
			remediation_applied,
			original_tokens,
			pruned_tokens,
			created_at
		FROM request_logs
		ORDER BY created_at DESC
		LIMIT 50
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type reqRow struct {
		RequestID          string `json:"request_id"`
		UserID             string `json:"user_id"`
		Model              string `json:"model"`
		InputTokens        int    `json:"input_tokens"`
		OutputTokens       int    `json:"output_tokens"`
		LatencyMs          int64  `json:"latency_ms"`
		CacheHit           bool   `json:"cache_hit"`
		CycleDetected      bool   `json:"cycle_detected"`
		RemediationApplied bool   `json:"remediation_applied"`
		OriginalTokens     int    `json:"original_tokens"`
		PrunedTokens       int    `json:"pruned_tokens"`
		CreatedAt          string `json:"created_at"`
	}

	var reqs []reqRow
	for rows.Next() {
		var r reqRow
		if err := rows.Scan(
			&r.RequestID, &r.UserID, &r.Model,
			&r.InputTokens, &r.OutputTokens, &r.LatencyMs,
			&r.CacheHit, &r.CycleDetected, &r.RemediationApplied,
			&r.OriginalTokens, &r.PrunedTokens, &r.CreatedAt,
		); err != nil {
			continue
		}
		reqs = append(reqs, r)
	}

	if reqs == nil {
		reqs = []reqRow{}
	}

	c.JSON(http.StatusOK, gin.H{"data": reqs})
}

// ── GET /analytics/cycles ─────────────────────────────────────────────────────
// Most recent cycle detection events — feeds the cycle alerts panel.

func (h *AnalyticsHandler) Cycles(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT
			request_id,
			user_id,
			model,
			remediation_applied,
			created_at
		FROM request_logs
		WHERE cycle_detected = TRUE
		ORDER BY created_at DESC
		LIMIT 20
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type cycleRow struct {
		RequestID          string `json:"request_id"`
		UserID             string `json:"user_id"`
		Model              string `json:"model"`
		RemediationApplied bool   `json:"remediation_applied"`
		CreatedAt          string `json:"created_at"`
	}

	var cycles []cycleRow
	for rows.Next() {
		var r cycleRow
		if err := rows.Scan(
			&r.RequestID, &r.UserID, &r.Model,
			&r.RemediationApplied, &r.CreatedAt,
		); err != nil {
			continue
		}
		cycles = append(cycles, r)
	}

	if cycles == nil {
		cycles = []cycleRow{}
	}

	c.JSON(http.StatusOK, gin.H{"data": cycles})
}