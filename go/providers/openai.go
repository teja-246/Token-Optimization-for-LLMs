package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"time"
)

type OpenAIAdapter struct{}

func NewOpenAIAdapter() *OpenAIAdapter {
	return &OpenAIAdapter{}
}

type openAIRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
}

type openAIResponse struct {
	Output []struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	} `json:"output"`
}

func (o *OpenAIAdapter) Complete(
	ctx context.Context,
	req CompletionRequest,
) (<-chan Token, error) {

	stream := make(chan Token)

	go func() {

		defer close(stream)

		start := time.Now()

		payload := openAIRequest{
			Model: req.Model,
			Input: req.Prompt,
		}

		body, _ := json.Marshal(payload)

		httpReq, _ := http.NewRequestWithContext(
			ctx,
			"POST",
			"https://api.openai.com/v1/responses",
			bytes.NewBuffer(body),
		)

		httpReq.Header.Set(
			"Authorization",
			"Bearer "+os.Getenv("OPENAI_API_KEY"),
		)

		httpReq.Header.Set(
			"Content-Type",
			"application/json",
		)

		client := &http.Client{}

		resp, err := client.Do(httpReq)

		if err != nil {
			return
		}

		defer resp.Body.Close()

		var result openAIResponse

		err = json.NewDecoder(resp.Body).Decode(&result)

		if err != nil {
			return
		}

		fullText := ""

		for _, output := range result.Output {
			for _, content := range output.Content {
				fullText += content.Text
			}
		}

		stream <- Token{
			Text:    fullText,
			IsFinal: false,
		}

		stream <- Token{
			IsFinal: true,
			Usage: &Usage{
				InputTokens:  0,
				OutputTokens: len(fullText),
				LatencyMs:    time.Since(start).Milliseconds(),
			},
		}
	}()

	return stream, nil
}