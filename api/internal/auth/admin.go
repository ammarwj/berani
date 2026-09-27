package auth

import (
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"berani.id/api/internal/mailer"
)

// Handler management user ada di package auth karena issueToken, h.mail, dan
// minPasswordLen semuanya unexported di sini — memicu reset password butuh
// ketiganya, dan jalur token reset sebaiknya cuma ada satu.

type adminUser struct {
	ID       string    `json:"id"`
	Email    string    `json:"email"`
	Name     string    `json:"name"`
	Role     string    `json:"role"`
	IsActive bool      `json:"is_active"`
	Verified bool      `json:"email_verified"`
	Created  time.Time `json:"created_at"`
}

var validRoles = map[string]bool{"siswa": true, "guru_admin": true, "super_admin": true}

func (h *Handler) AdminListUsers(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	q := strings.TrimSpace(r.URL.Query().Get("q"))

	rows, err := h.DB.Query(r.Context(), `
		SELECT id, email, name, role, is_active, email_verified, created_at
		FROM users
		WHERE ($1 = '' OR role = $1)
		  AND ($2 = '' OR email ILIKE '%' || $2 || '%' OR name ILIKE '%' || $2 || '%')
		ORDER BY created_at DESC`, role, q)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	users := []adminUser{}
	for rows.Next() {
		var u adminUser
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.IsActive, &u.Verified, &u.Created); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		users = append(users, u)
	}
	writeJSON(w, users)
}

// AdminActiveStudentCount cuma balikin angka, bukan daftar user: guru biasa
// (bukan super admin) boleh lihat berapa siswa aktif untuk kartu statistik
// dashboard, tapi manajemen user (daftar, ubah, nonaktifkan) tetap super admin saja.
func (h *Handler) AdminActiveStudentCount(w http.ResponseWriter, r *http.Request) {
	var count int
	err := h.DB.QueryRow(r.Context(),
		`SELECT count(*) FROM users WHERE role = 'siswa' AND is_active`,
	).Scan(&count)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]int{"count": count})
}

func (h *Handler) AdminCreateUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Role     string `json:"role"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	if _, err := mail.ParseAddress(body.Email); err != nil {
		http.Error(w, "format email tidak valid", http.StatusBadRequest)
		return
	}
	if body.Role == "" {
		body.Role = "siswa"
	}
	if !validRoles[body.Role] {
		http.Error(w, "role tidak dikenal", http.StatusBadRequest)
		return
	}
	if len(body.Password) < minPasswordLen {
		http.Error(w, "password minimal 8 karakter", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var id string
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
		body.Email, strings.TrimSpace(body.Name), body.Role, string(hash),
	).Scan(&id)
	if err != nil {
		http.Error(w, "email sudah terdaftar", http.StatusConflict)
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, map[string]string{"id": id})
}

// AdminUpdateUser menerima patch sebagian: aksi inline di daftar pengguna hanya
// mengirim satu field. Pointer nil berarti "jangan sentuh".
func (h *Handler) AdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     *string `json:"name"`
		Role     *string `json:"role"`
		IsActive *bool   `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "permintaan tidak valid", http.StatusBadRequest)
		return
	}
	if body.Role != nil && !validRoles[*body.Role] {
		http.Error(w, "role tidak dikenal", http.StatusBadRequest)
		return
	}

	// Super admin terakhir yang menurunkan atau menonaktifkan dirinya sendiri
	// mengunci semua orang keluar dari pengaturan — tidak ada jalan balik lewat UI.
	id := r.PathValue("id")
	if UserID(r) == id {
		if (body.Role != nil && *body.Role != "super_admin") || (body.IsActive != nil && !*body.IsActive) {
			http.Error(w, "tidak bisa menurunkan atau menonaktifkan akunmu sendiri", http.StatusBadRequest)
			return
		}
	}

	tag, err := h.DB.Exec(r.Context(), `
		UPDATE users SET name = coalesce($2, name), role = coalesce($3, role),
		                 is_active = coalesce($4, is_active)
		WHERE id = $1`, id, body.Name, body.Role, body.IsActive)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		http.Error(w, "pengguna tidak ditemukan", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AdminResetPassword mengirim tautan reset ke email pengguna alih-alih memberi
// admin password barunya: admin tidak perlu pernah tahu password siapa pun.
func (h *Handler) AdminResetPassword(w http.ResponseWriter, r *http.Request) {
	var email string
	err := h.DB.QueryRow(r.Context(), `SELECT email FROM users WHERE id = $1`, r.PathValue("id")).Scan(&email)
	if err != nil {
		http.Error(w, "pengguna tidak ditemukan", http.StatusNotFound)
		return
	}

	token, err := issueToken(r.Context(), h.DB, r.PathValue("id"), "reset_password", time.Hour)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	h.mail(email, mailer.Email{
		Subject: "Atur ulang password BERANI",
		Heading: "Admin sekolah mengatur ulang passwordmu",
		Intro:   "Admin sekolah meminta pengaturan ulang password akun BERANI-mu. Buat password baru untuk bisa masuk lagi.",
		Action:  "Buat password baru",
		URL:     h.AppBaseURL + "/reset-password?token=" + token,
		Expiry:  "Tautan ini berlaku 1 jam.",
		Note:    "Kalau kamu merasa ini keliru, hubungi guru pendamping di sekolahmu.",
	})

	w.WriteHeader(http.StatusNoContent)
}

// AdminDeleteUser menghapus permanen — super_admin saja (router.go), dan hanya
// role 'siswa'.
//
// Dua batasan yang bukan kenyamanan UI melainkan syarat integritas:
//
//   - Hanya siswa. report_notes.author_id ON DELETE CASCADE (0002_features.sql:32),
//     jadi menghapus guru_admin/super_admin ikut menghanguskan seluruh catatan
//     tindak lanjut yang pernah ia tulis di laporan siswa lain — jejak audit orang
//     lain, bukan datanya sendiri. Untuk staf: PATCH {"is_active": false}.
//   - Tidak bisa menghapus diri sendiri, sama seperti AdminUpdateUser.
//
// Yang hangus: reflections, education_progress, training_attempts,
// witness_answers, auth_tokens (semua CASCADE). Yang bertahan: laporannya —
// reports.user_id ON DELETE SET NULL (0001_init.sql:56), jadi laporan tetap bisa
// ditindaklanjuti tapi pelapornya tidak lagi terlacak dan dashboard
// menampilkannya "Identitas tidak tersimpan". Itu kebalikan dari yang diinginkan
// revisi 0005, jadi UI wajib menyebut jumlah laporannya sebelum konfirmasi.
func (h *Handler) AdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if UserID(r) == id {
		http.Error(w, "tidak bisa menghapus akunmu sendiri", http.StatusBadRequest)
		return
	}

	var role string
	if err := h.DB.QueryRow(r.Context(), `SELECT role FROM users WHERE id = $1`, id).Scan(&role); err != nil {
		http.Error(w, "pengguna tidak ditemukan", http.StatusNotFound)
		return
	}
	if role != "siswa" {
		http.Error(w, "hanya akun siswa yang bisa dihapus; nonaktifkan akun staf", http.StatusBadRequest)
		return
	}

	if _, err := h.DB.Exec(r.Context(), `DELETE FROM users WHERE id = $1`, id); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AdminUserFootprint melaporkan apa yang akan hangus kalau akun ini dihapus,
// supaya dialog konfirmasi menyebut angka sebenarnya alih-alih peringatan umum.
// Dipanggil saat dialog dibuka, bukan saat daftar dimuat: enam count() per baris
// akan membuat halaman daftar mahal tanpa alasan.
func (h *Handler) AdminUserFootprint(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var f struct {
		Role        string `json:"role"`
		Reflections int    `json:"reflections"`
		Modules     int    `json:"modules"`
		Attempts    int    `json:"training_attempts"`
		Reports     int    `json:"reports"`
	}
	err := h.DB.QueryRow(r.Context(), `
		SELECT u.role,
		       (SELECT count(*) FROM reflections WHERE user_id = u.id),
		       (SELECT count(*) FROM education_progress WHERE user_id = u.id AND completed_at IS NOT NULL),
		       (SELECT count(*) FROM training_attempts WHERE user_id = u.id),
		       (SELECT count(*) FROM reports WHERE user_id = u.id)
		FROM users u WHERE u.id = $1`, id,
	).Scan(&f.Role, &f.Reflections, &f.Modules, &f.Attempts, &f.Reports)
	if err != nil {
		http.Error(w, "pengguna tidak ditemukan", http.StatusNotFound)
		return
	}
	writeJSON(w, f)
}
