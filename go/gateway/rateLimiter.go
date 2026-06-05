package main

import (
	"net/http"
	"time"
	"github.com/gin-gonic/gin"
)

const REQUEST_LIMIT = 10

func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "missing user context",
			})
			c.Abort()
			return
		}
		key := "ratelimit:" + userID.(string)
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