package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"berani.id/api/internal/mailer"
	"berani.id/api/internal/storage"
)

// checkResult is deliberately coarse: configured says whether the env vars are
// present, ok says whether the credentials actually work. The two differ often —
// SMTP_HOST set to a typo is configured but not ok.
type checkResult struct {
	Configured bool              `json:"configured"`
	OK         bool              `json:"ok"`
	Error      string            `json:"error,omitempty"`
	Detail     map[string]string `json:"detail,omitempty"`
}

type diagnostics struct {
	SMTP    checkResult `json:"smtp"`
	Storage checkResult `json:"storage"`
}

// Diagnostics reports whether SMTP and R2 are reachable with the configured
// credentials. Super-admin only: the responses name hosts and buckets, and each
// call opens outbound connections.
func diagnosticsHandler(m *mailer.Mailer, s *storage.Storage) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// An unreachable host makes both checks hang on TCP timeout; cap them so
		// the request cannot outlive the admin's patience.
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()

		out := diagnostics{
			SMTP:    checkSMTP(m),
			Storage: checkStorage(ctx, s),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	}
}

func checkSMTP(m *mailer.Mailer) checkResult {
	res := checkResult{}
	if m == nil {
		return res
	}
	cfg := m.Config()
	res.Configured = cfg.Configured()
	// Password intentionally absent — this endpoint is a health check, not a
	// credential dump.
	res.Detail = map[string]string{
		"host": cfg.Host,
		"port": cfg.Port,
		"from": cfg.From,
		"auth": map[bool]string{true: "plain", false: "none"}[cfg.Username != ""],
	}
	if !res.Configured {
		res.Error = "SMTP_HOST kosong — email hanya ditulis ke log, tidak dikirim"
		return res
	}
	if err := m.Check(); err != nil {
		res.Error = err.Error()
		return res
	}
	res.OK = true
	return res
}

func checkStorage(ctx context.Context, s *storage.Storage) checkResult {
	res := checkResult{}
	if s == nil {
		res.Error = "R2 belum dikonfigurasi — lampiran laporan dinonaktifkan"
		return res
	}
	res.Configured = true
	res.Detail = map[string]string{"bucket": s.Bucket()}
	if err := s.Check(ctx); err != nil {
		res.Error = err.Error()
		return res
	}
	res.OK = true
	return res
}
