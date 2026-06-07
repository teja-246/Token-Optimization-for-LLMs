package main

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

const REQUEST_LIMIT = 10

// RateLimitMiddleware enforces per-user request limits via Redis.
func RateLimitMiddleware(rdb *redis.Client) gin.HandlerFunc {

	ctx := context.Background()

	return func(c *gin.Context) {

		userID := c.GetString("user_id")

		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "missing user context",
			})
			c.Abort()
			return
		}

		key := "ratelimit:" + userID

		count, err := rdb.Incr(ctx, key).Result()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "redis error",
			})
			c.Abort()
			return
		}

		if count == 1 {
			rdb.Expire(ctx, key, time.Second)
		}

		if count > REQUEST_LIMIT {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}