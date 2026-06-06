package providers

import "fmt"

func GetProvider(model string) (LLMProvider, error) {

	switch model {

	case "gpt-4o",
		"gpt-4o-mini",
		"gpt-4.1-mini":
		return NewOpenAIAdapter(), nil

	default:
		return nil, fmt.Errorf("unsupported model")
	}
}