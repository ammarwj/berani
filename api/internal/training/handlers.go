package training

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"berani.id/api/internal/middleware"
)

type Handler struct{ DB *pgxpool.Pool }

type option struct {
	Label    string `json:"label"`
	Feedback string `json:"feedback"`
	IsBest   bool   `json:"is_best"`
}

// publicOption hides which answer is best so the client cannot pre-reveal it.
type publicOption struct {
	Label string `json:"label"`
}

type scenario struct {
	ID       string         `json:"id"`
	Prompt   string         `json:"prompt"`
	Category string         `json:"category"`
	Options  []publicOption `json:"options"`
}

func (h *Handler) ListScenarios(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(),
		`SELECT id, prompt, category, options FROM training_scenarios
		 WHERE published ORDER BY order_index, created_at`)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	scenarios := []scenario{}
	for rows.Next() {
		var s scenario
		var opts []option
		if err := rows.Scan(&s.ID, &s.Prompt, &s.Category, &opts); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		for _, o := range opts {
			s.Options = append(s.Options, publicOption{Label: o.Label})
		}
		scenarios = append(scenarios, s)
	}
	writeJSON(w, scenarios)
}

// SubmitAttempt scores on the server and returns the feedback for the chosen
// option, so the correct answer is never sent to the client in advance.
func (h *Handler) SubmitAttempt(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)

	var body struct {
		ScenarioID  string `json:"scenario_id"`
		ChosenIndex int    `json:"chosen_index"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ScenarioID == "" {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}

	var opts []option
	err := h.DB.QueryRow(r.Context(),
		`SELECT options FROM training_scenarios WHERE id = $1 AND published`, body.ScenarioID).Scan(&opts)
	if err == pgx.ErrNoRows {
		http.Error(w, "skenario tidak ditemukan", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if body.ChosenIndex < 0 || body.ChosenIndex >= len(opts) {
		http.Error(w, "pilihan tidak valid", http.StatusBadRequest)
		return
	}

	chosen := opts[body.ChosenIndex]
	score := 0
	if chosen.IsBest {
		score = 1
	}

	if _, err := h.DB.Exec(r.Context(),
		`INSERT INTO training_attempts (user_id, scenario_id, score, chosen_index) VALUES ($1, $2, $3, $4)`,
		userID, body.ScenarioID, score, body.ChosenIndex,
	); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"feedback": chosen.Feedback,
		"is_best":  chosen.IsBest,
	})
}

// Progress reports how many scenarios the user has answered well.
func (h *Handler) Progress(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)

	// Skenario terarsip keluar dari hitungan, sama alasannya dengan education.Progress.
	var total, attempted, best int
	err := h.DB.QueryRow(r.Context(), `
		SELECT (SELECT count(*) FROM training_scenarios WHERE published),
		       (SELECT count(DISTINCT a.scenario_id) FROM training_attempts a
		        JOIN training_scenarios s ON s.id = a.scenario_id AND s.published
		        WHERE a.user_id = $1),
		       (SELECT count(DISTINCT a.scenario_id) FROM training_attempts a
		        JOIN training_scenarios s ON s.id = a.scenario_id AND s.published
		        WHERE a.user_id = $1 AND a.score = 1)`,
		userID).Scan(&total, &attempted, &best)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]int{"total": total, "attempted": attempted, "best": best})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
