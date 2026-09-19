package httpserver

import (
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	authpkg "berani.id/api/internal/auth"
	"berani.id/api/internal/config"
	"berani.id/api/internal/crypto"
	"berani.id/api/internal/education"
	"berani.id/api/internal/mailer"
	"berani.id/api/internal/middleware"
	"berani.id/api/internal/reflection"
	"berani.id/api/internal/report"
	"berani.id/api/internal/settings"
	"berani.id/api/internal/storage"
	"berani.id/api/internal/training"
)

type Deps struct {
	DB      *pgxpool.Pool
	Config  config.Config
	Cipher  *crypto.Cipher
	Storage *storage.Storage
	Mailer  *mailer.Mailer
}

func NewRouter(d Deps) http.Handler {
	mux := http.NewServeMux()
	secret := d.Config.JWTSecret

	requireAuth := middleware.RequireAuth(secret)
	optionalAuth := middleware.OptionalAuth(secret)
	requireAdmin := middleware.RequireRole("guru_admin", "super_admin")

	// PRD §8.2: rate limit auth and report endpoints against abuse.
	//
	// Di produksi API ada di belakang nginx, jadi setiap request tiba dari IP
	// gateway bridge Docker yang sama dan clientIP() runtuh jadi satu kunci untuk
	// seluruh internet (middleware/ratelimit.go:59-61 sengaja mengabaikan
	// X-Forwarded-For karena header itu dikendalikan penyerang). Angka di sini
	// karenanya rem lonjakan seluruh instance, bukan kebijakan per pengguna —
	// batas per-IP ditegakkan nginx lewat zone berani_auth / berani_report di
	// deploy/nginx/berani-http.conf. Angka per-pengguna di sini akan mengunci
	// siswa kedua yang login di menit yang sama.
	authLimit := middleware.RateLimit(600, time.Minute)
	reportLimit := middleware.RateLimit(300, 10*time.Minute)

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	authH := &authpkg.Handler{
		DB:         d.DB,
		JWTSecret:  secret,
		Mailer:     d.Mailer,
		AppBaseURL: d.Config.AppBaseURL,
	}
	post(mux, "/auth/register", authLimit(http.HandlerFunc(authH.Register)))
	post(mux, "/auth/login", authLimit(http.HandlerFunc(authH.Login)))
	post(mux, "/auth/refresh", authLimit(http.HandlerFunc(authH.Refresh)))
	post(mux, "/auth/verify-email", authLimit(http.HandlerFunc(authH.VerifyEmail)))
	post(mux, "/auth/forgot-password", authLimit(http.HandlerFunc(authH.ForgotPassword)))
	post(mux, "/auth/reset-password", authLimit(http.HandlerFunc(authH.ResetPassword)))
	mux.Handle("GET /auth/me", requireAuth(http.HandlerFunc(authH.Me)))

	eduH := &education.Handler{DB: d.DB, Storage: d.Storage}
	mux.Handle("GET /education/modules", optionalAuth(http.HandlerFunc(eduH.List)))
	mux.Handle("GET /education/modules/{id}", optionalAuth(http.HandlerFunc(eduH.Get)))
	mux.Handle("POST /education/modules/{id}/complete", requireAuth(http.HandlerFunc(eduH.Complete)))
	mux.Handle("GET /education/progress", requireAuth(http.HandlerFunc(eduH.Progress)))
	// Publik & tanpa auth: gambar isi materi harus tetap tampil di halaman siswa
	// yang dibuka tanpa login. ServeUpload sendiri yang membatasi hanya prefix
	// "materi/" yang bisa diakses lewat sini.
	mux.HandleFunc("GET /uploads/{key...}", eduH.ServeUpload)

	reflH := &reflection.Handler{DB: d.DB, Cipher: d.Cipher}
	mux.Handle("GET /reflections/prompt", requireAuth(http.HandlerFunc(reflH.Prompt)))
	mux.Handle("POST /reflections", requireAuth(http.HandlerFunc(reflH.Create)))
	mux.Handle("GET /reflections", requireAuth(http.HandlerFunc(reflH.List)))
	mux.Handle("GET /reflections/moods", requireAuth(http.HandlerFunc(reflH.Moods)))
	mux.Handle("DELETE /reflections/{id}", requireAuth(http.HandlerFunc(reflH.Delete)))
	mux.Handle("POST /reflections/witness", requireAuth(http.HandlerFunc(reflH.SubmitWitness)))

	trainH := &training.Handler{DB: d.DB}
	mux.Handle("GET /training/scenarios", optionalAuth(http.HandlerFunc(trainH.ListScenarios)))
	mux.Handle("POST /training/attempts", requireAuth(http.HandlerFunc(trainH.SubmitAttempt)))
	mux.Handle("GET /training/progress", requireAuth(http.HandlerFunc(trainH.Progress)))

	reportH := &report.Handler{DB: d.DB, Storage: d.Storage}
	mux.Handle("POST /reports", requireAuth(reportLimit(http.HandlerFunc(reportH.Submit))))
	mux.Handle("POST /reports/{ticket}/attachments", requireAuth(reportLimit(http.HandlerFunc(reportH.Attach))))
	mux.HandleFunc("GET /reports/{ticket}", reportH.Status)
	mux.Handle("GET /reports/mine", requireAuth(http.HandlerFunc(reportH.Mine)))

	setH := &settings.Handler{DB: d.DB}
	// optionalAuth, bukan publik penuh: kontak guru BK ikut hanya kalau ada token.
	mux.Handle("GET /settings", optionalAuth(http.HandlerFunc(setH.Get)))

	admin := func(h http.HandlerFunc) http.Handler { return requireAuth(requireAdmin(h)) }
	mux.Handle("GET /admin/reports", admin(reportH.AdminList))
	mux.Handle("GET /admin/reports/{id}", admin(reportH.AdminDetail))
	mux.Handle("PATCH /admin/reports/{id}", admin(reportH.AdminUpdate))

	// Guru dan admin sama-sama penuh atas materi & skenario. Tidak ada route
	// DELETE: arsip adalah PATCH {"published": false} supaya progres siswa
	// (ON DELETE CASCADE) tidak ikut hangus.
	mux.Handle("GET /admin/education/modules", admin(eduH.AdminList))
	mux.Handle("POST /admin/education/modules", admin(eduH.AdminCreate))
	mux.Handle("GET /admin/education/modules/{id}", admin(eduH.AdminGet))
	mux.Handle("PATCH /admin/education/modules/{id}", admin(eduH.AdminUpdate))
	mux.Handle("POST /admin/education/uploads", admin(eduH.UploadImage))
	mux.Handle("GET /admin/training/scenarios", admin(trainH.AdminList))
	mux.Handle("POST /admin/training/scenarios", admin(trainH.AdminCreate))
	mux.Handle("GET /admin/training/scenarios/{id}", admin(trainH.AdminGet))
	mux.Handle("PATCH /admin/training/scenarios/{id}", admin(trainH.AdminUpdate))

	superAdmin := func(h http.HandlerFunc) http.Handler {
		return requireAuth(middleware.RequireRole("super_admin")(h))
	}
	// Super admin saja: jawabannya menyebut host & bucket, dan tiap panggilan
	// membuka koneksi keluar ke SMTP dan R2.
	mux.Handle("GET /admin/diagnostics", superAdmin(diagnosticsHandler(d.Mailer, d.Storage)))
	mux.Handle("PATCH /admin/settings", superAdmin(setH.Update))
	mux.Handle("GET /admin/users", superAdmin(authH.AdminListUsers))
	mux.Handle("POST /admin/users", superAdmin(authH.AdminCreateUser))
	mux.Handle("PATCH /admin/users/{id}", superAdmin(authH.AdminUpdateUser))
	mux.Handle("POST /admin/users/{id}/reset-password", superAdmin(authH.AdminResetPassword))

	return cors(d.Config.AppBaseURL, mux)
}

func post(mux *http.ServeMux, path string, h http.Handler) {
	mux.Handle("POST "+path, h)
}

func cors(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
