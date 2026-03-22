package providers

import (
	"context"
	"fmt"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

const ModelGPT4oSearch = "gpt-4o-search-preview"

// StreamOpenAI streams responses from the OpenAI API.
func StreamOpenAI(ctx context.Context, apiKey, model string, messages []map[string]string, userID string,
	temperature, topP, frequencyPenalty, presencePenalty float64,
	postFn func(string) error) (wholeContent string, err error) {

	client := openai.NewClient(option.WithAPIKey(apiKey))

	// Filter system messages for O1/O3 models before building params
	filteredMessages := messages
	if len(model) > 0 && model[0] == 'o' {
		var filtered []map[string]string
		for _, msg := range messages {
			if msg["role"] != "system" {
				filtered = append(filtered, msg)
			}
		}
		filteredMessages = filtered
	}

	// Build message params
	chatMessages := make([]openai.ChatCompletionMessageParamUnion, 0, len(filteredMessages))
	for _, msg := range filteredMessages {
		role := msg["role"]
		content := msg["content"]
		switch role {
		case "system":
			chatMessages = append(chatMessages, openai.SystemMessage(content))
		case "user":
			chatMessages = append(chatMessages, openai.UserMessage(content))
		case "assistant":
			chatMessages = append(chatMessages, openai.AssistantMessage(content))
		}
	}

	params := openai.ChatCompletionNewParams{
		Model:    model,
		Messages: chatMessages,
	}

	if model == ModelGPT4oSearch {
		params.User = openai.String(userID)
	} else {
		params.Temperature = openai.Float(temperature)
		params.TopP = openai.Float(topP)
		params.FrequencyPenalty = openai.Float(frequencyPenalty)
		params.PresencePenalty = openai.Float(presencePenalty)
		params.User = openai.String(userID)
	}

	stream := client.Chat.Completions.NewStreaming(ctx, params)

	for stream.Next() {
		chunk := stream.Current()
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			content := chunk.Choices[0].Delta.Content
			wholeContent += content
			if err := postFn(content); err != nil {
				return wholeContent, fmt.Errorf("failed to post chunk: %w", err)
			}
		}
	}
	if err := stream.Err(); err != nil {
		return wholeContent, fmt.Errorf("OpenAI stream error: %w", err)
	}

	return wholeContent, nil
}
