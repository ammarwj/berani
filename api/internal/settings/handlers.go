// Package settings menyimpan konfigurasi milik sekolah — identitas, kontak, dan
// kanal lapor. Berbeda dari config.Config yang berasal dari env var dan tidak
// bisa berubah saat runtime: yang di sini diedit super admin lewat UI.
package settings

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"berani.id/api/internal/middleware"
)

type Handler struct{ DB *pgxpool.Pool }

type Category struct {
	Value string `json:"value"`
	Icon  string `json:"icon"`
	Label string `json:"label"`
	Desc  string `json:"desc"`
}

type Settings struct {
	SchoolName       string     `json:"school_name"`
	HotlineLabel     string     `json:"hotline_label"`
	HotlinePhone     string     `json:"hotline_phone"`
	AnonymousEnabled bool       `json:"anonymous_enabled"`
	ReportCategories []Category `json:"report_categories"`

	// Kontak guru BK hanya ikut untuk permintaan yang membawa token: nama dan
	// nomor staf sekolah tidak perlu terbaca siapa pun di internet.
	BKName  string `json:"bk_name,omitempty"`
	BKPhone string `json:"bk_phone,omitempty"`
}

// Fetch reads the single settings row. report.Submit uses it to enforce the
// anonymous switch and the category list server-side.
func Fetch(ctx context.Context, db *pgxpool.Pool) (Settings, error) {
	var s Settings
	err := db.QueryRow(ctx, `
		SELECT school_name, bk_name, bk_phone, hotline_label, hotline_phone,
		       anonymous_enabled, report_categories
		FROM app_settings WHERE id = 1`,
	).Scan(&s.SchoolName, &s.BKName, &s.BKPhone, &s.HotlineLabel, &s.HotlinePhone,
		&s.AnonymousEnabled, &s.ReportCategories)
	return s, err
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	s, err := Fetch(r.Context(), h.DB)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if userID, _ := r.Context().Value(middleware.CtxUserID).(string); userID == "" {
		s.BKName, s.BKPhone = "", ""
	}
	writeJSON(w, s)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	var s Settings
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}

	s.SchoolName = strings.TrimSpace(s.SchoolName)
	if s.SchoolName == "" {
		http.Error(w, "nama sekolah wajib diisi", http.StatusBadRequest)
		return
	}
	if err := validateCategories(s.ReportCategories); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if _, err := h.DB.Exec(r.Context(), `
		UPDATE app_settings
		SET school_name = $1, bk_name = $2, bk_phone = $3, hotline_label = $4,
		    hotline_phone = $5, anonymous_enabled = $6, report_categories = $7,
		    updated_at = now()
		WHERE id = 1`,
		s.SchoolName, strings.TrimSpace(s.BKName), strings.TrimSpace(s.BKPhone),
		strings.TrimSpace(s.HotlineLabel), strings.TrimSpace(s.HotlinePhone),
		s.AnonymousEnabled, s.ReportCategories,
	); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// validateCategories menjaga form lapor tetap bisa dipakai: daftar kosong
// membuat siswa tidak punya satu pun kategori untuk dipilih.
func validateCategories(cats []Category) error {
	if len(cats) == 0 {
		return errors.New("minimal satu kategori laporan harus ada")
	}
	seen := map[string]bool{}
	for _, c := range cats {
		if strings.TrimSpace(c.Value) == "" || strings.TrimSpace(c.Label) == "" {
			return errors.New("kode dan nama kategori wajib diisi")
		}
		if seen[c.Value] {
			return errors.New("kode kategori tidak boleh sama: " + c.Value)
		}
		seen[c.Value] = true
	}
	return nil
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
