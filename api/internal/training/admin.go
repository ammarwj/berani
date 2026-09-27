package training

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

// Sama seperti education/admin.go: handler ini ada di package training supaya
// option.IsBest tetap unexported dan tidak bisa bocor lewat package lain.

type adminScenario struct {
	ID         string   `json:"id"`
	Prompt     string   `json:"prompt"`
	Category   string   `json:"category"`
	Options    []option `json:"options"`
	OrderIndex int      `json:"order_index"`
	Published  bool     `json:"published"`
}

func (h *Handler) AdminList(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, prompt, category, order_index, published
		FROM training_scenarios ORDER BY order_index, created_at`)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	scenarios := []adminScenario{}
	for rows.Next() {
		var s adminScenario
		if err := rows.Scan(&s.ID, &s.Prompt, &s.Category, &s.OrderIndex, &s.Published); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		scenarios = append(scenarios, s)
	}
	writeJSON(w, scenarios)
}

func (h *Handler) AdminGet(w http.ResponseWriter, r *http.Request) {
	var s adminScenario
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, prompt, category, options, order_index, published
		FROM training_scenarios WHERE id = $1`, r.PathValue("id"),
	).Scan(&s.ID, &s.Prompt, &s.Category, &s.Options, &s.OrderIndex, &s.Published)
	if err == pgx.ErrNoRows {
		http.Error(w, "skenario tidak ditemukan", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, s)
}

func (h *Handler) AdminCreate(w http.ResponseWriter, r *http.Request) {
	s, err := decodeScenario(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var id string
	if err := h.DB.QueryRow(r.Context(), `
		INSERT INTO training_scenarios (prompt, category, options, order_index, published)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		s.Prompt, s.Category, s.Options, s.OrderIndex, s.Published,
	).Scan(&id); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, map[string]string{"id": id})
}

func (h *Handler) AdminUpdate(w http.ResponseWriter, r *http.Request) {
	s, err := decodeScenario(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	tag, err := h.DB.Exec(r.Context(), `
		UPDATE training_scenarios
		SET prompt = $2, category = $3, options = $4, order_index = $5, published = $6
		WHERE id = $1`,
		r.PathValue("id"), s.Prompt, s.Category, s.Options, s.OrderIndex, s.Published)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "skenario tidak ditemukan", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func decodeScenario(r *http.Request) (adminScenario, error) {
	var s adminScenario
	s.Published = true
	s.Category = "umum"
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		return s, errors.New("permintaan tidak valid")
	}

	s.Prompt = strings.TrimSpace(s.Prompt)
	s.Category = strings.TrimSpace(s.Category)
	if s.Prompt == "" {
		return s, errors.New("situasi skenario wajib diisi")
	}
	if s.Category == "" {
		s.Category = "umum"
	}
	return s, validateOptions(s.Options)
}

// validateOptions menuntut tepat satu is_best. Kalau nol, SubmitAttempt selalu
// memberi score 0 dan skenarionya tidak akan pernah bisa dijawab benar — tanpa
// error di mana pun, jadi tidak akan ketahuan sampai ada siswa yang mengeluh.
func validateOptions(opts []option) error {
	if len(opts) < 2 {
		return errors.New("skenario butuh minimal 2 pilihan respons")
	}
	best := 0
	for _, o := range opts {
		if strings.TrimSpace(o.Label) == "" {
			return errors.New("pilihan respons tidak boleh kosong")
		}
		if strings.TrimSpace(o.Feedback) == "" {
			return errors.New("setiap pilihan butuh umpan balik untuk siswa")
		}
		if o.IsBest {
			best++
		}
	}
	if best != 1 {
		return errors.New("tandai tepat satu respons terbaik")
	}
	return nil
}

// AdminDeleteScenario menghapus permanen. Pasangan dari arsip
// (PATCH {"published": false}), yang tetap jalur default di UI karena
// training_attempts.scenario_id ON DELETE CASCADE (0001_init.sql:48): percobaan
// siswa ikut hangus, termasuk skornya, dan tidak ada salinannya.
//
// Tidak ada objek R2 yang perlu dibersihkan — beda dari materi, skenario hanya
// teks. Guru pendamping ikut boleh (router.go), sama seperti create/update.
func (h *Handler) AdminDeleteScenario(w http.ResponseWriter, r *http.Request) {
	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM training_scenarios WHERE id = $1`, r.PathValue("id"))
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "skenario tidak ditemukan", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type scenarioFootprint struct {
	Attempts int `json:"attempts"`
	Students int `json:"students"`
}

// AdminScenarioFootprint melaporkan apa yang akan hangus, supaya dialog
// konfirmasi menyebut angka sebenarnya alih-alih peringatan umum. Attempts dan
// students dihitung terpisah: training_attempts tidak punya unique constraint
// per (user, scenario), jadi satu siswa bisa mencoba berkali-kali dan jumlah
// baris bukan jumlah siswa.
func (h *Handler) AdminScenarioFootprint(w http.ResponseWriter, r *http.Request) {
	var f scenarioFootprint
	err := h.DB.QueryRow(r.Context(), `
		SELECT (SELECT count(*) FROM training_attempts WHERE scenario_id = s.id),
		       (SELECT count(DISTINCT user_id) FROM training_attempts WHERE scenario_id = s.id)
		FROM training_scenarios s WHERE s.id = $1`, r.PathValue("id"),
	).Scan(&f.Attempts, &f.Students)
	if err != nil {
		http.Error(w, "skenario tidak ditemukan", http.StatusNotFound)
		return
	}
	writeJSON(w, f)
}
