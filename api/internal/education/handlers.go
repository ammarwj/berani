package education

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"berani.id/api/internal/middleware"
	"berani.id/api/internal/storage"
)

type Handler struct {
	DB      *pgxpool.Pool
	Storage *storage.Storage
}

type module struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Category    string       `json:"category"`
	ContentType string       `json:"content_type"`
	Summary     string       `json:"summary"`
	Body        string       `json:"body,omitempty"`
	Quiz        []publicQuiz `json:"quiz,omitempty"`
	Completed   bool         `json:"completed"`
	QuizScore   *int         `json:"quiz_score,omitempty"`
}

type quizQuestion struct {
	Question     string   `json:"question"`
	Options      []string `json:"options"`
	CorrectIndex int      `json:"correct_index"`
}

// publicQuiz is what the client receives: the answer key stays on the server so
// the quiz cannot be passed by reading the response.
type publicQuiz struct {
	Question string   `json:"question"`
	Options  []string `json:"options"`
}

// List returns all modules. When the request carries a valid token, each module
// also reports that user's progress.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)

	rows, err := h.DB.Query(r.Context(), `
		SELECT m.id, m.title, m.category, m.content_type, m.summary,
		       p.completed_at IS NOT NULL AS completed, p.quiz_score
		FROM education_modules m
		LEFT JOIN education_progress p ON p.module_id = m.id AND p.user_id = $1::uuid
		WHERE m.published
		ORDER BY m.order_index, m.created_at`,
		nullableUUID(userID))
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	modules := []module{}
	for rows.Next() {
		var m module
		if err := rows.Scan(&m.ID, &m.Title, &m.Category, &m.ContentType, &m.Summary, &m.Completed, &m.QuizScore); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		modules = append(modules, m)
	}
	writeJSON(w, modules)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)

	var m module
	var quiz []quizQuestion
	err := h.DB.QueryRow(r.Context(), `
		SELECT m.id, m.title, m.category, m.content_type, m.summary, m.body, m.quiz,
		       p.completed_at IS NOT NULL AS completed, p.quiz_score
		FROM education_modules m
		LEFT JOIN education_progress p ON p.module_id = m.id AND p.user_id = $2::uuid
		WHERE m.id = $1 AND m.published`,
		r.PathValue("id"), nullableUUID(userID),
	).Scan(&m.ID, &m.Title, &m.Category, &m.ContentType, &m.Summary, &m.Body, &quiz, &m.Completed, &m.QuizScore)
	if err == pgx.ErrNoRows {
		http.Error(w, "materi tidak ditemukan", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	for _, q := range quiz {
		m.Quiz = append(m.Quiz, publicQuiz{Question: q.Question, Options: q.Options})
	}
	writeJSON(w, m)
}

// Complete marks a module finished. The quiz is graded here from the submitted
// answers — the client never sees the key and never supplies the score.
func (h *Handler) Complete(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)
	moduleID := r.PathValue("id")

	var body struct {
		Answers []int `json:"answers"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	var quiz []quizQuestion
	if err := h.DB.QueryRow(r.Context(),
		`SELECT quiz FROM education_modules WHERE id = $1 AND published`, moduleID).Scan(&quiz); err != nil {
		http.Error(w, "materi tidak ditemukan", http.StatusNotFound)
		return
	}

	score := gradeQuiz(quiz, body.Answers)

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO education_progress (user_id, module_id, completed_at, quiz_score)
		VALUES ($1, $2, now(), $3)
		ON CONFLICT (user_id, module_id) DO UPDATE
		SET completed_at = now(),
		    quiz_score = GREATEST(COALESCE(education_progress.quiz_score, -1), COALESCE(EXCLUDED.quiz_score, -1)),
		    updated_at = now()`,
		userID, moduleID, score)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"quiz_score": score})
}

// Progress powers the gamification badge: modules completed out of the total.
func (h *Handler) Progress(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)

	// Materi terarsip keluar dari pembilang maupun penyebut: barisan progresnya
	// tetap tersimpan, tapi kalau ikut dihitung, total jadi lebih besar dari yang
	// bisa dikerjakan siswa dan badge "Sahabat BERANI" tak pernah tercapai.
	var total, completed int
	err := h.DB.QueryRow(r.Context(), `
		SELECT (SELECT count(*) FROM education_modules WHERE published),
		       (SELECT count(*) FROM education_progress p
		        JOIN education_modules m ON m.id = p.module_id AND m.published
		        WHERE p.user_id = $1 AND p.completed_at IS NOT NULL)`,
		userID).Scan(&total, &completed)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"total":     total,
		"completed": completed,
		"badge":     badgeFor(completed, total),
	})
}

// gradeQuiz scores answers against the key as a percentage. Returns nil when
// there is nothing to grade, so a module without a quiz records no score.
func gradeQuiz(quiz []quizQuestion, answers []int) *int {
	if len(quiz) == 0 || len(answers) == 0 {
		return nil
	}
	correct := 0
	for i, q := range quiz {
		if i < len(answers) && answers[i] == q.CorrectIndex {
			correct++
		}
	}
	pct := correct * 100 / len(quiz)
	return &pct
}

func badgeFor(completed, total int) string {
	switch {
	case total > 0 && completed >= total:
		return "Sahabat BERANI"
	case completed >= 3:
		return "Penjaga Teman"
	case completed >= 1:
		return "Pemula Berani"
	default:
		return ""
	}
}

// nullableUUID keeps the LEFT JOIN valid for anonymous (unauthenticated) reads,
// where there is no user id to match progress against.
func nullableUUID(id string) any {
	if id == "" {
		return nil
	}
	return id
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
