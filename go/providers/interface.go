package providers

import "context"

// Role represents who sent a message in a conversation.
type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
)

// Message is the provider-agnostic message format.
// All provider adapters translate to/from this type at their own boundary.
// The session store always works with this type — never with provider-specific types.
type Message struct {
	Role    Role   `json:"role"`
	Content string `json:"content"`
}

// CompletionRequest is the normalized request sent to any LLM provider.
// Contains the full conversation history, not just the latest prompt —
// this is what makes context work correctly across turns.
type CompletionRequest struct {
	Messages  []Message // full conversation history (oldest → newest)
	Model     string    // e.g. "llama-3.1-8b-instant"
	MaxTokens int       // hard ceiling; 0 = use provider default
	StopSeqs  []string  // optional stop sequences
	RequestID string    // injected by gateway middleware, for tracing
	SessionID string    // identifies the conversation thread
}

// Token is a single streamed token from the LLM.
// Tokens arrive on a channel one at a time.
type Token struct {
	Text    string // the token text; empty on final token
	IsFinal bool   // true on the last token — channel closes after this
	Usage   *Usage // only populated when IsFinal == true
	Err     error  // non-nil if the stream encountered an error
}

// Usage holds token consumption stats for a completed LLM call.
type Usage struct {
	InputTokens  int
	OutputTokens int
	LatencyMs    int64
}

// LLMProvider is the interface every provider adapter must satisfy.
// Currently only Groq implements this. The interface exists so future
// providers (or test mocks) can be swapped in without touching the handler.
type LLMProvider interface {
	// Complete sends the request to the LLM and returns a channel of tokens.
	// Tokens stream in real time. The channel is closed after the final token
	// (IsFinal == true) is sent. Callers must drain the channel fully.
	Complete(ctx context.Context, req CompletionRequest) (<-chan Token, error)

	// Name returns a short identifier for logging (e.g. "groq").
	Name() string
}