package middleware

import (
	"net/http"
	"strings"

	"berani.id/api/internal/auth"
)

// Re-exported so handlers can read identity without importing auth directly.
const (
	CtxUserID = auth.CtxUserID
	CtxRole   = auth.CtxRole
)

// RequireAuth verifies the Bearer JWT and injects user id/role into the request context.
func RequireAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := bearer(r)
			if tokenStr == "" {
				http.Error(w, "missing token", http.StatusUnauthorized)
				return
			}
			claims, err := auth.Verify(secret, tokenStr)
			if err != nil {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r.WithContext(auth.WithIdentity(r.Context(), claims.UserID, claims.Role)))
		})
	}
}

// OptionalAuth attaches identity when a valid token is present but never rejects
// the request, so public content can show per-user progress when signed in.
func OptionalAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if tokenStr := bearer(r); tokenStr != "" {
				if claims, err := auth.Verify(secret, tokenStr); err == nil {
					r = r.WithContext(auth.WithIdentity(r.Context(), claims.UserID, claims.Role))
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireRole must be chained after RequireAuth.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !allowed[auth.Role(r)] {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func bearer(r *http.Request) string {
	return strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
}
