package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/teja-246/Token-Optimization-for-LLMs/go/providers"
	"github.com/teja-246/Token-Optimization-for-LLMs/go/session"
	"github.com/teja-246/Token-Optimization-for-LLMs/go/analytics"
	"github.com/teja-246/Token-Optimization-for-LLMs/go/cache"
	"github.com/teja-246/Token-Optimization-for-LLMs/go/pruning"
)

// ChatRequest is the JSON body for POST /v1/chat.
type ChatRequest struct {
	Prompt    string `json:"prompt"     binding:"required"`
	SessionID string `json:"session_id"` // optional — auto-generated if empty
}

// Handler holds all injected dependencies for the gateway endpoints.
type Handler struct {
	provider providers.LLMProvider
	store    *session.Store
	logger *analytics.Logger
	cacheClient *cache.Client
	pruningClient *pruning.Client
}

func NewHandler(
	p providers.LLMProvider,
	s *session.Store,
	l *analytics.Logger,
	c *cache.Client,
	pr *pruning.Client,
) *Handler {

	return &Handler{
		provider: p,
		store:    s,
		logger:   l,
		cacheClient:    c,
		pruningClient: pr,
	}
}

// ── SSE event payloads ────────────────────────────────────────────────────────

type sseTokenEvent struct {
	Token string `json:"token"`
}

type sseFinalEvent struct {
	Done         bool   `json:"done"`
	Model        string `json:"model"`
	Class        string `json:"class"`
	SessionID    string `json:"session_id"`
	Cache        string  `json:"cache"`               // "HIT" | "FEW_SHOT" | "MISS"
	Similarity   float32 `json:"similarity,omitempty"` // non-zero on HIT/FEW_SHOT
	InputTokens  int    `json:"input_tokens"`
	OutputTokens int    `json:"output_tokens"`
	LatencyMs    int64  `json:"latency_ms"`
	OriginalTokens   int32   `json:"original_tokens"`   // before pruning
	PrunedTokens     int32   `json:"pruned_tokens"`     // after pruning
	CompressionRatio float32 `json:"compression_ratio"` // pruned/original
}

type sseErrorEvent struct {
	Error string `json:"error"`
}

// writeSSE formats and writes one SSE event to the response writer.
func writeSSE(w io.Writer, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		fmt.Fprintf(w, "data: {\"error\":\"marshal failed\"}\n\n")
		return
	}
	fmt.Fprintf(w, "data: %s\n\n", data)
}

// ── Chat handler ──────────────────────────────────────────────────────────────

// Chat handles POST /v1/chat.
//
// Flow:
//  1. Parse request, resolve or create session_id
//  2. Load conversation history from Redis
//  3. Append user message to history
//  4. Classify prompt → select model (placeholder for Feature 6 ML router)
//  5. Call Groq via the provider interface with the full history
//  6. Stream SSE tokens to the client
//  7. On final token, persist assistant response to Redis
func (h *Handler) Chat(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	// resolve session
	sessionID := strings.TrimSpace(req.SessionID)
	if sessionID == "" {
		sessionID = uuid.New().String()
	}

	// pull metadata injected by Feature 1 middleware
	requestID := c.GetString("request_id")
	userID := c.GetString("user_id")

	// load full conversation history from Redis
	history, err := h.store.GetHistory(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load session history"})
		return
	}

	// append the new user message to history
	userMsg := providers.Message{Role: providers.RoleUser, Content: req.Prompt}
	history = append(history, userMsg)

	if err := h.store.Append(c.Request.Context(), sessionID, userMsg); err != nil {
		// non-fatal — we still have history in-memory for this request
		fmt.Printf("[WARN] [%s] failed to persist user message: %v\n", requestID, err)
	}

	// Feature 5: prune prompt + history ──────────────────────────────────
	pruneResult := pruning.PruneResult{
		PrunedPrompt:     req.Prompt,
		PrunedHistory:    history,
		CompressionRatio: 1.0,
	}
	if h.pruningClient != nil {
		pruneResult = h.pruningClient.Prune(c.Request.Context(), req.Prompt, history, requestID)
	}
 
	prunedPrompt  := pruneResult.PrunedPrompt
	prunedHistory := pruneResult.PrunedHistory

	// ── Feature 4: semantic cache lookup ─────────────────────────────────────
	cacheResult := cache.QueryResult{Tier: cache.TierMiss}
	if h.cacheClient != nil {
		cacheResult = h.cacheClient.Query(c.Request.Context(), prunedPrompt, sessionID, requestID)
	}
 
	switch cacheResult.Tier {
 
	case cache.TierHit:
		// Return the cached response immediately — no LLM call
		h.streamCachedResponse(c, cacheResult, pruneResult, sessionID, requestID, userID)
		// still persist the assistant message to session history
		h.saveAssistantMessage(sessionID, requestID, cacheResult.Response)
		return
 
	case cache.TierFewShot:
		// Inject the similar cached response as a system-level hint.
		// The LLM sees it as context and can refine or confirm.
		hint := providers.Message{
			Role: providers.RoleSystem,
			Content: fmt.Sprintf(
				"A similar question was previously answered as follows — use this as context: %s",
				cacheResult.Response,
			),
		}
		// Prepend hint so it appears before the conversation history
		prunedHistory = append([]providers.Message{hint}, prunedHistory...)
 
	case cache.TierMiss:
		// proceed normally — nothing to inject
	}

	// classify prompt → select model
	// Feature 6 will replace ClassifyPrompt with a Python gRPC call
	class := providers.ClassifyPrompt(prunedPrompt)
	model := providers.SelectModel(class)

	// build the completion request with the full conversation history
	completionReq := providers.CompletionRequest{
		Messages:  prunedHistory, // pruned history only
		Model:     model,
		MaxTokens: 1024,
		RequestID: requestID,
		SessionID: sessionID,
	}

	// call the LLM provider
	tokenCh, err := h.provider.Complete(c.Request.Context(), completionReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "provider error: " + err.Error()})
		return
	}

	// set SSE response headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Request-ID", requestID)
	c.Header("X-Session-ID", sessionID)
	c.Header("X-Model", model)
	c.Header("X-Class", string(class))
	c.Header("X-Cache", cacheResult.Tier)
	c.Header("X-User-ID", userID)

	// accumulate the full response as tokens arrive
	var fullResponse strings.Builder

	// stream tokens to the client via SSE
	c.Stream(func(w io.Writer) bool {
		token, ok := <-tokenCh
		if !ok {
			// channel closed without a final token (shouldn't happen, but guard it)
			return false
		}

		if token.Err != nil {
			writeSSE(w, sseErrorEvent{Error: token.Err.Error()})
			return false
		}

		if token.IsFinal {
			// send the final metadata event
			finalEvent := sseFinalEvent{
				Done:      true,
				Model:     model,
				Class:     string(class),
				SessionID: sessionID,
				Cache:      cacheResult.Tier,
				Similarity: cacheResult.Similarity,
				OriginalTokens:   pruneResult.OriginalTokens,
				PrunedTokens:     pruneResult.PrunedTokens,
				CompressionRatio: pruneResult.CompressionRatio,
			}
			if token.Usage != nil {
				finalEvent.InputTokens = token.Usage.InputTokens
				finalEvent.OutputTokens = token.Usage.OutputTokens
				finalEvent.LatencyMs = token.Usage.LatencyMs
			}
			writeSSE(w, finalEvent)

			// OpenAI-style terminator that clients expect
			fmt.Fprint(w, "data: [DONE]\n\n")

			response := fullResponse.String()

			// async persistence
			h.saveAssistantMessage(sessionID, requestID, response)

			// async cache write
			if h.cacheClient != nil &&
				response != "" &&
				cacheResult.Tier == cache.TierMiss {

				h.cacheClient.WriteAsync(
					prunedPrompt,
					response,
					sessionID,
					requestID,
				)
			}
			
			h.logger.Log(analytics.RequestLog{
				RequestID: requestID,
				UserID:    userID,
				Model: model,

				InputTokens:  finalEvent.InputTokens,
				OutputTokens: finalEvent.OutputTokens,
				LatencyMs: finalEvent.LatencyMs,

				CacheHit:      cacheResult.Tier == cache.TierHit,
				CycleDetected: false,
				CostUSD: 0,
			})

			return false // stop streaming
		}

		// stream this token to the client
		fullResponse.WriteString(token.Text)
		writeSSE(w, sseTokenEvent{Token: token.Text})
		return true // continue streaming
	})
}
// ── Helpers ───────────────────────────────────────────────────────────────────
 
// streamCachedResponse streams a HIT response over SSE.
// The response is split word-by-word to preserve the streaming UX —
// the client sees no difference between a cache hit and a live LLM response.
func (h *Handler) streamCachedResponse(
	c *gin.Context,
	result cache.QueryResult,
	pruneResult pruning.PruneResult,
	sessionID, requestID, userID string,
) {
	c.Header("Content-Type",  "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection",    "keep-alive")
	c.Header("X-Request-ID",  requestID)
	c.Header("X-Session-ID",  sessionID)
	c.Header("X-Cache",       "HIT")
	c.Header("X-User-ID",     userID)
 
	words := strings.Fields(result.Response)
 
	c.Stream(func(w io.Writer) bool {
		for i, word := range words {
			text := word
			if i < len(words)-1 {
				text += " "
			}
			writeSSE(w, sseTokenEvent{Token: text})
		}
 
		writeSSE(w, sseFinalEvent{
			Done:         true,
			Model:        "cache",
			Cache:        "HIT",
			Similarity:   result.Similarity,
			SessionID:    sessionID,
			OriginalTokens:   pruneResult.OriginalTokens,
			PrunedTokens:     pruneResult.PrunedTokens,
			CompressionRatio: pruneResult.CompressionRatio,
		})
		h.logger.Log(analytics.RequestLog{
		    RequestID:    requestID,
		    UserID:       userID,
		    Model:        "cache",
		    InputTokens:  0,
		    OutputTokens: 0,
		    LatencyMs:    0,
		    CacheHit:     true,
		    CycleDetected: false,
		    CostUSD:      0,
})
		fmt.Fprint(w, "data: [DONE]\n\n")
		return false
	})
}
 
// saveAssistantMessage persists the assistant's response to Redis session history.
// Uses a background context so a completed request context doesn't cancel the write.
func (h *Handler) saveAssistantMessage(sessionID, requestID, response string) {
	if response == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
 
	assistantMsg := providers.Message{Role: providers.RoleAssistant, Content: response}
	if err := h.store.Append(ctx, sessionID, assistantMsg); err != nil {
		fmt.Printf("[WARN] [%s] failed to save assistant message: %v\n", requestID, err)
	}
}
 