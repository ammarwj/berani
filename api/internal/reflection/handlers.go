package reflection

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"berani.id/api/internal/crypto"
	"berani.id/api/internal/middleware"
)

type Handler struct {
	DB     *pgxpool.Pool
	Cipher *crypto.Cipher
}

// Guided prompts from PRD §5.2. Rotated by day so the question feels fresh.
var prompts = []string{
	"Apakah hari ini kamu merasa aman di sekolah?",
	"Adakah hal kecil hari ini yang membuatmu tersenyum?",
	"Apakah ada yang membuatmu merasa tidak nyaman hari ini?",
	"Siapa orang yang membuatmu merasa didukung minggu ini?",
	"Kalau boleh mengubah satu hal dari hari ini, apa yang kamu ubah?",
	"Apa yang kamu syukuri hari ini?",
	"Bagaimana kamu memperlakukan dirimu sendiri hari ini?",
}

func (h *Handler) Prompt(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"prompt": prompts[time.Now().YearDay()%len(prompts)]})
}

type entryInput struct {
	Mood    string `json:"mood"`
	Content string `json:"content"`
	Prompt  string `json:"prompt"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)

	var in entryInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Mood == "" {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}

	stored, err := h.Cipher.Encrypt(in.Content)
	if err != nil {
		log.Printf("encrypt reflection: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if _, err := h.DB.Exec(r.Context(),
		`INSERT INTO reflections (user_id, mood, content_encrypted, prompt) VALUES ($1, $2, $3, $4)`,
		userID, in.Mood, stored, in.Prompt,
	); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// List returns only the caller's own entries — reflections are private per PRD §5.2.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)

	rows, err := h.DB.Query(r.Context(),
		`SELECT id, mood, content_encrypted, prompt, created_at
		 FROM reflections WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`, userID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type item struct {
		ID        string    `json:"id"`
		Mood      string    `json:"mood"`
		Content   string    `json:"content"`
		Prompt    string    `json:"prompt"`
		CreatedAt time.Time `json:"created_at"`
	}

	items := []item{}
	for rows.Next() {
		var it item
		var stored string
		if err := rows.Scan(&it.ID, &it.Mood, &stored, &it.Prompt, &it.CreatedAt); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		plain, err := h.Cipher.Decrypt(stored)
		if err != nil {
			// Don't fail the whole history if one row can't be read.
			log.Printf("decrypt reflection %s: %v", it.ID, err)
			plain = ""
		}
		it.Content = plain
		items = append(items, it)
	}
	writeJSON(w, items)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)

	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM reflections WHERE id = $1 AND user_id = $2`, r.PathValue("id"), userID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "tidak ditemukan", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Moods returns the last 30 days of mood history for the tracker chart.
func (h *Handler) Moods(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)

	rows, err := h.DB.Query(r.Context(),
		`SELECT mood, created_at FROM reflections
		 WHERE user_id = $1 AND created_at > now() - interval '30 days'
		 ORDER BY created_at`, userID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type point struct {
		Mood      string    `json:"mood"`
		CreatedAt time.Time `json:"created_at"`
	}
	points := []point{}
	for rows.Next() {
		var p point
		if err := rows.Scan(&p.Mood, &p.CreatedAt); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		points = append(points, p)
	}
	writeJSON(w, points)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
