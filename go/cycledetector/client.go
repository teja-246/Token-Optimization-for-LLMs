package cycledetector

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/teja-246/Token-Optimization-for-LLMs/go/gen/cycle"
)

// Action constants mirror the proto action string values.
const (
	ActionPass      = "PASS"
	ActionRemediate = "REMEDIATE"
)

// CheckResult is the Go-side representation of a CheckCycle response.
type CheckResult struct {
	Detected bool
	Length   int32
	Action   string // ActionPass | ActionRemediate
}

// RemediateResult is the Go-side representation of a Remediate response.
type RemediateResult struct {
	Diagnosis        string
	SearchContext    string
	CorrectedPrompt  string
	RecommendedModel string
	Escalated        bool
}

// Client is the Go gRPC client for the Python CycleService.
type Client struct {
	conn   *grpc.ClientConn
	client pb.CycleServiceClient

	// checkTimeout: CheckCycle runs on every turn — must be fast.
	checkTimeout time.Duration

	// remediateTimeout: Remediate does a web search — allow more time,
	// but still bounded so a slow search doesn't hang the response forever.
	remediateTimeout time.Duration
}

// NewClient dials the Python ML gRPC server.
// addr e.g. "localhost:50051" or "python-ml:50051".
func NewClient(addr string) (*Client, error) {
	conn, err := grpc.NewClient(
		addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("cycledetector: dial %s: %w", addr, err)
	}
	return &Client{
		conn:             conn,
		client:           pb.NewCycleServiceClient(conn),
		checkTimeout:     500 * time.Millisecond,
		remediateTimeout: 12 * time.Second, // web search can take a few seconds
	}, nil
}

func (c *Client) Close() error {
	return c.conn.Close()
}

// CheckCycle embeds the response and checks the session graph for a loop.
//
// On any error (timeout, service down), returns a PASS result so the
// gateway proceeds normally — a broken cycle detector must never block
// a response from reaching the user.
func (c *Client) CheckCycle(ctx context.Context, sessionID, response, requestID string) CheckResult {
	cCtx, cancel := context.WithTimeout(ctx, c.checkTimeout)
	defer cancel()

	resp, err := c.client.CheckCycle(cCtx, &pb.CycleRequest{
		SessionId: sessionID,
		Response:  response,
		RequestId: requestID,
	})
	if err != nil {
		fmt.Printf("[cycle] CheckCycle error (request_id=%s): %v — degrading to PASS\n", requestID, err)
		return CheckResult{Detected: false, Length: 0, Action: ActionPass}
	}

	return CheckResult{
		Detected: resp.CycleDetected,
		Length:   resp.CycleLength,
		Action:   resp.Action,
	}
}

// Remediate requests a diagnosis, web-search context, corrected prompt,
// and model recommendation for a detected loop.
//
// On any error, returns a fallback result that recommends retrying with
// the same model and a generic diagnosis — the gateway can still attempt
// a retry rather than failing the whole request.
func (c *Client) Remediate(
	ctx context.Context,
	sessionID, originalPrompt, loopingResponse string,
	cycleLength int32,
	currentModel, requestID string,
) RemediateResult {

	rCtx, cancel := context.WithTimeout(ctx, c.remediateTimeout)
	defer cancel()

	resp, err := c.client.Remediate(rCtx, &pb.RemediateRequest{
		SessionId:       sessionID,
		OriginalPrompt:  originalPrompt,
		LoopingResponse: loopingResponse,
		CycleLength:     cycleLength,
		CurrentModel:    currentModel,
		RequestId:       requestID,
	})
	if err != nil {
		fmt.Printf("[cycle] Remediate error (request_id=%s): %v — using fallback\n", requestID, err)
		return RemediateResult{
			Diagnosis: "A loop was detected, but the remediation service is " +
				"currently unavailable. Retrying with the same model.",
			SearchContext:    "",
			CorrectedPrompt:  originalPrompt,
			RecommendedModel: currentModel,
			Escalated:        false,
		}
	}

	return RemediateResult{
		Diagnosis:        resp.Diagnosis,
		SearchContext:    resp.SearchContext,
		CorrectedPrompt:  resp.CorrectedPrompt,
		RecommendedModel: resp.RecommendedModel,
		Escalated:        resp.Escalated,
	}
}