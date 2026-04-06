package providers

import (
	"context"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

const ClaudeMaxOutputTokens = 4096

// StreamAnthropic streams responses from the Anthropic API.
func StreamAnthropic(ctx context.Context, apiKey, model string, messages []map[string]string, userID string,
	temperature float64,
	postFn func(string) error) (inputTokens, outputTokens int, err error) {

	client := anthropic.NewClient(option.WithAPIKey(apiKey))

	// Build message params
	anthropicMessages := make([]anthropic.MessageParam, 0, len(messages))
	for _, msg := range messages {
		role := msg["role"]
		content := msg["content"]
		switch role {
		case "user":
			anthropicMessages = append(anthropicMessages, anthropic.NewUserMessage(
				anthropic.NewTextBlock(content),
			))
		case "assistant":
			anthropicMessages = append(anthropicMessages, anthropic.NewAssistantMessage(
				anthropic.NewTextBlock(content),
			))
		}
	}

	stream := client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:       model,
		MaxTokens:   int64(ClaudeMaxOutputTokens),
		Messages:    anthropicMessages,
		Temperature: anthropic.Float(temperature),
		Metadata: anthropic.MetadataParam{
			UserID: anthropic.String(userID),
		},
	})

	for stream.Next() {
		event := stream.Current()
		switch event.Type {
		case "content_block_delta":
			if event.Delta.Text != "" {
				if err := postFn(event.Delta.Text); err != nil {
					return 0, 0, fmt.Errorf("failed to post chunk: %w", err)
				}
			}
		case "message_delta":
			outputTokens = int(event.Usage.OutputTokens)
		case "message_start":
			inputTokens = int(event.Message.Usage.InputTokens)
		}
	}
	if err := stream.Err(); err != nil {
		return 0, 0, fmt.Errorf("Anthropic stream error: %w", err)
	}

	return inputTokens, outputTokens, nil
}
