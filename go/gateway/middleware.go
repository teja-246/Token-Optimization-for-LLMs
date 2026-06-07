package main

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequestTracingMiddleware injects request_id and trace_id into context.
func RequestTracingMiddleware() gin.HandlerFunc {

	return func(c *gin.Context) {
		requestID := "req_" + uuid.New().String()
		traceID := "trace_" + uuid.New().String()
		c.Set("request_id", requestID)
		c.Set("trace_id", traceID)
		c.Writer.Header().Set("X-Request-ID", requestID)
		c.Writer.Header().Set("X-Trace-ID", traceID)

		c.Next()
	}
}