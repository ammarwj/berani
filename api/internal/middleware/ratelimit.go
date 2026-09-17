package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// RateLimit allows `limit` requests per `window` per client IP.
// ponytail: in-process counters — fine for a single API instance. Move to Redis
// (PRD §10 lists it as optional) when running more than one replica.
func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	var (
		mu      sync.Mutex
		hits    = map[string][]time.Time{}
		lastGC  time.Time
	)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)
			now := time.Now()
			cutoff := now.Add(-window)

			mu.Lock()
			if now.Sub(lastGC) > window {
				for k, times := range hits {
					if len(times) == 0 || times[len(times)-1].Before(cutoff) {
						delete(hits, k)
					}
				}
				lastGC = now
			}

			recent := hits[ip][:0]
			for _, t := range hits[ip] {
				if t.After(cutoff) {
					recent = append(recent, t)
				}
			}
			allowed := len(recent) < limit
			if allowed {
				recent = append(recent, now)
			}
			hits[ip] = recent
			mu.Unlock()

			if !allowed {
				w.Header().Set("Retry-After", "60")
				http.Error(w, "terlalu banyak percobaan, coba lagi nanti", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// clientIP deliberately ignores X-Forwarded-For: it is attacker-controlled and
// would let a single client evade the limit by rotating the header. Behind a
// reverse proxy, have the proxy enforce limits or set RemoteAddr correctly.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
