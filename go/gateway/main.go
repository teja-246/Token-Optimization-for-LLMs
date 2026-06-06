package main

import (
	"log"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("failed to load .env")
	}

	router := gin.Default()
	router.POST("/v1/chat",
		AuthMiddleware(),
		RateLimitMiddleware(),
		RequestIDMiddleware(),
		ChatHandler,
	)

	router.Run(":8000")
}