package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

var apiKeySecretKey = map[string]string{
	"openai":    "beePrompt-open-ai-secret",
	"anthropic": "beePrompt-anthropic-secret",
}

var apiKeyEnvName = map[string]string{
	"openai":    "OPENAI_API_KEY",
	"anthropic": "ANTHROPIC_API_KEY",
	"cohere":    "COHERE_API_KEY",
}

func getAPIKey(platform string) (string, error) {
	envName, ok := apiKeyEnvName[platform]
	if !ok {
		return "", fmt.Errorf("unknown platform: %s", platform)
	}
	if val := os.Getenv(envName); val != "" {
		return val, nil
	}

	secretID, ok := apiKeySecretKey[platform]
	if !ok {
		return "", fmt.Errorf("no secret key configured for platform: %s", platform)
	}

	cfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(region))
	if err != nil {
		return "", fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := secretsmanager.NewFromConfig(cfg)
	result, err := client.GetSecretValue(context.Background(), &secretsmanager.GetSecretValueInput{
		SecretId: &secretID,
	})
	if err != nil {
		return "", fmt.Errorf("failed to get secret: %w", err)
	}

	var secretMap map[string]string
	if err := json.Unmarshal([]byte(*result.SecretString), &secretMap); err != nil {
		return "", fmt.Errorf("failed to parse secret JSON: %w", err)
	}

	val, ok := secretMap[secretID]
	if !ok {
		return "", fmt.Errorf("key %s not found in secret", secretID)
	}
	return val, nil
}
