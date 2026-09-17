package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrInvalidToken = errors.New("token tidak valid atau sudah kedaluwarsa")

// issueToken returns the raw token to email out, storing only its SHA-256 hash
// so a database leak cannot be replayed to hijack accounts.
func issueToken(ctx context.Context, db *pgxpool.Pool, userID, purpose string, ttl time.Duration) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	raw := hex.EncodeToString(b)

	_, err := db.Exec(ctx,
		`INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at) VALUES ($1, $2, $3, $4)`,
		hashToken(raw), userID, purpose, time.Now().Add(ttl),
	)
	if err != nil {
		return "", err
	}
	return raw, nil
}

// consumeToken validates and single-use-marks a token, returning its user id.
func consumeToken(ctx context.Context, db *pgxpool.Pool, raw, purpose string) (string, error) {
	var userID string
	err := db.QueryRow(ctx,
		`UPDATE auth_tokens SET used_at = now()
		 WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
		 RETURNING user_id`,
		hashToken(raw), purpose,
	).Scan(&userID)
	if err == pgx.ErrNoRows {
		return "", ErrInvalidToken
	}
	if err != nil {
		return "", err
	}
	return userID, nil
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
