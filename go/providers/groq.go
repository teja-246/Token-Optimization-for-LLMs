package providers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"
	openai "github.com/sashabaranov/go-openai"
)

const groqBaseURL = "https://api.groq.com/openai/v1"

// GroqProvider implements LLMProvider using Groq's OpenAI-compatible API.
// Groq is completely free — get your key at console.groq.com.
// It uses the same request/response format as OpenAI, so the go-openai
// SDK works by simply pointing its base URL at Groq instead.
type GroqProvider struct {
	client *openai.Client
}

// NewGroqProvider constructs a GroqProvider.
// GROQ_API_KEY is your Groq API key (starts with "gsk_").
func NewGroqProvider(GROQ_API_KEY string) *GroqProvider {
	cfg := openai.DefaultConfig(GROQ_API_KEY)
	cfg.BaseURL = groqBaseURL
	return &GroqProvider{
		client: openai.NewClientWithConfig(cfg),
	}
}

func (g *GroqProvider) Name() string {
	return "groq"
}

// Complete sends the request to Groq and returns a channel of streaming tokens.
//
// The caller receives tokens one by one as Groq produces them.
// The final token has IsFinal=true and Usage populated.
// The channel is always closed — callers do not need to handle closure explicitly.
//
// Context cancellation (e.g. client disconnect) is respected:
// the goroutine detects ctx.Done() and sends a final error token before closing.
func (g *GroqProvider) Complete(ctx context.Context, req CompletionRequest) (<-chan Token, error) {
	// translate internal messages → openai format
	msgs := make([]openai.ChatCompletionMessage, len(req.Messages))
	for i, m := range req.Messages {
		msgs[i] = openai.ChatCompletionMessage{
			Role:    string(m.Role),
			Content: m.Content,
		}
	}

	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 1024
	}

	openaiReq := openai.ChatCompletionRequest{
		Model:     req.Model,
		Messages:  msgs,
		MaxTokens: maxTokens,
		Stream:    true,
	}
	if len(req.StopSeqs) > 0 {
		openaiReq.Stop = req.StopSeqs
	}

	stream, err := g.client.CreateChatCompletionStream(ctx, openaiReq)
	if err != nil {
		return nil, fmt.Errorf("groq: create stream: %w", err)
	}

	tokenCh := make(chan Token, 64) // buffered — producer never blocks on slow consumer
	startTime := time.Now()

	go func() {
		defer close(tokenCh)
		defer stream.Close()

		var inputTokens, outputTokens int

		for {
			// respect context cancellation (e.g. client disconnected)
			select {
			case <-ctx.Done():
				tokenCh <- Token{
					IsFinal: true,
					Err:     fmt.Errorf("request cancelled: %w", ctx.Err()),
				}
				return
			default:
			}

			chunk, err := stream.Recv()

			if errors.Is(err, io.EOF) {
				// clean end of stream
				tokenCh <- Token{
					IsFinal: true,
					Usage: &Usage{
						InputTokens:  inputTokens,
						OutputTokens: outputTokens,
						LatencyMs:    time.Since(startTime).Milliseconds(),
					},
				}
				return
			}

			if err != nil {
				tokenCh <- Token{
					IsFinal: true,
					Err:     fmt.Errorf("groq stream error: %w", err),
				}
				return
			}

			// Groq sends usage data in the last non-empty chunk
			if chunk.Usage != nil{

				if chunk.Usage.TotalTokens > 0 {
					inputTokens = chunk.Usage.PromptTokens
					outputTokens = chunk.Usage.CompletionTokens
				}
			}

			if len(chunk.Choices) == 0 {
				continue
			}

			delta := chunk.Choices[0].Delta
			text := delta.Content
			if text != "" {
				tokenCh <- Token{Text: text}
			}
		}
	}()

	return tokenCh, nil
}