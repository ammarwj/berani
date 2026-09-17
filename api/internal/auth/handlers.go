package auth

import (
	"encoding/json"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"berani.id/api/internal/mailer"
)

const minPasswordLen = 8

type Handler struct {
	DB         *pgxpool.Pool
	JWTSecret  string
	Mailer     *mailer.Mailer
	AppBaseURL string
}

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	Role         string `json:"role"`
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}
	c.Email = strings.TrimSpace(strings.ToLower(c.Email))
	if _, err := mail.ParseAddress(c.Email); err != nil {
		http.Error(w, "format email tidak valid", http.StatusBadRequest)
		return
	}
	if len(c.Password) < minPasswordLen {
		http.Error(w, "password minimal 8 karakter", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(c.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var userID, role string
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, role`,
		c.Email, string(hash),
	).Scan(&userID, &role)
	if err != nil {
		http.Error(w, "email sudah terdaftar", http.StatusConflict)
		return
	}

	h.sendVerificationEmail(r, userID, c.Email)
	h.respondWithTokens(w, userID, role)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}
	c.Email = strings.TrimSpace(strings.ToLower(c.Email))

	var userID, role, hash string
	var active bool
	err := h.DB.QueryRow(r.Context(),
		`SELECT id, role, password_hash, is_active FROM users WHERE email = $1`, c.Email,
	).Scan(&userID, &role, &hash, &active)
	if err == pgx.ErrNoRows {
		// Hash anyway so a missing account and a wrong password take similar time.
		bcrypt.CompareHashAndPassword([]byte("$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv"), []byte(c.Password))
		http.Error(w, "email atau password salah", http.StatusUnauthorized)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(c.Password)) != nil {
		http.Error(w, "email atau password salah", http.StatusUnauthorized)
		return
	}
	// Dicek setelah bcrypt, bukan lewat `AND is_active` di query: pesan tersendiri
	// hanya boleh terlihat oleh yang sudah membuktikan tahu passwordnya, supaya
	// endpoint ini tidak jadi alat menebak akun mana yang ada.
	if !active {
		http.Error(w, "akun dinonaktifkan, hubungi guru BK", http.StatusUnauthorized)
		return
	}

	h.respondWithTokens(w, userID, role)
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}

	claims, err := Verify(h.JWTSecret, body.RefreshToken)
	if err != nil {
		http.Error(w, "token tidak valid", http.StatusUnauthorized)
		return
	}

	// Re-read the role so a revoked or changed role cannot be carried forward
	// indefinitely by refreshing an old token. Akun nonaktif berhenti di sini juga:
	// tidak ada blocklist token, jadi akses tertahan paling lama selama TTL access
	// token yang sudah terlanjur dipegang.
	var role string
	if err := h.DB.QueryRow(r.Context(),
		`SELECT role FROM users WHERE id = $1 AND is_active`, claims.UserID,
	).Scan(&role); err != nil {
		http.Error(w, "token tidak valid", http.StatusUnauthorized)
		return
	}

	h.respondWithTokens(w, claims.UserID, role)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userID := UserID(r)

	var email, role string
	var verified bool
	err := h.DB.QueryRow(r.Context(),
		`SELECT email, role, email_verified FROM users WHERE id = $1`, userID,
	).Scan(&email, &role, &verified)
	if err != nil {
		http.Error(w, "tidak ditemukan", http.StatusNotFound)
		return
	}

	writeJSON(w, map[string]any{"email": email, "role": role, "email_verified": verified})
}

func (h *Handler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}

	userID, err := consumeToken(r.Context(), h.DB, body.Token, "verify_email")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if _, err := h.DB.Exec(r.Context(), `UPDATE users SET email_verified = TRUE WHERE id = $1`, userID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ForgotPassword always reports success so the endpoint cannot be used to
// discover which email addresses have accounts.
func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}
	email := strings.TrimSpace(strings.ToLower(body.Email))

	var userID string
	err := h.DB.QueryRow(r.Context(), `SELECT id FROM users WHERE email = $1`, email).Scan(&userID)
	if err == nil {
		if token, err := issueToken(r.Context(), h.DB, userID, "reset_password", time.Hour); err == nil {
			h.mail(email, "Atur ulang password BERANI",
				"Buka tautan berikut untuk mengatur ulang passwordmu (berlaku 1 jam):\n\n"+
					h.AppBaseURL+"/reset-password?token="+token+
					"\n\nAbaikan email ini jika kamu tidak meminta perubahan password.")
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}
	if len(body.Password) < minPasswordLen {
		http.Error(w, "password minimal 8 karakter", http.StatusBadRequest)
		return
	}

	userID, err := consumeToken(r.Context(), h.DB, body.Token, "reset_password")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if _, err := h.DB.Exec(r.Context(), `UPDATE users SET password_hash = $1 WHERE id = $2`, string(hash), userID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) sendVerificationEmail(r *http.Request, userID, email string) {
	token, err := issueToken(r.Context(), h.DB, userID, "verify_email", 24*time.Hour)
	if err != nil {
		log.Printf("issue verification token: %v", err)
		return
	}
	h.mail(email, "Verifikasi email BERANI",
		"Selamat datang di BERANI!\n\nKlik tautan berikut untuk memverifikasi emailmu (berlaku 24 jam):\n\n"+
			h.AppBaseURL+"/verify-email?token="+token)
}

func (h *Handler) mail(to, subject, body string) {
	if h.Mailer == nil {
		return
	}
	if err := h.Mailer.Send(to, subject, body); err != nil {
		log.Printf("send mail to %s: %v", to, err)
	}
}

func (h *Handler) respondWithTokens(w http.ResponseWriter, userID, role string) {
	access, refresh, err := IssueTokens(h.JWTSecret, userID, role)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, tokenResponse{AccessToken: access, RefreshToken: refresh, Role: role})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
