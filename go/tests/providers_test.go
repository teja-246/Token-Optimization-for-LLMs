package tests

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/teja-246/Token-Optimization-for-LLMs/go/providers"
	"github.com/teja-246/Token-Optimization-for-LLMs/go/session"
)

// ── Groq provider tests ───────────────────────────────────────────────────────
// These tests make real API calls. They are skipped automatically if
// GROQ_API_KEY is not set, so CI passes without credentials.

func TestGroqProvider_StreamsTokens(t *testing.T) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		t.Skip("GROQ_API_KEY not set — skipping live provider test")
	}

	p := providers.NewGroqProvider(apiKey)

	req := providers.CompletionRequest{
		Messages: []providers.Message{
			{Role: providers.RoleUser, Content: "Reply with exactly one word: hello"},
		},
		Model:     providers.ModelFast,
		MaxTokens: 10,
		RequestID: "test-req-001",
		SessionID: "test-session-001",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	ch, err := p.Complete(ctx, req)
	if err != nil {
		t.Fatalf("Complete() returned error: %v", err)
	}

	var tokens []providers.Token
	for tok := range ch {
		tokens = append(tokens, tok)
		if tok.IsFinal {
			break
		}
	}

	if len(tokens) == 0 {
		t.Fatal("expected at least one token, got none")
	}

	final := tokens[len(tokens)-1]
	if !final.IsFinal {
		t.Error("last token: IsFinal should be true")
	}
	if final.Err != nil {
		t.Errorf("last token: unexpected error: %v", final.Err)
	}
	if final.Usage == nil {
		t.Error("last token: Usage should be populated")
	} else {
		if final.Usage.OutputTokens == 0 {
			t.Error("Usage.OutputTokens should be > 0")
		}
		if final.Usage.LatencyMs == 0 {
			t.Error("Usage.LatencyMs should be > 0")
		}
	}
}

func TestGroqProvider_RespectsContextCancellation(t *testing.T) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		t.Skip("GROQ_API_KEY not set")
	}

	p := providers.NewGroqProvider(apiKey)
	req := providers.CompletionRequest{
		Messages: []providers.Message{
			{Role: providers.RoleUser, Content: "Count from 1 to 1000 slowly"},
		},
		Model:     providers.ModelFast,
		MaxTokens: 2000,
		RequestID: "test-cancel-001",
		SessionID: "test-session-cancel",
	}

	// cancel almost immediately
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	ch, err := p.Complete(ctx, req)
	if err != nil {
		t.Fatalf("Complete() error: %v", err)
	}

	// drain channel — should terminate quickly due to cancellation
	var finalToken providers.Token
	for tok := range ch {
		finalToken = tok
	}

	// the channel must be closed — we should have received a final token
	if !finalToken.IsFinal {
		t.Error("expected a final token after cancellation")
	}
}

func TestGroqProvider_MultiTurnConversation(t *testing.T) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		t.Skip("GROQ_API_KEY not set")
	}

	p := providers.NewGroqProvider(apiKey)

	// turn 1: establish a fact in context
	turn1 := providers.CompletionRequest{
		Messages: []providers.Message{
			{Role: providers.RoleUser, Content: "My name is Teja. Just say 'Got it, Teja.'"},
		},
		Model:     providers.ModelFast,
		MaxTokens: 20,
		RequestID: "test-multi-001",
		SessionID: "test-multi-session",
	}

	ctx := context.Background()
	ch1, _ := p.Complete(ctx, turn1)
	var resp1 string
	for tok := range ch1 {
		if !tok.IsFinal {
			resp1 += tok.Text
		}
	}

	// turn 2: include history — model should remember the name
	turn2 := providers.CompletionRequest{
		Messages: []providers.Message{
			{Role: providers.RoleUser, Content: "My name is Teja. Just say 'Got it, Teja.'"},
			{Role: providers.RoleAssistant, Content: resp1},
			{Role: providers.RoleUser, Content: "What is my name? One word answer."},
		},
		Model:     providers.ModelFast,
		MaxTokens: 10,
		RequestID: "test-multi-002",
		SessionID: "test-multi-session",
	}

	ch2, _ := p.Complete(ctx, turn2)
	var resp2 string
	for tok := range ch2 {
		if !tok.IsFinal {
			resp2 += tok.Text
		}
	}

	// the model should have said "Teja" — context was passed correctly
	t.Logf("Turn 1 response: %q", resp1)
	t.Logf("Turn 2 response: %q", resp2)
}

// ── Selector tests ────────────────────────────────────────────────────────────
// Pure unit tests — no API calls, always run.

func TestClassifyPrompt_ClassA(t *testing.T) {
	simplePrompts := []string{"Hi!", "Hello there", "Thanks", "Ok", "Yes please"}
	for _, p := range simplePrompts {
		got := providers.ClassifyPrompt(p)
		if got != providers.ClassA {
			t.Errorf("ClassifyPrompt(%q) = %v, want ClassA", p, got)
		}
	}
}

func TestClassifyPrompt_ClassB(t *testing.T) {
	prompts := []string{
		"Write a Python function to reverse a string",
		"Explain what a goroutine is",
		"What is the difference between a stack and a queue",
	}
	for _, p := range prompts {
		got := providers.ClassifyPrompt(p)
		if got != providers.ClassB && got != providers.ClassC {
			t.Errorf("ClassifyPrompt(%q) = %v, want ClassB or ClassC", p, got)
		}
	}
}

func TestClassifyPrompt_ClassC(t *testing.T) {
	complexPrompts := []string{
		"Design a distributed database architecture for a global payments system",
		"Compare the tradeoffs between event sourcing and CRUD architecture",
		"How would you implement a scalable microservice mesh",
	}
	for _, p := range complexPrompts {
		got := providers.ClassifyPrompt(p)
		if got != providers.ClassC {
			t.Errorf("ClassifyPrompt(%q) = %v, want ClassC", p, got)
		}
	}
}

func TestSelectModel_MapsCorrectly(t *testing.T) {
	if got := providers.SelectModel(providers.ClassA); got != providers.ModelFast {
		t.Errorf("ClassA → %v, want %v", got, providers.ModelFast)
	}
	if got := providers.SelectModel(providers.ClassB); got != providers.ModelPowerful {
		t.Errorf("ClassB → %v, want %v", got, providers.ModelPowerful)
	}
	if got := providers.SelectModel(providers.ClassC); got != providers.ModelPowerful {
		t.Errorf("ClassC → %v, want %v", got, providers.ModelPowerful)
	}
}

// ── Session store tests ───────────────────────────────────────────────────────
// These require a running Redis. Skipped if REDIS_URL is not set.

func TestSessionStore_AppendAndRetrieve(t *testing.T) {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Skipf("invalid REDIS_URL: %v", err)
	}
	rdb := redis.NewClient(opt)
	ctx := context.Background()

	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Skipf("Redis not available: %v", err)
	}

	store := session.NewStore(rdb)
	sessionID := "test-session-store-" + time.Now().Format("150405")
	defer store.Clear(ctx, sessionID)

	msgs := []providers.Message{
		{Role: providers.RoleUser, Content: "What is Go?"},
		{Role: providers.RoleAssistant, Content: "Go is a compiled language by Google."},
		{Role: providers.RoleUser, Content: "Is it fast?"},
	}

	for _, m := range msgs {
		if err := store.Append(ctx, sessionID, m); err != nil {
			t.Fatalf("Append() error: %v", err)
		}
	}

	history, err := store.GetHistory(ctx, sessionID)
	if err != nil {
		t.Fatalf("GetHistory() error: %v", err)
	}
	if len(history) != len(msgs) {
		t.Fatalf("GetHistory() returned %d messages, want %d", len(history), len(msgs))
	}
	for i, got := range history {
		if got.Role != msgs[i].Role || got.Content != msgs[i].Content {
			t.Errorf("message[%d] = {%v %q}, want {%v %q}",
				i, got.Role, got.Content, msgs[i].Role, msgs[i].Content)
		}
	}
}

func TestSessionStore_EmptySessionReturnsEmpty(t *testing.T) {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}
	opt, _ := redis.ParseURL(redisURL)
	rdb := redis.NewClient(opt)
	ctx := context.Background()

	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Skipf("Redis not available: %v", err)
	}

	store := session.NewStore(rdb)
	history, err := store.GetHistory(ctx, "session-that-does-not-exist")
	if err != nil {
		t.Fatalf("GetHistory() on missing session should not error, got: %v", err)
	}
	if len(history) != 0 {
		t.Errorf("expected empty history, got %d messages", len(history))
	}
}