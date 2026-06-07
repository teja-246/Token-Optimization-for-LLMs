package providers

import "strings"

// Groq free model tiers.
// Both are on the completely free tier — no API cost.
const (
	// ModelFast is used for Class A queries: greetings, simple Q&A, formatting.
	// llama-3.1-8b-instant: ~100ms to first token, very low latency.
	ModelFast = "llama-3.1-8b-instant"

	// ModelPowerful is used for Class B/C queries: coding, reasoning, analysis.
	// llama-3.3-70b-versatile: stronger reasoning, still free on Groq.
	ModelPowerful = "llama-3.3-70b-versatile"
)

// ModelClass represents query complexity, used to pick the right model.
type ModelClass string

const (
	ClassA ModelClass = "A" // simple, conversational
	ClassB ModelClass = "B" // standard — coding, writing, explanation
	ClassC ModelClass = "C" // complex — architecture, deep reasoning
)

// ClassifyPrompt assigns a complexity class to a prompt using keyword heuristics.
//
// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER — Feature 6 (Intelligent Router) replaces this entirely.
// Feature 6 will call the Python gRPC service which runs an embeddings-based
// classifier trained on real prompt data. Do not invest in making this
// heuristic more sophisticated — it will be deleted.
// ─────────────────────────────────────────────────────────────────────────────
func ClassifyPrompt(prompt string) ModelClass {
	lower := strings.ToLower(strings.TrimSpace(prompt))
	wordCount := len(strings.Fields(prompt))

	// very short or purely conversational → fast model
	if wordCount <= 8 {
		return ClassA
	}

	// explicit complexity signals → powerful model
	complexSignals := []string{
		"architect", "design", "distributed", "system design",
		"scalab", "tradeoff", "compare", "implement", "optimiz",
		"algorithm", "database schema", "microservice", "debug",
		"explain in detail", "how does", "why does",
	}
	for _, kw := range complexSignals {
		if strings.Contains(lower, kw) {
			return ClassC
		}
	}

	return ClassB
}

// SelectModel maps a complexity class to the appropriate Groq model name.
// Both classes map to free Groq models.
func SelectModel(class ModelClass) string {
	switch class {
	case ClassA:
		return ModelFast
	case ClassB, ClassC:
		return ModelPowerful
	default:
		return ModelPowerful
	}
}