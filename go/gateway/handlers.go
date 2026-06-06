package main

import (
	"net/http"
	"github.com/gin-gonic/gin"
	"github.com/teja-246/Token-Optimization-for-LLMs/providers"
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
	requestID, _ := c.Get("request_id")
	provider, err := providers.GetProvider("gpt-4.1-mini")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	stream, err := provider.Complete(
		c.Request.Context(),
		providers.CompletionRequest{
			Prompt:    req.Prompt,
			Model:     "gpt-4.1-mini",
			// Model: "gpt-4o-mini",
			RequestID: requestID.(string),
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "provider failed",
		})
		return
	}
	fullResponse := ""
	var usage *providers.Usage
	for token := range stream {

		if token.IsFinal {
			usage = token.Usage
			break
		}

		fullResponse += token.Text
	}
	c.JSON(http.StatusOK, gin.H{
		"response": fullResponse,
		"usage":    usage,
	})
}