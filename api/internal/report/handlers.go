package report

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"berani.id/api/internal/middleware"
	"berani.id/api/internal/settings"
	"berani.id/api/internal/storage"
)

const (
	maxAttachmentSize = 10 << 20 // 10 MB
	signedURLTTL      = 15 * time.Minute
)

var allowedContentTypes = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/webp":      true,
	"application/pdf": true,
}

var validStatuses = map[string]bool{
	"diterima": true, "diproses": true, "ditindaklanjuti": true, "selesai": true,
}

type Handler struct {
	DB      *pgxpool.Pool
	Storage *storage.Storage
}

type submission struct {
	Category    string `json:"category"`
	Description string `json:"description"`
	Location    string `json:"location"`
	Involved    string `json:"involved"`
	Urgency     string `json:"urgency"`
	Anonymous   bool   `json:"anonymous"`
}

// Submit creates a report. When Anonymous is true, user_id is left NULL per PRD §6 —
// the requester must still be authenticated (checked by RequireAuth upstream) to deter spam,
// but that identity is never written to the reports row.
func (h *Handler) Submit(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)

	var s submission
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}
	s.Category = strings.TrimSpace(s.Category)
	s.Description = strings.TrimSpace(s.Description)
	if s.Category == "" || s.Description == "" {
		http.Error(w, "jenis dan deskripsi laporan wajib diisi", http.StatusBadRequest)
		return
	}
	if s.Urgency != "mendesak" {
		s.Urgency = "tidak_mendesak"
	}

	cfg, err := settings.Fetch(r.Context(), h.DB)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	// Kalau lapor anonim dimatikan sekolah, permintaan anonim DITOLAK — jangan
	// sekali-kali mundur ke mencatat user_id. Siswa yang mengira dirinya anonim
	// lalu identitasnya tercatat adalah persis kegagalan yang aplikasi ini
	// ada untuk mencegahnya (PRD §6).
	if s.Anonymous && !cfg.AnonymousEnabled {
		http.Error(w, "lapor anonim sedang dinonaktifkan sekolah", http.StatusBadRequest)
		return
	}
	if !knownCategory(cfg.ReportCategories, s.Category) {
		http.Error(w, "jenis laporan tidak dikenal", http.StatusBadRequest)
		return
	}

	var reportedBy any = userID
	if s.Anonymous {
		reportedBy = nil
	}

	var reportID string
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO reports (user_id, category, description, location, involved, urgency)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		reportedBy, s.Category, s.Description, s.Location, s.Involved, s.Urgency,
	).Scan(&reportID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	ticket, err := randomTicket()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if _, err := h.DB.Exec(r.Context(),
		`INSERT INTO report_tickets (report_id, ticket_code) VALUES ($1, $2)`, reportID, ticket,
	); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"ticket_code": ticket, "report_id": reportID})
}

// Attach uploads evidence for a report identified by its ticket code. Using the
// ticket rather than the report id means anonymous reporters can attach files
// without proving account ownership.
func (h *Handler) Attach(w http.ResponseWriter, r *http.Request) {
	if h.Storage == nil {
		http.Error(w, "penyimpanan lampiran belum dikonfigurasi", http.StatusServiceUnavailable)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxAttachmentSize)
	if err := r.ParseMultipartForm(maxAttachmentSize); err != nil {
		http.Error(w, "file terlalu besar (maks 10 MB)", http.StatusRequestEntityTooLarge)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file tidak ditemukan", http.StatusBadRequest)
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if !allowedContentTypes[contentType] {
		http.Error(w, "tipe file tidak didukung (gunakan JPG, PNG, WEBP, atau PDF)", http.StatusUnsupportedMediaType)
		return
	}

	var reportID string
	err = h.DB.QueryRow(r.Context(),
		`SELECT report_id FROM report_tickets WHERE ticket_code = $1`, r.PathValue("ticket"),
	).Scan(&reportID)
	if err == pgx.ErrNoRows {
		http.Error(w, "tiket tidak ditemukan", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	key, err := h.Storage.Upload(r.Context(), header.Filename, contentType, file)
	if err != nil {
		http.Error(w, "gagal mengunggah lampiran", http.StatusBadGateway)
		return
	}

	if _, err := h.DB.Exec(r.Context(),
		`INSERT INTO report_attachments (report_id, object_key, filename, content_type) VALUES ($1, $2, $3, $4)`,
		reportID, key, header.Filename, contentType,
	); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// Status looks up a report by ticket code — no auth required, so anonymous
// reporters can track progress without re-linking their identity.
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	var (
		status, category string
		createdAt        time.Time
	)
	err := h.DB.QueryRow(r.Context(),
		`SELECT r.status, r.category, r.created_at
		 FROM reports r JOIN report_tickets t ON t.report_id = r.id
		 WHERE t.ticket_code = $1`,
		r.PathValue("ticket"),
	).Scan(&status, &category, &createdAt)
	if err == pgx.ErrNoRows {
		http.Error(w, "tiket tidak ditemukan", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"status":     status,
		"category":   category,
		"created_at": createdAt,
	})
}

// Mine lists reports the user chose to submit under their identity. Anonymous
// reports are absent by construction — there is no user_id to match.
func (h *Handler) Mine(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.CtxUserID).(string)

	rows, err := h.DB.Query(r.Context(),
		`SELECT r.id, r.category, r.status, r.urgency, r.created_at, t.ticket_code
		 FROM reports r JOIN report_tickets t ON t.report_id = r.id
		 WHERE r.user_id = $1 ORDER BY r.created_at DESC`, userID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type item struct {
		ID         string    `json:"id"`
		Category   string    `json:"category"`
		Status     string    `json:"status"`
		Urgency    string    `json:"urgency"`
		CreatedAt  time.Time `json:"created_at"`
		TicketCode string    `json:"ticket_code"`
	}
	items := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ID, &it.Category, &it.Status, &it.Urgency, &it.CreatedAt, &it.TicketCode); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		items = append(items, it)
	}
	writeJSON(w, items)
}

// AdminList is role-gated upstream. It never selects user_id, so anonymous
// submitters stay untraceable even to admins.
func (h *Handler) AdminList(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	urgency := r.URL.Query().Get("urgency")

	rows, err := h.DB.Query(r.Context(), `
		SELECT r.id, r.category, r.description, r.location, r.involved, r.urgency,
		       r.status, r.created_at, r.user_id IS NULL AS is_anonymous, t.ticket_code
		FROM reports r JOIN report_tickets t ON t.report_id = r.id
		WHERE ($1 = '' OR r.status = $1) AND ($2 = '' OR r.urgency = $2)
		ORDER BY CASE WHEN r.urgency = 'mendesak' THEN 0 ELSE 1 END, r.created_at DESC`,
		status, urgency)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type item struct {
		ID          string    `json:"id"`
		Category    string    `json:"category"`
		Description string    `json:"description"`
		Location    string    `json:"location"`
		Involved    string    `json:"involved"`
		Urgency     string    `json:"urgency"`
		Status      string    `json:"status"`
		CreatedAt   time.Time `json:"created_at"`
		IsAnonymous bool      `json:"is_anonymous"`
		TicketCode  string    `json:"ticket_code"`
	}
	items := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ID, &it.Category, &it.Description, &it.Location, &it.Involved,
			&it.Urgency, &it.Status, &it.CreatedAt, &it.IsAnonymous, &it.TicketCode); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		items = append(items, it)
	}
	writeJSON(w, items)
}

// AdminDetail returns one report with its notes and short-lived evidence links.
func (h *Handler) AdminDetail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var (
		category, description, location, involved, urgency, status, ticket string
		createdAt                                                          time.Time
		isAnonymous                                                        bool
	)
	err := h.DB.QueryRow(r.Context(), `
		SELECT r.category, r.description, r.location, r.involved, r.urgency, r.status,
		       r.created_at, r.user_id IS NULL, t.ticket_code
		FROM reports r JOIN report_tickets t ON t.report_id = r.id
		WHERE r.id = $1`, id,
	).Scan(&category, &description, &location, &involved, &urgency, &status, &createdAt, &isAnonymous, &ticket)
	if err == pgx.ErrNoRows {
		http.Error(w, "laporan tidak ditemukan", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	attachments, err := h.attachmentsFor(r, id)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	notes, err := h.notesFor(r, id)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"id": id, "category": category, "description": description,
		"location": location, "involved": involved, "urgency": urgency,
		"status": status, "created_at": createdAt, "is_anonymous": isAnonymous,
		"ticket_code": ticket, "attachments": attachments, "notes": notes,
	})
}

// AdminUpdate changes a report's status and records who did it, in report_notes
// rather than an audit log keyed to the reporter (PRD §6.4).
func (h *Handler) AdminUpdate(w http.ResponseWriter, r *http.Request) {
	adminID, _ := r.Context().Value(middleware.CtxUserID).(string)

	var body struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}
	if !validStatuses[body.Status] {
		http.Error(w, "status tidak valid", http.StatusBadRequest)
		return
	}

	id := r.PathValue("id")
	tag, err := h.DB.Exec(r.Context(), `UPDATE reports SET status = $1 WHERE id = $2`, body.Status, id)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "laporan tidak ditemukan", http.StatusNotFound)
		return
	}

	if _, err := h.DB.Exec(r.Context(),
		`INSERT INTO report_notes (report_id, author_id, note, status_after) VALUES ($1, $2, $3, $4)`,
		id, adminID, body.Note, body.Status,
	); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type attachment struct {
	Filename string `json:"filename"`
	URL      string `json:"url"`
}

func (h *Handler) attachmentsFor(r *http.Request, reportID string) ([]attachment, error) {
	rows, err := h.DB.Query(r.Context(),
		`SELECT object_key, filename FROM report_attachments WHERE report_id = $1 ORDER BY created_at`, reportID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []attachment{}
	for rows.Next() {
		var key, filename string
		if err := rows.Scan(&key, &filename); err != nil {
			return nil, err
		}
		// Storage may be unconfigured; still list the file, just without a link.
		url, err := h.Storage.SignedURL(r.Context(), key, signedURLTTL)
		if err != nil {
			url = ""
		}
		out = append(out, attachment{Filename: filename, URL: url})
	}
	return out, nil
}

type note struct {
	Note        string    `json:"note"`
	StatusAfter string    `json:"status_after"`
	CreatedAt   time.Time `json:"created_at"`
}

func (h *Handler) notesFor(r *http.Request, reportID string) ([]note, error) {
	rows, err := h.DB.Query(r.Context(),
		`SELECT note, coalesce(status_after, ''), created_at FROM report_notes
		 WHERE report_id = $1 ORDER BY created_at DESC`, reportID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []note{}
	for rows.Next() {
		var n note
		if err := rows.Scan(&n.Note, &n.StatusAfter, &n.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, nil
}

// knownCategory menolak kategori di luar daftar sekolah. Laporan lama dengan
// kategori yang sudah dihapus tetap tersimpan apa adanya — hanya laporan baru
// yang dibatasi.
func knownCategory(cats []settings.Category, want string) bool {
	for _, c := range cats {
		if c.Value == want {
			return true
		}
	}
	return false
}

func randomTicket() (string, error) {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "BRN-" + hex.EncodeToString(b), nil
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
