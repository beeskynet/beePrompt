package providers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// StreamCohere streams responses from the Cohere API using direct HTTP SSE.
func StreamCohere(apiKey, model string, chatHistory []map[string]string, message string,
	temperature float64,
	postFn func(string) error) (wholeContent string, err error) {

	// Build request body
	reqBody := map[string]interface{}{
		"model":        model,
		"message":      message,
		"chat_history": chatHistory,
		"temperature":  temperature,
		"stream":       true,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.cohere.ai/v1/chat", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("Cohere API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Cohere API error %d: %s", resp.StatusCode, string(body))
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var event map[string]interface{}
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			continue
		}

		eventType, _ := event["event_type"].(string)
		if eventType == "text-generation" {
			text, _ := event["text"].(string)
			if text != "" {
				wholeContent += text
				if err := postFn(text); err != nil {
					return wholeContent, fmt.Errorf("failed to post chunk: %w", err)
				}
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return wholeContent, fmt.Errorf("Cohere stream read error: %w", err)
	}

	return wholeContent, nil
}
