package main

import (
	"context"
	"fmt"
	"os"

	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jwt"
)

const region = "ap-northeast-1"

func validateToken(token string, dtm string) (map[string]interface{}, error) {
	userPoolID := os.Getenv("USER_POOL_ID")
	issuer := fmt.Sprintf("https://cognito-idp.%s.amazonaws.com/%s", region, userPoolID)
	jwksURL := issuer + "/.well-known/jwks.json"

	ctx := context.Background()
	keySet, err := jwk.Fetch(ctx, jwksURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
	}

	parsedToken, err := jwt.Parse([]byte(token),
		jwt.WithKeySet(keySet),
		jwt.WithIssuer(issuer),
		jwt.WithValidate(true),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to validate token: %w", err)
	}

	claims := parsedToken.PrivateClaims()
	allClaims := map[string]interface{}{
		"sub": parsedToken.Subject(),
	}
	for k, v := range claims {
		allClaims[k] = v
	}

	// Check cognito:groups contains "active"
	groups, ok := allClaims["cognito:groups"]
	if !ok {
		return map[string]interface{}{
			"success": false,
			"error-response": map[string]interface{}{
				"error": "permission denied",
				"dtm":   dtm,
			},
		}, nil
	}

	groupList, ok := groups.([]interface{})
	if !ok {
		return map[string]interface{}{
			"success": false,
			"error-response": map[string]interface{}{
				"error": "permission denied",
				"dtm":   dtm,
			},
		}, nil
	}

	for _, g := range groupList {
		if gs, ok := g.(string); ok && gs == "active" {
			return map[string]interface{}{
				"success":      true,
				"access_token": allClaims,
			}, nil
		}
	}

	return map[string]interface{}{
		"success": false,
		"error-response": map[string]interface{}{
			"error": "permission denied",
			"dtm":   dtm,
		},
	}, nil
}
