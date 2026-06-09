package analytics

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPostgresPool(databaseURL string) (*pgxpool.Pool, error) {

	pool, err := pgxpool.New(
		context.Background(),
		databaseURL,
	)

	if err != nil {
		return nil, fmt.Errorf("pgxpool: %w", err)
	}

	err = pool.Ping(context.Background())

	if err != nil {
		return nil, fmt.Errorf("postgres ping: %w", err)
	}

	return pool, nil
}