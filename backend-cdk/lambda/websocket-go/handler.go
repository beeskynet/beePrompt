package main

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/apigatewaymanagementapi"
	"websocket-go/providers"
)

type InputError struct {
	Response map[string]interface{}
}

func (e *InputError) Error() string {
	return fmt.Sprintf("InputError: %v", e.Response)
}

func handleDefault(ctx context.Context, event WebSocketEvent) (map[string]interface{}, error) {
	domainName := event.RequestContext.DomainName
	stage := event.RequestContext.Stage
	connectionID := event.RequestContext.ConnectionID

	var body RequestBody
	if err := json.Unmarshal([]byte(event.Body), &body); err != nil {
		return map[string]interface{}{"statusCode": 400, "body": "invalid body"}, nil
	}

	model := body.Model
	chatID := body.ChatID
	dtm := body.DTM
	userDTM := body.UserDTM
	userMsg := body.UserMsg
	sysMsg := body.SysMsg

	fmt.Println(model)

	// Create API Gateway Management client
	endpoint := fmt.Sprintf("https://%s/%s", domainName, stage)
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return map[string]interface{}{"statusCode": 500, "body": "config error"}, nil
	}
	apigwClient := apigatewaymanagementapi.NewFromConfig(cfg, func(o *apigatewaymanagementapi.Options) {
		o.BaseEndpoint = &endpoint
	})

	postToConnection := func(data interface{}) error {
		jsonBytes, err := json.Marshal(data)
		if err != nil {
			return err
		}
		_, err = apigwClient.PostToConnection(ctx, &apigatewaymanagementapi.PostToConnectionInput{
			ConnectionId: &connectionID,
			Data:         jsonBytes,
		})
		return err
	}

	postChunk := func(content string) error {
		return postToConnection(map[string]interface{}{
			"content": content,
			"chatid":  chatID,
			"dtm":     dtm,
		})
	}

	// Error handling helper
	sendError := func(errResp map[string]interface{}) {
		merged := map[string]interface{}{
			"chatid":  chatID,
			"dtm":     dtm,
			"userDtm": userDTM,
		}
		for k, v := range errResp {
			merged[k] = v
		}
		_ = postToConnection(merged)
	}

	// Main logic wrapped in a function for error handling
	statusCode, respBody, mainErr := func() (int, interface{}, error) {
		// Token validation
		resVali, err := validateToken(body.JWT, dtm)
		if err != nil {
			return 500, nil, err
		}
		if success, ok := resVali["success"].(bool); !ok || !success {
			errResp := resVali["error-response"].(map[string]interface{})
			sendError(errResp)
			return 403, errResp, nil
		}
		accessToken := resVali["access_token"].(map[string]interface{})
		userid := accessToken["sub"].(string)

		// Build message history
		midMsgs, err := buildMessageHistory(body.Messages, model)
		if err != nil {
			return 0, nil, err
		}

		var inMsgs []map[string]string
		if isGPT(model) {
			if sysMsg != "" {
				inMsgs = append(inMsgs, map[string]string{"role": "system", "content": sysMsg})
			}
		}
		inMsgs = append(inMsgs, midMsgs...)
		inMsgs = append(inMsgs, map[string]string{"role": "user", "content": userMsg})

		// Point check (skip for Cohere)
		var preInCosts CostResult
		if !isCommand(model) {
			preInCosts = estGPTCost("in", inMsgs, model)
			if model == ModelGPT4oSearch {
				searchCosts := estSearchCost(model)
				preInPoint, _ := strconv.ParseFloat(fmt.Sprintf("%v", preInCosts["in_usage_point"]), 64)
				searchPoint, _ := strconv.ParseFloat(fmt.Sprintf("%v", searchCosts["search_usage_point"]), 64)
				totalPreIn := preInPoint + searchPoint
				resVali, err = checkEnoughPoints(userid, fmt.Sprintf("%f", totalPreIn))
			} else {
				resVali, err = checkEnoughPoints(userid, fmt.Sprintf("%v", preInCosts["in_usage_point"]))
			}
			if err != nil {
				return 500, nil, err
			}
			if success, ok := resVali["success"].(bool); !ok || !success {
				errResp := resVali["error-response"].(map[string]interface{})
				sendError(errResp)
				return 400, errResp, nil
			}
		}

		// Call AI provider
		var outputTokens, inputTokens int
		var wholeContent string

		if isGPT(model) {
			apiKey, err := getAPIKey("openai")
			if err != nil {
				return 500, nil, err
			}
			wholeContent, err = providers.StreamOpenAI(ctx, apiKey, model, inMsgs, userid,
				body.TemperatureGPT, body.TopPGPT, body.FrequencyPenaltyGPT, body.PresencePenaltyGPT,
				postChunk)
			if err != nil {
				return 0, nil, err
			}
		} else if isCommand(model) {
			apiKey, err := getAPIKey("cohere")
			if err != nil {
				return 500, nil, err
			}
			// Build cohere chat history
			var cohereHistory []map[string]string
			for _, msg := range midMsgs {
				cohereHistory = append(cohereHistory, map[string]string{
					"role": msg["role"],
					"text": msg["content"],
				})
			}
			wholeContent, err = providers.StreamCohere(apiKey, model, cohereHistory, userMsg,
				body.TemperatureCohere, postChunk)
			if err != nil {
				return 0, nil, err
			}
		} else {
			// Claude
			apiKey, err := getAPIKey("anthropic")
			if err != nil {
				return 500, nil, err
			}
			inputTokens, outputTokens, err = providers.StreamAnthropic(ctx, apiKey, model, inMsgs, userid,
				body.TemperatureClaude, postChunk)
			if err != nil {
				return 0, nil, err
			}
		}

		// Calculate search costs
		var searchCosts CostResult
		if model == ModelGPT4oSearch {
			searchCosts = estSearchCost(model)
		} else {
			searchCosts = CostResult{
				"search_count":       0,
				"search_dollar":      "0",
				"search_yen":         "0",
				"search_usage_point": "0",
			}
		}

		// Calculate input costs
		var inCosts CostResult
		if isCommand(model) {
			inCosts = estCohereCost("in")
		} else if isGPT(model) {
			inCosts = preInCosts
		} else {
			inCosts = estCostClaude("in", inputTokens, model)
		}

		// Save input usage
		if err := accessDBRetry(func() error {
			return saveUsage(userid, "in", model, inCosts)
		}); err != nil {
			fmt.Println("save_usage in error:", err)
		}

		// Calculate output costs
		var outCosts CostResult
		if isCommand(model) {
			outCosts = estCohereCost("out")
		} else if isGPT(model) {
			outCosts = estGPTCost("out", wholeContent, model)
		} else {
			outCosts = estCostClaude("out", outputTokens, model)
		}

		// Save output usage
		if err := accessDBRetry(func() error {
			return saveUsage(userid, "out", model, outCosts)
		}); err != nil {
			fmt.Println("save_usage out error:", err)
		}

		// Save search usage
		if model == ModelGPT4oSearch {
			if sc, ok := searchCosts["search_count"].(int); ok && sc > 0 {
				if err := accessDBRetry(func() error {
					return saveUsage(userid, "search", model, searchCosts)
				}); err != nil {
					fmt.Println("save_usage search error:", err)
				}
			}
		}

		// Use points
		inPoint, _ := strconv.ParseFloat(fmt.Sprintf("%v", inCosts["in_usage_point"]), 64)
		outPoint, _ := strconv.ParseFloat(fmt.Sprintf("%v", outCosts["out_usage_point"]), 64)
		searchPoint := 0.0
		if model == ModelGPT4oSearch {
			searchPoint, _ = strconv.ParseFloat(fmt.Sprintf("%v", searchCosts["search_usage_point"]), 64)
		}
		totalUsagePoint := inPoint + outPoint + searchPoint

		if err := accessDBRetry(func() error {
			return usePoints(userid, totalUsagePoint)
		}); err != nil {
			fmt.Println("use_points error:", err)
		}

		// Send done message
		responseData := map[string]interface{}{
			"done":    "message is ended.",
			"chatid":  chatID,
			"model":   model,
			"dtm":     dtm,
			"userDtm": userDTM,
		}
		for k, v := range inCosts {
			responseData[k] = v
		}
		for k, v := range outCosts {
			responseData[k] = v
		}

		if model == ModelGPT4oSearch {
			responseData["search_count"] = searchCosts["search_count"]
			responseData["search_dollar"] = searchCosts["search_dollar"]
			responseData["search_yen"] = searchCosts["search_yen"]
			responseData["search_usage_point"] = searchCosts["search_usage_point"]
		}

		// Total calculations
		inYen, _ := strconv.ParseFloat(fmt.Sprintf("%v", inCosts["in_yen"]), 64)
		outYen, _ := strconv.ParseFloat(fmt.Sprintf("%v", outCosts["out_yen"]), 64)
		totalYen := inYen + outYen
		if model == ModelGPT4oSearch {
			searchYen, _ := strconv.ParseFloat(fmt.Sprintf("%v", searchCosts["search_yen"]), 64)
			totalYen += searchYen
		}
		responseData["total_yen"] = fmt.Sprintf("%.3f", totalYen)
		responseData["total_usage_point"] = fmt.Sprintf("%.3f", totalUsagePoint)

		_ = postToConnection(responseData)
		return 200, nil, nil
	}()

	if mainErr != nil {
		// Handle errors
		switch e := mainErr.(type) {
		case *InputError:
			sendError(e.Response)
			return map[string]interface{}{"statusCode": 400, "body": e.Response}, nil
		default:
			errStr := mainErr.Error()
			fmt.Println("Error:", errStr)

			// Check if it's an API error with error code
			errorCodeMatch := regexp.MustCompile(`Error code: (\d+)`).FindStringSubmatch(errStr)
			if errorCodeMatch != nil {
				code, _ := strconv.Atoi(errorCodeMatch[1])

				platform := "OpenAI"
				if !isGPT(model) && !isCommand(model) {
					platform = "Anthropic"
				}

				errResp := map[string]interface{}{
					"error":        fmt.Sprintf("%s API Error: %s", platform, errStr),
					"errorMessage": fmt.Sprintf("%s API Error: %s", platform, errStr),
					"errorType":    fmt.Sprintf("%sAPIError", platform),
				}
				sendError(errResp)
				return map[string]interface{}{"statusCode": code, "body": errResp}, nil
			}

			_ = postToConnection(map[string]interface{}{
				"error":  errStr,
				"chatid": chatID,
				"dtm":    dtm,
			})
			return map[string]interface{}{"statusCode": 500, "body": errStr}, nil
		}
	}

	if respBody != nil {
		return map[string]interface{}{"statusCode": statusCode, "body": respBody}, nil
	}
	return map[string]interface{}{"statusCode": statusCode}, nil
}

// buildMessageHistory converts frontend messages to the format needed by AI providers.
// It implements the user_1assistant_list logic: for each user message, pick the assistant
// response with the highest combined in+out price.
func buildMessageHistory(messages []Message, model string) ([]map[string]string, error) {
	type userAssistants struct {
		User       Message
		Assistants []Message
	}

	var uaList []userAssistants

	for _, msg := range messages {
		if msg.Done == nil {
			continue
		}
		if msg.Role == "user" {
			uaList = append(uaList, userAssistants{User: msg})
		} else if msg.Role == "assistant" {
			if len(uaList) == 0 {
				return nil, &InputError{Response: map[string]interface{}{
					"error":     "Invalid chat history",
					"errorType": "InvalidChatHistory",
				}}
			}
			last := &uaList[len(uaList)-1]
			priceInOut := 0.0
			if p, ok := PRICE[msg.Model]; ok {
				priceInOut = p.In + p.Out
			}
			msg.PriceInOut = priceInOut
			last.Assistants = append(last.Assistants, msg)
		}
	}

	var result []map[string]string

	for _, ua := range uaList {
		if len(ua.Assistants) == 0 {
			return nil, &InputError{Response: map[string]interface{}{
				"error":     "Invalid chat history",
				"errorType": "InvalidChatHistory",
			}}
		}

		// Pick assistant with highest price_in_out
		sort.Slice(ua.Assistants, func(i, j int) bool {
			return ua.Assistants[i].PriceInOut < ua.Assistants[j].PriceInOut
		})
		bestAssistant := ua.Assistants[len(ua.Assistants)-1]

		if isCommand(model) {
			result = append(result,
				map[string]string{"role": "USER", "content": ua.User.Content},
				map[string]string{"role": "CHATBOT", "content": bestAssistant.Content},
			)
		} else {
			result = append(result,
				map[string]string{"role": ua.User.Role, "content": ua.User.Content},
				map[string]string{"role": bestAssistant.Role, "content": bestAssistant.Content},
			)
		}
	}

	return result, nil
}
