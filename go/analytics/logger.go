package analytics

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Logger struct {
	db     *pgxpool.Pool
	kafka   *KafkaProducer
	events chan RequestLog
}

func NewLogger(
	db *pgxpool.Pool,
	kafka *KafkaProducer,
) *Logger {

	logger := &Logger{
		db:     db,
		kafka:  kafka,
		events: make(chan RequestLog, 1000),
	}

	go logger.startWorker()

	return logger
}
func (l *Logger) Log(event RequestLog) {

	select {

	case l.events <- event:
		// queued successfully

	default:
		// queue full → drop event
		log.Printf(
			"[WARN] analytics queue full, dropping request_id=%s",
			event.RequestID,
		)
	}
}
func (l *Logger) startWorker() {

	for event := range l.events {

		err := l.insertRequestLog(event)

		if err != nil {
			log.Printf(
				"[ERROR] analytics insert failed: %v",
				err,
			)
		}
		l.kafka.Publish(event)
	}
}
func (l *Logger) insertRequestLog(event RequestLog) error {

	query := `
	INSERT INTO request_logs (
		request_id,
		user_id,
		model,
		input_tokens,
		output_tokens,
		latency_ms,
		cache_hit,
		cycle_detected,
		cost_usd
	)
	VALUES (
		$1,$2,$3,$4,$5,$6,$7,$8,$9
	)
	`

	_, err := l.db.Exec(
		context.Background(),
		query,

		event.RequestID,
		event.UserID,
		event.Model,

		event.InputTokens,
		event.OutputTokens,

		event.LatencyMs,

		event.CacheHit,
		event.CycleDetected,

		event.CostUSD,
	)

	if err != nil {
		return fmt.Errorf("insert request_log: %w", err)
	}

	return nil
}