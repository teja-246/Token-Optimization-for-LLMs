package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/joho/godotenv"

	"github.com/teja-246/Token-Optimization-for-LLMs/go/config"
	"github.com/teja-246/Token-Optimization-for-LLMs/go/providers"
	"github.com/teja-246/Token-Optimization-for-LLMs/go/session"
	"github.com/teja-246/Token-Optimization-for-LLMs/go/analytics"
	"github.com/teja-246/Token-Optimization-for-LLMs/go/cache"
	"github.com/teja-246/Token-Optimization-for-LLMs/go/pruning"
	"github.com/teja-246/Token-Optimization-for-LLMs/go/cycledetector"
)

func main() {
	err := godotenv.Load()

	if err != nil {
		log.Fatal("failed to load .env")
	}
	// ── load config ──────────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	// ── init Redis ───────────────────────────────────────────────────────────
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis: invalid URL: %v", err)
	}
	rdb := redis.NewClient(opt)

	// ── init Kafka producer ───────────────────────────────────────────────────
	kafkaProducer, err := analytics.NewKafkaProducer(cfg.KafkaBroker,)
	if err != nil {
		log.Fatalf("kafka error: %v", err)
	}

	// ── init Postgres ──────────────────────────────────────────────────────────
	dbPool, err := analytics.NewPostgresPool(cfg.PostgresURL)
	if err != nil {
		log.Fatalf("postgres error: %v", err)
	}
	analyticsLogger := analytics.NewLogger(dbPool, kafkaProducer)

	// ── init Groq provider (Feature 2) ───────────────────────────────────────
	groqProvider := providers.NewGroqProvider(cfg.GroqAPIKey)
	log.Printf("LLM provider: %s", groqProvider.Name())

	// ── init session store (Feature 2) ───────────────────────────────────────
	store := session.NewStore(rdb)

	// ── Feature 4: semantic cache client ─────────────────────────────────────
	// Connects to the Python ML gRPC server.
	// Connection is lazy — gateway starts even if Python service isn't ready yet.
	cacheClient, err := cache.NewClient(cfg.MLGRPCAddr)
	if err != nil {
		// non-fatal: cache is optional — gateway runs without it (all misses)
		log.Printf("[WARN] cache client init failed (%v) — running without cache", err)
		cacheClient = nil
	} else {
		log.Printf("cache gRPC client → %s", cfg.MLGRPCAddr)
		defer cacheClient.Close()
	}

	// Feature 5: pruning client
	pruningClient, err := pruning.NewClient(cfg.MLGRPCAddr)
	if err != nil {
		log.Printf("[WARN] pruning client unavailable (%v) — running without pruning", err)
		pruningClient = nil
	} else {
		log.Printf("pruning gRPC → %s", cfg.MLGRPCAddr)
		defer pruningClient.Close()
	}

	// Feature 9: cycle detector client
	cycleClient, err := cycledetector.NewClient(cfg.MLGRPCAddr)
	if err != nil {
		log.Printf("[WARN] cycle detector unavailable (%v) — running without loop detection", err)
		cycleClient = nil
	} else {
		log.Printf("cycle       gRPC → %s", cfg.MLGRPCAddr)
		defer cycleClient.Close()
	}

	// ── init chat handler (Feature 2) ────────────────────────────────────────
	handler := NewHandler(groqProvider, store, analyticsLogger, cacheClient, pruningClient, cycleClient, rdb)

	// ── router ───────────────────────────────────────────────────────────────
	r := gin.Default()

	// health check — unauthenticated, used by docker-compose healthcheck
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":   "ok",
			"provider": groqProvider.Name(),
			"cache":	cacheClient != nil,
			"pruning":  pruningClient != nil,
			"cycle":    cycleClient != nil,
		})
	})

	// v1 API — all routes behind Feature 1 middleware chain
	v1 := r.Group("/v1")
	v1.Use(
		AuthMiddleware(cfg.JWTSecret),    // Feature 1 — rejects invalid/missing JWT
		RateLimitMiddleware(rdb),          // Feature 1 — 10 req/s per user via Redis
		RequestTracingMiddleware(),        // Feature 1 — injects request_id + trace_id
	)
	{
		// Feature 2: fully wired LLM endpoint with session history + SSE streaming
		v1.POST("/chat", handler.Chat)
	}

	// ── start server ─────────────────────────────────────────────────────────
	log.Printf("Gateway listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}