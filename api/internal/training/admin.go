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
	MediaURL   string   `json:"media_url"`
	MediaKind  string   `json:"media_kind"`
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
		SELECT id, prompt, category, media_url, media_kind, options, order_index, published
		FROM training_scenarios WHERE id = $1`, r.PathValue("id"),
	).Scan(&s.ID, &s.Prompt, &s.Category, &s.MediaURL, &s.MediaKind, &s.Options, &s.OrderIndex, &s.Published)
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
		INSERT INTO training_scenarios (prompt, category, media_url, media_kind, options, order_index, published)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		s.Prompt, s.Category, s.MediaURL, s.MediaKind, s.Options, s.OrderIndex, s.Published,
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
		SET prompt = $2, category = $3, media_url = $4, media_kind = $5,
		    options = $6, order_index = $7, published = $8
		WHERE id = $1`,
		r.PathValue("id"), s.Prompt, s.Category, s.MediaURL, s.MediaKind,
		s.Options, s.OrderIndex, s.Published)
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
	if err := normalizeMedia(&s); err != nil {
		return s, err
	}
	return s, validateOptions(s.Options)
}

// Skema yang sama dengan renderer siswa (web/lib/markdown.ts): hanya http(s).
// data: tidak termasuk — satu baris base64 besar di kolom ini akan ikut terkirim
// di setiap GET /training/scenarios, ke seluruh siswa, selamanya.
// "/uploads/materi/…" adalah keluaran UploadImage/UploadVideo sendiri, disimpan
// relatif supaya pindah host tidak mematikan media yang sudah terunggah — dan
// supaya uploadKey() di bawah bisa menemukan objeknya saat skenario dihapus.
func mediaScheme(u string) bool {
	l := strings.ToLower(u)
	return strings.HasPrefix(l, "http://") ||
		strings.HasPrefix(l, "https://") ||
		strings.HasPrefix(u, uploadPrefix)
}

const uploadPrefix = "/uploads/materi/"

// uploadKey menerjemahkan media_url jadi object key R2, atau "" kalau medianya
// bukan milik bucket ini (URL eksternal, YouTube). Pasangan dari
// education.uploadKeys, dan batas yang sama: Delete atas key asing tidak pernah
// benar, dan satu positif palsu di sini menghapus lampiran laporan siswa.
//
// Prefix dicari di mana saja, bukan hanya di awal: editor menyimpan alamat
// penuh (`${API_URL}/uploads/materi/…`), sementara materi lama bisa relatif.
// Hanya prefix "materi/" yang pernah dikembalikan — "laporan/" tidak punya
// jalan masuk ke sini.
func uploadKey(mediaURL string) string {
	i := strings.Index(mediaURL, uploadPrefix)
	if i < 0 {
		return ""
	}
	name := mediaURL[i+len(uploadPrefix):]
	if name == "" || strings.ContainsAny(name, " ?#/") {
		return ""
	}
	return "materi/" + name
}

// normalizeMedia menjaga pasangan url+kind tetap konsisten. Kind yang tidak
// dikenal ditolak, bukan dibersihkan diam-diam: halaman siswa memilih elemen
// (<img>/<video>/<iframe>) dari kolom ini, jadi nilai asing berarti media yang
// terunggah tidak pernah muncul dan guru tidak diberi tahu kenapa.
func normalizeMedia(s *adminScenario) error {
	s.MediaURL = strings.TrimSpace(s.MediaURL)
	s.MediaKind = strings.TrimSpace(s.MediaKind)
	if s.MediaURL == "" {
		s.MediaKind = ""
		return nil
	}
	if !mediaScheme(s.MediaURL) {
		return errors.New("alamat media harus diawali http:// atau https://")
	}
	switch s.MediaKind {
	case "image", "video", "youtube":
		return nil
	default:
		return errors.New("jenis media tidak dikenali")
	}
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
// Media skenario yang diunggah ke R2 ikut dihapus — sama alasannya dengan
// gambar isi materi di education.AdminDeleteModule: setelah barisnya hilang
// tidak ada lagi yang merujuk objek itu, jadi tidak akan pernah ada yang
// membersihkannya nanti. Kegagalan Delete tidak membatalkan penghapusan: objek
// yatim hanya memakan storage, sementara melaporkan gagal setelah DELETE
// berhasil membuat admin mengulang pada skenario yang sudah hilang.
//
// Guru pendamping ikut boleh (router.go), sama seperti create/update.
func (h *Handler) AdminDeleteScenario(w http.ResponseWriter, r *http.Request) {
	var mediaURL string
	err := h.DB.QueryRow(r.Context(),
		`DELETE FROM training_scenarios WHERE id = $1 RETURNING media_url`,
		r.PathValue("id")).Scan(&mediaURL)
	if err == pgx.ErrNoRows {
		http.Error(w, "skenario tidak ditemukan", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if h.Storage != nil {
		if key := uploadKey(mediaURL); key != "" {
			h.Storage.Delete(r.Context(), key)
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

type scenarioFootprint struct {
	Attempts int `json:"attempts"`
	Students int `json:"students"`
	// Media terunggah yang ikut hangus: 0 atau 1 (satu media per skenario),
	// tapi tetap angka supaya dialognya memakai pola yang sama dengan materi.
	Media int `json:"media"`
}

// AdminScenarioFootprint melaporkan apa yang akan hangus, supaya dialog
// konfirmasi menyebut angka sebenarnya alih-alih peringatan umum. Attempts dan
// students dihitung terpisah: training_attempts tidak punya unique constraint
// per (user, scenario), jadi satu siswa bisa mencoba berkali-kali dan jumlah
// baris bukan jumlah siswa.
func (h *Handler) AdminScenarioFootprint(w http.ResponseWriter, r *http.Request) {
	var f scenarioFootprint
	var mediaURL string
	err := h.DB.QueryRow(r.Context(), `
		SELECT s.media_url,
		       (SELECT count(*) FROM training_attempts WHERE scenario_id = s.id),
		       (SELECT count(DISTINCT user_id) FROM training_attempts WHERE scenario_id = s.id)
		FROM training_scenarios s WHERE s.id = $1`, r.PathValue("id"),
	).Scan(&mediaURL, &f.Attempts, &f.Students)
	if err != nil {
		http.Error(w, "skenario tidak ditemukan", http.StatusNotFound)
		return
	}
	if uploadKey(mediaURL) != "" {
		f.Media = 1
	}
	writeJSON(w, f)
}
