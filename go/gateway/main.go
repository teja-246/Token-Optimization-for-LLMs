package main

import (
	"github.com/gin-gonic/gin"
)

func main() {
	router := gin.Default()
	router.POST("/v1/chat",
				AuthMiddleware(),
				RateLimitMiddleware(),
				ChatHandler)
	router.Run(":8000")
}