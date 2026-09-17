package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimitBlocksAfterLimit(t *testing.T) {
	handler := RateLimit(2, time.Minute)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	codes := []int{}
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("POST", "/auth/login", nil)
		req.RemoteAddr = "10.0.0.1:1234"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		codes = append(codes, rec.Code)
	}

	want := []int{200, 200, 429}
	for i, c := range codes {
		if c != want[i] {
			t.Fatalf("request %d: got %d, want %d", i+1, c, want[i])
		}
	}
}

func TestRateLimitIsPerIP(t *testing.T) {
	handler := RateLimit(1, time.Minute)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for _, ip := range []string{"10.0.0.1:1", "10.0.0.2:1"} {
		req := httptest.NewRequest("POST", "/auth/login", nil)
		req.RemoteAddr = ip
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s should be allowed its first request, got %d", ip, rec.Code)
		}
	}
}

// A forged header must not create a fresh bucket.
func TestRateLimitIgnoresForwardedFor(t *testing.T) {
	handler := RateLimit(1, time.Minute)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i, spoof := range []string{"1.1.1.1", "2.2.2.2"} {
		req := httptest.NewRequest("POST", "/auth/login", nil)
		req.RemoteAddr = "10.0.0.9:1234"
		req.Header.Set("X-Forwarded-For", spoof)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		want := http.StatusOK
		if i == 1 {
			want = http.StatusTooManyRequests
		}
		if rec.Code != want {
			t.Fatalf("spoof %s: got %d, want %d", spoof, rec.Code, want)
		}
	}
}
