package main

// WebSocketEvent represents the API Gateway WebSocket event.
type WebSocketEvent struct {
	RequestContext struct {
		DomainName   string `json:"domainName"`
		Stage        string `json:"stage"`
		ConnectionID string `json:"connectionId"`
	} `json:"requestContext"`
	Body string `json:"body"`
}

// RequestBody represents the parsed JSON body from the WebSocket message.
type RequestBody struct {
	JWT                 string    `json:"jwt"`
	DTM                 string    `json:"dtm"`
	UserDTM             string    `json:"userDtm"`
	UserMsg             string    `json:"userMsg"`
	SysMsg              string    `json:"sysMsg"`
	TemperatureGPT      float64   `json:"temperatureGpt,string"`
	TopPGPT             float64   `json:"topPGpt,string"`
	FrequencyPenaltyGPT float64   `json:"frequencyPenaltyGpt,string"`
	PresencePenaltyGPT  float64   `json:"presencePenaltyGpt,string"`
	TemperatureClaude   float64   `json:"temperatureClaude,string"`
	TemperatureCohere   float64   `json:"temperatureCohere,string"`
	Messages            []Message `json:"messages"`
	Model               string    `json:"model"`
	ChatID              string    `json:"chatid"`
}

// Message represents a chat message from the frontend.
type Message struct {
	Role       string  `json:"role"`
	Content    string  `json:"content"`
	Model      string  `json:"model,omitempty"`
	Done       *string `json:"done,omitempty"`
	PriceInOut float64 `json:"-"` // calculated field, not from JSON
}

// CostResult holds cost calculation results for a given io_type.
type CostResult map[string]interface{}

// StreamParams holds parameters needed by provider streaming functions.
type StreamParams struct {
	Model               string
	Messages            []map[string]string
	UserMsg             string
	ChatHistory         []map[string]string // for Cohere
	UserID              string
	TemperatureGPT      float64
	TopPGPT             float64
	FrequencyPenaltyGPT float64
	PresencePenaltyGPT  float64
	TemperatureClaude   float64
	TemperatureCohere   float64
}

// StreamResult holds the result from a provider streaming call.
type StreamResult struct {
	WholeContent string
	InputTokens  int
	OutputTokens int
}

// PostFunc is a function that sends a chunk to the WebSocket client.
type PostFunc func(content string) error
