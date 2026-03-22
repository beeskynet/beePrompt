package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

func getTableName() string {
	if v := os.Getenv("DB_TABLE_NAME"); v != "" {
		return v
	}
	return os.Getenv("PROJECT_NAME") + "-db"
}

func nowJST() time.Time {
	loc, _ := time.LoadLocation("Asia/Tokyo")
	return time.Now().In(loc)
}

// fmtDTM25 formats time as "yyyy-mm-dd hh:mm:ss.sssss" (25 chars) to match Python's str(datetime)[:25].
func fmtDTM25(t time.Time) string {
	s := t.Format("2006-01-02 15:04:05.000000")
	if len(s) > 25 {
		return s[:25]
	}
	return s
}

// fmtDTM19 formats time as "yyyy-mm-dd hh:mm:ss" (19 chars).
func fmtDTM19(t time.Time) string {
	return t.Format("2006-01-02 15:04:05")
}

func newDynamoClient() (*dynamodb.Client, error) {
	cfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(region))
	if err != nil {
		return nil, err
	}
	return dynamodb.NewFromConfig(cfg), nil
}

// checkEnoughPoints queries effective balances and checks if the user has enough points.
func checkEnoughPoints(userid string, inUsagePoint string) (map[string]interface{}, error) {
	client, err := newDynamoClient()
	if err != nil {
		return nil, err
	}
	tableName := getTableName()
	nowStr := fmtDTM25(nowJST())

	result, err := client.Query(context.Background(), &dynamodb.QueryInput{
		TableName:              &tableName,
		KeyConditionExpression: aws.String("pk = :pk AND sk > :sk"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: "pt#" + userid},
			":sk": &types.AttributeValueMemberS{Value: nowStr},
		},
		ScanIndexForward: aws.Bool(true),
	})
	if err != nil {
		return nil, err
	}

	totalBalance := 0.0
	for _, item := range result.Items {
		if bal, ok := item["balance"].(*types.AttributeValueMemberN); ok {
			v, _ := strconv.ParseFloat(bal.Value, 64)
			totalBalance += v
		}
	}

	inPoint, _ := strconv.ParseFloat(inUsagePoint, 64)
	if totalBalance < inPoint {
		return map[string]interface{}{
			"success": false,
			"error-response": map[string]interface{}{
				"error":     "Not enough points",
				"errorType": "LackOfPoints",
			},
		}, nil
	}
	return map[string]interface{}{"success": true}, nil
}

// saveUsage writes a usage record to DynamoDB.
func saveUsage(userid, ioType, model string, ioCosts CostResult) error {
	client, err := newDynamoClient()
	if err != nil {
		return err
	}
	tableName := getTableName()
	now := nowJST()
	dtm := fmtDTM25(now)

	platform := "amazon"
	if strings.HasPrefix(model, "gpt") {
		platform = "openai"
	}

	item := map[string]types.AttributeValue{
		"pk":        &types.AttributeValueMemberS{Value: "usage#" + userid},
		"sk":        &types.AttributeValueMemberS{Value: dtm},
		"dtype":     &types.AttributeValueMemberS{Value: "usage"},
		"io_type":   &types.AttributeValueMemberS{Value: ioType},
		"model":     &types.AttributeValueMemberS{Value: model},
		"platform":  &types.AttributeValueMemberS{Value: platform},
		"createdAt": &types.AttributeValueMemberS{Value: fmtDTM19(now)},
	}

	if ioType == "search" {
		item["search_count"] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%v", ioCosts["search_count"])}
		item["search_dollar"] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%v", ioCosts["search_dollar"])}
		item["search_yen"] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%v", ioCosts["search_yen"])}
		item["search_usage_point"] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%v", ioCosts["search_usage_point"])}
		item["dollar_1search"] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%.5f", SEARCH_PRICE[model])}
		item["yen_1dollar"] = &types.AttributeValueMemberN{Value: Yen1Dollar}
		item["point_1yen"] = &types.AttributeValueMemberN{Value: Point1Yen}
	} else {
		price := PRICE[model]
		var dollar1Token float64
		if ioType == "in" {
			dollar1Token = price.In
		} else {
			dollar1Token = price.Out
		}
		item["est_token"] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%v", ioCosts[ioType+"_token"])}
		item["est_dollar"] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%v", ioCosts[ioType+"_dollar"])}
		item["est_yen"] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%v", ioCosts[ioType+"_yen"])}
		item["usage_point"] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%v", ioCosts[ioType+"_usage_point"])}
		item["dollar_1token"] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%.5f", dollar1Token)}
		item["yen_1dollar"] = &types.AttributeValueMemberN{Value: Yen1Dollar}
		item["point_1yen"] = &types.AttributeValueMemberN{Value: Point1Yen}
	}

	_, err = client.PutItem(context.Background(), &dynamodb.PutItemInput{
		TableName:           &tableName,
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(pk) AND attribute_not_exists(sk)"),
	})
	return err
}

// usePoints deducts points from effective balances, consuming oldest first.
func usePoints(userid string, pointsToUse float64) error {
	if pointsToUse < 0 {
		return fmt.Errorf("usePoints: pointsToUse must not be negative: %f", pointsToUse)
	}

	client, err := newDynamoClient()
	if err != nil {
		return err
	}
	tableName := getTableName()
	nowStr := fmtDTM25(nowJST())

	// Get effective balances (positive, not expired)
	result, err := client.Query(context.Background(), &dynamodb.QueryInput{
		TableName:              &tableName,
		KeyConditionExpression: aws.String("pk = :pk AND sk > :sk"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: "pt#" + userid},
			":sk": &types.AttributeValueMemberS{Value: nowStr},
		},
		ScanIndexForward: aws.Bool(true),
	})
	if err != nil {
		return err
	}

	type balanceRecord struct {
		SK      string
		Balance float64
	}
	var effectiveBalances []balanceRecord
	for _, item := range result.Items {
		sk := item["sk"].(*types.AttributeValueMemberS).Value
		bal, _ := strconv.ParseFloat(item["balance"].(*types.AttributeValueMemberN).Value, 64)
		if bal > 0 {
			effectiveBalances = append(effectiveBalances, balanceRecord{SK: sk, Balance: bal})
		}
	}

	var transactItems []types.TransactWriteItem
	remaining := pointsToUse

	if len(effectiveBalances) == 0 {
		// No balance records — create one with negative balance
		now := nowJST()
		loc, _ := time.LoadLocation("Asia/Tokyo")
		expiryDate := fmtDTM25(now.In(loc).AddDate(1, 0, 0))
		nowDTM19 := fmtDTM19(now)
		logSK := expiryDate + "#" + fmtDTM25(nowJST())

		transactItems = append(transactItems, types.TransactWriteItem{
			Put: &types.Put{
				TableName: &tableName,
				Item: map[string]types.AttributeValue{
					"pk":        &types.AttributeValueMemberS{Value: "pt#" + userid},
					"sk":        &types.AttributeValueMemberS{Value: expiryDate},
					"balance":   &types.AttributeValueMemberN{Value: fmt.Sprintf("%f", -remaining)},
					"createdAt": &types.AttributeValueMemberS{Value: nowDTM19},
					"updatedAt": &types.AttributeValueMemberS{Value: nowDTM19},
				},
			},
		})
		transactItems = append(transactItems, types.TransactWriteItem{
			Put: &types.Put{
				TableName: &tableName,
				Item: map[string]types.AttributeValue{
					"pk":               &types.AttributeValueMemberS{Value: "ptlog#" + userid},
					"sk":               &types.AttributeValueMemberS{Value: logSK},
					"balance":          &types.AttributeValueMemberN{Value: fmt.Sprintf("%f", -remaining)},
					"additionalPoints": &types.AttributeValueMemberN{Value: fmt.Sprintf("%f", -remaining)},
					"createdAt":        &types.AttributeValueMemberS{Value: fmtDTM19(nowJST())},
				},
			},
		})
	}

	for i, eb := range effectiveBalances {
		isLast := i == len(effectiveBalances)-1

		if eb.Balance > remaining {
			// Deduct from this balance and stop
			newBalance := eb.Balance - remaining
			transactItems = appendUpdateBalance(transactItems, tableName, userid, eb.SK, eb.Balance, newBalance, -remaining)
			break
		} else if eb.Balance == remaining {
			// Delete this balance (becomes zero) and stop
			transactItems = appendDeleteBalance(transactItems, tableName, userid, eb.SK, eb.Balance)
			break
		} else {
			// Balance < remaining
			if isLast {
				// Last record: allow negative balance
				newBalance := eb.Balance - remaining
				transactItems = appendUpdateBalance(transactItems, tableName, userid, eb.SK, eb.Balance, newBalance, -remaining)
			} else {
				// Not last: delete this balance and continue
				transactItems = appendDeleteBalance(transactItems, tableName, userid, eb.SK, eb.Balance)
				remaining -= eb.Balance
			}
		}
	}

	_, err = client.TransactWriteItems(context.Background(), &dynamodb.TransactWriteItemsInput{
		TransactItems: transactItems,
	})
	return err
}

func appendUpdateBalance(items []types.TransactWriteItem, tableName, userid, sk string, origBalance, newBalance, additionalPoints float64) []types.TransactWriteItem {
	now := nowJST()
	logSK := sk + "#" + fmtDTM25(now)

	items = append(items, types.TransactWriteItem{
		Update: &types.Update{
			TableName: &tableName,
			Key: map[string]types.AttributeValue{
				"pk": &types.AttributeValueMemberS{Value: "pt#" + userid},
				"sk": &types.AttributeValueMemberS{Value: sk},
			},
			ConditionExpression: aws.String("balance = :orig_balance"),
			UpdateExpression:    aws.String("SET balance = :new_balance, updatedAt = :updatedAt"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":orig_balance": &types.AttributeValueMemberN{Value: fmt.Sprintf("%f", origBalance)},
				":new_balance":  &types.AttributeValueMemberN{Value: fmt.Sprintf("%f", newBalance)},
				":updatedAt":    &types.AttributeValueMemberS{Value: fmtDTM19(now)},
			},
		},
	})
	items = append(items, types.TransactWriteItem{
		Put: &types.Put{
			TableName: &tableName,
			Item: map[string]types.AttributeValue{
				"pk":               &types.AttributeValueMemberS{Value: "ptlog#" + userid},
				"sk":               &types.AttributeValueMemberS{Value: logSK},
				"balance":          &types.AttributeValueMemberN{Value: fmt.Sprintf("%f", newBalance)},
				"additionalPoints": &types.AttributeValueMemberN{Value: fmt.Sprintf("%f", additionalPoints)},
				"createdAt":        &types.AttributeValueMemberS{Value: fmtDTM19(now)},
			},
		},
	})
	return items
}

func appendDeleteBalance(items []types.TransactWriteItem, tableName, userid, sk string, origBalance float64) []types.TransactWriteItem {
	now := nowJST()
	logSK := sk + "#" + fmtDTM25(now)

	items = append(items, types.TransactWriteItem{
		Delete: &types.Delete{
			TableName: &tableName,
			Key: map[string]types.AttributeValue{
				"pk": &types.AttributeValueMemberS{Value: "pt#" + userid},
				"sk": &types.AttributeValueMemberS{Value: sk},
			},
			ConditionExpression: aws.String("balance = :orig_balance"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":orig_balance": &types.AttributeValueMemberN{Value: fmt.Sprintf("%f", origBalance)},
			},
		},
	})
	items = append(items, types.TransactWriteItem{
		Put: &types.Put{
			TableName: &tableName,
			Item: map[string]types.AttributeValue{
				"pk":               &types.AttributeValueMemberS{Value: "ptlog#" + userid},
				"sk":               &types.AttributeValueMemberS{Value: logSK},
				"balance":          &types.AttributeValueMemberN{Value: "0"},
				"additionalPoints": &types.AttributeValueMemberN{Value: fmt.Sprintf("%f", -origBalance)},
				"createdAt":        &types.AttributeValueMemberS{Value: fmtDTM19(now)},
			},
		},
	})
	return items
}

// accessDBRetry retries a function with backoff on transient DynamoDB errors.
func accessDBRetry(fn func() error) error {
	const maxAttempts = 3
	const waitTransaction = 100 * time.Millisecond
	const waitOther = 3 * time.Second

	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		lastErr = fn()
		if lastErr == nil {
			return nil
		}

		errStr := lastErr.Error()
		if strings.Contains(errStr, "TransactionCanceledException") {
			fmt.Println("TransactionCanceledException:", errStr)
			time.Sleep(waitTransaction)
		} else if strings.Contains(errStr, "ResourceNotFoundException") {
			fmt.Println("ResourceNotFoundException:", errStr)
			fmt.Println("Not retry.")
			break
		} else {
			fmt.Println("An unexpected error occurred:", lastErr)
			time.Sleep(waitOther)
		}
	}
	return fmt.Errorf("transaction failed after max attempts: %w", lastErr)
}
