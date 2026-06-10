package cache

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "aether/gen/cache"
)

// Tier constants mirror the proto tier string values.
// Use these in the handler rather than raw string comparisons.
const (
	TierHit      = "HIT"
	TierFewShot  = "FEW_SHOT"
	TierMiss     = "MISS"
)

// QueryResult is the Go-side representation of a cache lookup result.
type QueryResult struct {
	Tier       string  // "HIT" | "FEW_SHOT" | "MISS"
	Similarity float32 // cosine similarity [0, 1]
	Response   string  // populated for HIT and FEW_SHOT; empty for MISS
}

// Client is the Go gRPC client for the Python CacheService.
// It is safe for concurrent use — the underlying gRPC connection is thread-safe.
type Client struct {
	conn   *grpc.ClientConn
	client pb.CacheServiceClient

	// queryTimeout is the per-RPC deadline for Query calls.
	// Cache queries must be fast — if the Python service is slow we'd
	// rather degrade to MISS than add latency to the hot path.
	queryTimeout time.Duration

	// writeTimeout is the per-RPC deadline for Write calls.
	// Writes are fire-and-forget — a generous timeout is fine.
	writeTimeout time.Duration
}

// NewClient dials the Python ML gRPC server and returns a Client.
// addr should be "host:port", e.g. "localhost:50051" or "python-ml:50051".
//
// The connection is established lazily by gRPC — this call does not block
// waiting for the server to be available.
func NewClient(addr string) (*Client, error) {
	conn, err := grpc.NewClient(
		addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("cache: dial %s: %w", addr, err)
	}

	return &Client{
		conn:         conn,
		client:       pb.NewCacheServiceClient(conn),
		queryTimeout: 500 * time.Millisecond, // fail fast on cache query
		writeTimeout: 2 * time.Second,
	}, nil
}

// Close shuts down the gRPC connection. Call on application shutdown.
func (c *Client) Close() error {
	return c.conn.Close()
}

// Query checks the semantic cache for a similar prompt.
//
// If the Python service is unreachable or returns an error, Query returns
// a MISS result (not an error). This means the gateway always degrades
// gracefully — a down cache service never breaks inference.
func (c *Client) Query(ctx context.Context, prompt, sessionID, requestID string) QueryResult {
	qCtx, cancel := context.WithTimeout(ctx, c.queryTimeout)
	defer cancel()

	resp, err := c.client.Query(qCtx, &pb.CacheQueryRequest{
		Prompt:    prompt,
		SessionId: sessionID,
		RequestId: requestID,
	})
	if err != nil {
		// log but degrade gracefully — never block inference on a cache error
		fmt.Printf("[cache] Query error (request_id=%s): %v — degrading to MISS\n", requestID, err)
		return QueryResult{Tier: TierMiss, Similarity: 0, Response: ""}
	}

	return QueryResult{
		Tier:       resp.Tier,
		Similarity: resp.Similarity,
		Response:   resp.Response,
	}
}

// WriteAsync stores a prompt+response pair in the cache asynchronously.
//
// It fires and forgets — the goroutine runs independently of the request context.
// A fresh background context is used so the write isn't cancelled when the
// HTTP response finishes.
//
// This must only be called on the MISS path after a successful LLM response.
func (c *Client) WriteAsync(prompt, response, sessionID, requestID string) {
	go func() {
		wCtx, cancel := context.WithTimeout(context.Background(), c.writeTimeout)
		defer cancel()

		_, err := c.client.Write(wCtx, &pb.CacheWriteRequest{
			Prompt:    prompt,
			Response:  response,
			SessionId: sessionID,
			RequestId: requestID,
		})
		if err != nil {
			fmt.Printf("[cache] WriteAsync error (request_id=%s): %v\n", requestID, err)
		}
	}()
}