package analytics

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/segmentio/kafka-go"
)

type KafkaProducer struct {
	writer *kafka.Writer
	topic  string
}

func NewKafkaProducer(broker string) (*KafkaProducer, error) {

	writer := &kafka.Writer{
		Addr: kafka.TCP(broker),

		Topic: "request-analytics",

		Balancer: &kafka.LeastBytes{},

		BatchTimeout: 10 * time.Millisecond,
	}

	return &KafkaProducer{
		writer: writer,
		topic:  "request-analytics",
	}, nil
}
func (k *KafkaProducer) Publish(event RequestLog) {

	payload, err := json.Marshal(event)

	if err != nil {
		log.Printf("[KAFKA] marshal failed: %v", err)
		return
	}

	err = k.writer.WriteMessages(
		context.Background(),

		kafka.Message{
			Value: payload,
		},
	)

	if err != nil {

		log.Printf(
			"[KAFKA] publish failed: %v",
			err,
		)

		return
	}

	log.Printf(
		"[KAFKA] published analytics event request_id=%s",
		event.RequestID,
	)
}