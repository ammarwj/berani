package auth

import (
	"context"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID string `json:"sub"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

type ctxKey string

// Context keys live here rather than in middleware so that package can import
// this one for token verification without a cycle.
const (
	CtxUserID ctxKey = "user_id"
	CtxRole   ctxKey = "role"
)

// WithIdentity attaches the verified user id and role to a request context.
func WithIdentity(ctx context.Context, userID, role string) context.Context {
	ctx = context.WithValue(ctx, CtxUserID, userID)
	return context.WithValue(ctx, CtxRole, role)
}

// UserID returns the authenticated user's id, or "" when unauthenticated.
func UserID(r *http.Request) string {
	id, _ := r.Context().Value(CtxUserID).(string)
	return id
}

func Role(r *http.Request) string {
	role, _ := r.Context().Value(CtxRole).(string)
	return role
}

func IssueTokens(secret, userID, role string) (access, refresh string, err error) {
	access, err = sign(secret, userID, role, 15*time.Minute)
	if err != nil {
		return "", "", err
	}
	refresh, err = sign(secret, userID, role, 7*24*time.Hour)
	if err != nil {
		return "", "", err
	}
	return access, refresh, nil
}

func sign(secret, userID, role string, ttl time.Duration) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func Verify(secret, tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, err
	}
	return claims, nil
}
