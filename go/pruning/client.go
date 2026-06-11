package pruning

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/teja-246/Token-Optimization-for-LLMs/go/providers"
	pb "github.com/teja-246/Token-Optimization-for-LLMs/go/gen/pruning"
)

// PruneResult holds the output of a pruning call.
type PruneResult struct {
	PrunedPrompt     string
	PrunedHistory    []providers.Message
	OriginalTokens   int32
	PrunedTokens     int32
	CompressionRatio float32
}

// Client is the Go gRPC client for the Python PruningService.
type Client struct {
	conn    *grpc.ClientConn
	client  pb.PruningServiceClient
	timeout time.Duration
}

// NewClient dials the Python ML gRPC server.
// addr e.g. "localhost:50051" or "python-ml:50051".
func NewClient(addr string) (*Client, error) {
	conn, err := grpc.NewClient(
		addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("pruning: dial %s: %w", addr, err)
	}
	return &Client{
		conn:    conn,
		client:  pb.NewPruningServiceClient(conn),
		timeout: 800 * time.Millisecond, // pruning must be fast — it's on the hot path
	}, nil
}

func (c *Client) Close() error {
	return c.conn.Close()
}

// Prune sends the prompt and conversation history to the Python pruning service.
//
// On any error (timeout, service down, etc.) it returns the original prompt
// and history unchanged so the gateway degrades gracefully.
// Pruning failure must never break an inference request.
func (c *Client) Prune(
	ctx context.Context,
	prompt string,
	history []providers.Message,
	requestID string,
) PruneResult {

	pCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	// convert providers.Message → proto ConvMessage
	protoHistory := make([]*pb.ConvMessage, len(history))
	for i, m := range history {
		protoHistory[i] = &pb.ConvMessage{
			Role:    string(m.Role),
			Content: m.Content,
		}
	}

	resp, err := c.client.Prune(pCtx, &pb.PruneRequest{
		Prompt:    prompt,
		History:   protoHistory,
		RequestId: requestID,
	})

	if err != nil {
		fmt.Printf("[pruning] Prune error (request_id=%s): %v — using original\n", requestID, err)
		return PruneResult{
			PrunedPrompt:     prompt,
			PrunedHistory:    history,
			OriginalTokens:   0,
			PrunedTokens:     0,
			CompressionRatio: 1.0,
		}
	}

	// convert proto ConvMessages → providers.Message
	prunedHistory := make([]providers.Message, len(resp.PrunedHistory))
	for i, m := range resp.PrunedHistory {
		prunedHistory[i] = providers.Message{
			Role:    providers.Role(m.Role),
			Content: m.Content,
		}
	}

	return PruneResult{
		PrunedPrompt:     resp.PrunedPrompt,
		PrunedHistory:    prunedHistory,
		OriginalTokens:   resp.OriginalTokens,
		PrunedTokens:     resp.PrunedTokens,
		CompressionRatio: resp.CompressionRatio,
	}
}