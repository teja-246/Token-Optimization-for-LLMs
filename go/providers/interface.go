package providers

import "context"

type LLMProvider interface {
	Complete(
		ctx context.Context,
		req CompletionRequest,
	) (<-chan Token, error) // stream tokens asynchronously
}

type CompletionRequest struct {
	Prompt    string
	Model     string
	RequestID string
	MaxTokens int
	StopSeqs  []string
}

type Token struct {
	Text    string
	IsFinal bool
	Usage   *Usage
}

type Usage struct {
	InputTokens  int
	OutputTokens int
	LatencyMs    int64
}