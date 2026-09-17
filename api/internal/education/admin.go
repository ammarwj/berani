package education

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

// Handler admin sengaja ada di package ini, bukan package admin tersendiri:
// quizQuestion.CorrectIndex tetap unexported, jadi kompiler yang menjamin tidak
// ada package lain yang bisa memarshal kunci jawaban ke respons siswa.
// Di sini kunci itu memang dikirim — admin yang mengeditnya.

var validContentTypes = map[string]bool{"article": true, "video": true, "infographic": true}

type adminModule struct {
	ID          string         `json:"id"`
	Title       string         `json:"title"`
	Category    string         `json:"category"`
	ContentType string         `json:"content_type"`
	Summary     string         `json:"summary"`
	Body        string         `json:"body"`
	Quiz        []quizQuestion `json:"quiz"`
	OrderIndex  int            `json:"order_index"`
	Published   bool           `json:"published"`
}

// AdminList returns every module, archived ones included, without the progress join.
func (h *Handler) AdminList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, title, category, content_type, summary, order_index, published
		FROM education_modules ORDER BY order_index, created_at`)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	modules := []adminModule{}
	for rows.Next() {
		var m adminModule
		if err := rows.Scan(&m.ID, &m.Title, &m.Category, &m.ContentType, &m.Summary, &m.OrderIndex, &m.Published); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		modules = append(modules, m)
	}
	writeJSON(w, modules)
}

func (h *Handler) AdminGet(w http.ResponseWriter, r *http.Request) {
	var m adminModule
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, title, category, content_type, summary, body, quiz, order_index, published
		FROM education_modules WHERE id = $1`, r.PathValue("id"),
	).Scan(&m.ID, &m.Title, &m.Category, &m.ContentType, &m.Summary, &m.Body, &m.Quiz, &m.OrderIndex, &m.Published)
	if err == pgx.ErrNoRows {
		http.Error(w, "materi tidak ditemukan", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if m.Quiz == nil {
		m.Quiz = []quizQuestion{}
	}
	writeJSON(w, m)
}

func (h *Handler) AdminCreate(w http.ResponseWriter, r *http.Request) {
	m, err := decodeModule(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var id string
	if err := h.DB.QueryRow(r.Context(), `
		INSERT INTO education_modules (title, category, content_type, summary, body, quiz, order_index, published)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
		m.Title, m.Category, m.ContentType, m.Summary, m.Body, m.Quiz, m.OrderIndex, m.Published,
	).Scan(&id); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, map[string]string{"id": id})
}

func (h *Handler) AdminUpdate(w http.ResponseWriter, r *http.Request) {
	m, err := decodeModule(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	tag, err := h.DB.Exec(r.Context(), `
		UPDATE education_modules
		SET title = $2, category = $3, content_type = $4, summary = $5,
		    body = $6, quiz = $7, order_index = $8, published = $9
		WHERE id = $1`,
		r.PathValue("id"), m.Title, m.Category, m.ContentType, m.Summary, m.Body, m.Quiz, m.OrderIndex, m.Published)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "materi tidak ditemukan", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// decodeModule parses and validates a full module body. Create and update send
// the same shape, so they share one path.
func decodeModule(r *http.Request) (adminModule, error) {
	var m adminModule
	// Published defaults true so a create that omits the field publishes,
	// matching the column default.
	m.Published = true
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		return m, errors.New("permintaan tidak valid")
	}

	m.Title = strings.TrimSpace(m.Title)
	m.Category = strings.TrimSpace(m.Category)
	m.Summary = strings.TrimSpace(m.Summary)
	if m.Title == "" || m.Category == "" {
		return m, errors.New("judul dan kategori wajib diisi")
	}
	if !validContentTypes[m.ContentType] {
		return m, errors.New("tipe konten harus article, video, atau infographic")
	}
	if m.Quiz == nil {
		m.Quiz = []quizQuestion{}
	}
	return m, validateQuiz(m.Quiz)
}

// validateQuiz rejects quizzes that would be unanswerable or misgraded. An
// out-of-range correct_index silently marks every attempt wrong, and gradeQuiz
// has no way to report that back.
func validateQuiz(quiz []quizQuestion) error {
	for _, q := range quiz {
		if strings.TrimSpace(q.Question) == "" {
			return errors.New("setiap soal kuis harus punya pertanyaan")
		}
		if len(q.Options) < 2 {
			return errors.New("setiap soal kuis butuh minimal 2 pilihan")
		}
		for _, o := range q.Options {
			if strings.TrimSpace(o) == "" {
				return errors.New("pilihan jawaban tidak boleh kosong")
			}
		}
		if q.CorrectIndex < 0 || q.CorrectIndex >= len(q.Options) {
			return errors.New("kunci jawaban menunjuk pilihan yang tidak ada")
		}
	}
	return nil
}
