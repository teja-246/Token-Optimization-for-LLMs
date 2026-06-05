package main

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

type ChatRequest struct {
	Prompt string `json:"prompt"`
}

func ChatHandler(c *gin.Context) {
	var req ChatRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid JSON body",
		})
		return
	}
	userID, _ := c.Get("user_id")
	requestID, _ := c.Get("request_id")
	traceID, _ := c.Get("trace_id")
	c.JSON(http.StatusOK, gin.H{
		"message":    "gateway operational",
		"user_id":    userID,
		"request_id": requestID,
		"trace_id":   traceID,
		"prompt":     req.Prompt,
	})
}