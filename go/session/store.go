package session

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"github.com/redis/go-redis/v9"
	"github.com/teja-246/Token-Optimization-for-LLMs/go/providers"
)

const (
	// sessionTTL is how long a session lives after its last message.
	// Refreshed on every Append call.
	sessionTTL = 24 * time.Hour

	// maxMessages is the maximum number of messages kept per session.
	// Older messages are trimmed automatically to prevent context explosion.
	// At ~200 tokens/message, 50 messages ≈ 10k tokens of history.
	maxMessages = 50
)

// Store manages per-session conversation history in Redis.
//
// Data model: each session is a Redis list at key "session:{id}:messages".
// Messages are stored as JSON and appended in order (oldest at index 0).
// This means any provider can reconstruct the full conversation by reading
// the list — regardless of which providers answered previous turns.
type Store struct {
	rdb *redis.Client
}

func NewStore(rdb *redis.Client) *Store {
	return &Store{rdb: rdb}
}

func (s *Store) key(sessionID string) string {
	return fmt.Sprintf("session:%s:messages", sessionID)
}

// Append adds a message to the session history.
// Uses a Redis pipeline to atomically: push, trim to maxMessages, refresh TTL.
// This keeps the list bounded and the session alive as long as it's active.
func (s *Store) Append(ctx context.Context, sessionID string, msg providers.Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("session: marshal message: %w", err)
	}

	key := s.key(sessionID)

	// TxPipeline: all three commands succeed or fail together
	pipe := s.rdb.TxPipeline()
	pipe.RPush(ctx, key, data)               // append to right (end) of list
	pipe.LTrim(ctx, key, -maxMessages, -1)   // keep the last 50 messages only
	pipe.Expire(ctx, key, sessionTTL)        // refresh TTL on every message

	if _, err = pipe.Exec(ctx); err != nil {
		return fmt.Errorf("session: pipeline exec: %w", err)
	}
	return nil
}

// GetHistory returns all messages for a session in chronological order.
// Returns an empty slice (not an error) if the session doesn't exist yet.
func (s *Store) GetHistory(ctx context.Context, sessionID string) ([]providers.Message, error) {
	raw, err := s.rdb.LRange(ctx, s.key(sessionID), 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("session: get history: %w", err)
	}

	messages := make([]providers.Message, 0, len(raw))
	for _, r := range raw {
		var msg providers.Message
		if err := json.Unmarshal([]byte(r), &msg); err != nil {
			// skip corrupted entries silently — don't break the conversation
			continue
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

// Clear deletes all history for a session immediately.
// Useful for "new conversation" or test teardown.
func (s *Store) Clear(ctx context.Context, sessionID string) error {
	return s.rdb.Del(ctx, s.key(sessionID)).Err()
}

// Exists returns true if the session has any history.
func (s *Store) Exists(ctx context.Context, sessionID string) (bool, error) {
	count, err := s.rdb.LLen(ctx, s.key(sessionID)).Result()
	return count > 0, err
}