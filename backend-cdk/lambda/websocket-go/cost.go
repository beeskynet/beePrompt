package main

import (
	"fmt"
	"strings"

	tiktoken "github.com/pkoukk/tiktoken-go"
)

// Model values — keep in sync with common.py in the Python Lambda layer.
// When adding new models, update BOTH this file and backend-cdk/lambda_layer/common/python/common.py.
const (
	ModelGPT35Turbo     = "gpt-3.5-turbo-0125"
	ModelGPT4           = "gpt-4"
	ModelGPT4TurboPrev  = "gpt-4-0125-preview"
	ModelGPT4Turbo      = "gpt-4-turbo-2024-04-09"
	ModelGPT4o          = "gpt-4o-2024-08-06"
	ModelGPT4oSearch    = "gpt-4o-search-preview"
	ModelGPT4oMini      = "gpt-4o-mini"
	ModelGPT45Preview   = "gpt-4.5-preview-2025-02-27"
	ModelGPT41          = "gpt-4.1-2025-04-14"
	ModelGPT41Mini      = "gpt-4.1-mini-2025-04-14"
	ModelGPT41Nano      = "gpt-4.1-nano-2025-04-14"
	ModelGPT5           = "gpt-5-2025-08-07"
	ModelGPT5Mini       = "gpt-5-mini-2025-08-07"
	ModelGPT5Nano       = "gpt-5-nano-2025-08-07"
	ModelGPT54          = "gpt-5.4"
	ModelGPT54Mini      = "gpt-5.4-mini"
	ModelGPT54Nano      = "gpt-5.4-nano"
	ModelO1Preview      = "o1-preview-2024-09-12"
	ModelO1             = "o1-2024-12-17"
	ModelO1Mini         = "o1-mini-2024-09-12"
	ModelO3             = "o3-2025-04-16"
	ModelO3Mini         = "o3-mini-2025-01-31"
	ModelClaudeV3Sonnet = "anthropic.claude-3-sonnet-20240229-v1:0"
	ModelClaudeV2       = "anthropic.claude-v2"
	ModelClaudeV21      = "anthropic.claude-v2:1"
	ModelClaudeInstant  = "anthropic.claude-instant-v1"
	ModelClaude3Opus    = "claude-3-opus-20240229"
	ModelClaude3Sonnet  = "claude-3-sonnet-20240229"
	ModelClaude35Sonnet = "claude-3-5-sonnet-20241022"
	ModelClaude37Sonnet = "claude-3-7-sonnet-20250219"
	ModelClaude45Sonnet = "claude-sonnet-4-5"
	ModelClaude41Opus   = "claude-opus-4-1"
	ModelClaude46Sonnet = "claude-sonnet-4-6"
	ModelClaude46Opus   = "claude-opus-4-6"
	ModelClaude3Haiku   = "claude-3-haiku-20240307"
	ModelClaude35Haiku  = "claude-3-5-haiku-20241022"
	ModelClaude45Haiku  = "claude-haiku-4-5"
	ModelCommandRPlus   = "command-r-plus"
)

const (
	Yen1Dollar           = "150"
	Point1Yen            = "1"
	ClaudeMaxOutputToken = 4096
)

type PriceInfo struct {
	In  float64
	Out float64
}

// PRICE maps model names to per-1K-token prices.
// Keep in sync with common.py in the Python Lambda layer.
var PRICE = map[string]PriceInfo{
	// GPT
	ModelGPT35Turbo:    {In: 0.0005, Out: 0.0015},
	ModelGPT4:          {In: 0.03, Out: 0.06},
	ModelGPT4TurboPrev: {In: 0.01, Out: 0.03},
	ModelGPT4Turbo:     {In: 0.01, Out: 0.03},
	ModelGPT4o:         {In: 0.0025, Out: 0.010},
	ModelGPT4oSearch:   {In: 0.0025, Out: 0.010},
	ModelGPT41:         {In: 0.002, Out: 0.008},
	ModelGPT41Mini:     {In: 0.0004, Out: 0.0016},
	ModelGPT41Nano:     {In: 0.0001, Out: 0.0004},
	ModelGPT5:          {In: 0.00125, Out: 0.01},
	ModelGPT5Mini:      {In: 0.00025, Out: 0.002},
	ModelGPT5Nano:      {In: 0.00005, Out: 0.0004},
	ModelGPT54:         {In: 0.0025, Out: 0.015},
	ModelGPT54Mini:     {In: 0.00075, Out: 0.0045},
	ModelGPT54Nano:     {In: 0.0002, Out: 0.00125},
	ModelGPT4oMini:     {In: 0.00015, Out: 0.0006},
	ModelGPT45Preview:  {In: 0.075, Out: 0.15},
	ModelO1Preview:     {In: 0.015, Out: 0.060},
	ModelO1:            {In: 0.015, Out: 0.060},
	ModelO1Mini:        {In: 0.0011, Out: 0.0044},
	ModelO3:            {In: 0.01, Out: 0.04},
	ModelO3Mini:        {In: 0.0011, Out: 0.0044},
	// Claude
	ModelClaudeInstant:  {In: 0.00163, Out: 0.00551},
	ModelClaudeV2:       {In: 0.008, Out: 0.024},
	ModelClaudeV21:      {In: 0.008, Out: 0.024},
	ModelClaudeV3Sonnet: {In: 0.003, Out: 0.015},
	ModelClaude3Haiku:   {In: 0.00025, Out: 0.00125},
	ModelClaude35Haiku:  {In: 0.001, Out: 0.005},
	ModelClaude45Haiku:  {In: 0.001, Out: 0.005},
	ModelClaude3Sonnet:  {In: 0.003, Out: 0.015},
	ModelClaude35Sonnet: {In: 0.003, Out: 0.015},
	ModelClaude37Sonnet: {In: 0.003, Out: 0.015},
	ModelClaude45Sonnet: {In: 0.003, Out: 0.015},
	ModelClaude41Opus:   {In: 0.015, Out: 0.075},
	ModelClaude46Sonnet: {In: 0.003, Out: 0.015},
	ModelClaude46Opus:   {In: 0.005, Out: 0.025},
	ModelClaude3Opus:    {In: 0.015, Out: 0.075},
	// Cohere
	ModelCommandRPlus: {In: 0.0, Out: 0.0},
}

// SEARCH_PRICE maps model names to per-call search prices in dollars.
var SEARCH_PRICE = map[string]float64{
	ModelGPT4oSearch: 0.025,
}

func isGPT(model string) bool {
	return strings.HasPrefix(model, "gpt-") || strings.HasPrefix(model, "o")
}

func isCommand(model string) bool {
	return strings.HasPrefix(model, "command")
}

func countToken(text string) int {
	enc, err := tiktoken.GetEncoding("cl100k_base")
	if err != nil {
		fmt.Println("tiktoken error:", err)
		return 0
	}
	return len(enc.Encode(text, nil, nil))
}

func estCostClaude(ioType string, tokenCnt int, model string) CostResult {
	price := PRICE[model]
	var dollar1Token float64
	if ioType == "in" {
		dollar1Token = price.In
	} else {
		dollar1Token = price.Out
	}
	dollar := float64(tokenCnt) * dollar1Token / 1000.0
	yen := dollar * 150.0
	usagePoint := yen * 1.0
	return CostResult{
		ioType + "_token":       tokenCnt,
		ioType + "_dollar":      fmt.Sprintf("%.5f", dollar),
		ioType + "_yen":         fmt.Sprintf("%.3f", yen),
		ioType + "_usage_point": fmt.Sprintf("%.3f", usagePoint),
	}
}

func estGPTCost(ioType string, messages interface{}, model string) CostResult {
	var tokenCnt int
	if ioType == "in" {
		msgs := messages.([]map[string]string)
		adjust := 7
		total := 0
		for _, msg := range msgs {
			total += countToken(msg["content"]) + adjust
		}
		tokenCnt = total
	} else {
		tokenCnt = countToken(messages.(string))
	}
	price := PRICE[model]
	var dollar1Token float64
	if ioType == "in" {
		dollar1Token = price.In
	} else {
		dollar1Token = price.Out
	}
	dollar := float64(tokenCnt) * dollar1Token / 1000.0
	yen := dollar * 150.0
	usagePoint := yen * 1.0
	return CostResult{
		ioType + "_token":       tokenCnt,
		ioType + "_dollar":      fmt.Sprintf("%.5f", dollar),
		ioType + "_yen":         fmt.Sprintf("%.3f", yen),
		ioType + "_usage_point": fmt.Sprintf("%.3f", usagePoint),
	}
}

func estCohereCost(ioType string) CostResult {
	return CostResult{
		ioType + "_token":       0,
		ioType + "_dollar":      0,
		ioType + "_yen":         0,
		ioType + "_usage_point": 0,
	}
}

func estSearchCost(model string) CostResult {
	if price, ok := SEARCH_PRICE[model]; ok {
		searchYen := price * 150.0
		searchUsagePoint := searchYen * 1.0
		return CostResult{
			"search_count":       1,
			"search_dollar":      fmt.Sprintf("%.5f", price),
			"search_yen":         fmt.Sprintf("%.3f", searchYen),
			"search_usage_point": fmt.Sprintf("%.3f", searchUsagePoint),
		}
	}
	return CostResult{
		"search_count":       0,
		"search_dollar":      "0",
		"search_yen":         "0",
		"search_usage_point": "0",
	}
}
