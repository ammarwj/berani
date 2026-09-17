package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnv(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	os.WriteFile(path, []byte(`
# a comment
PLAIN=value
export EXPORTED=yes
QUOTED="spaced value"
SINGLE='single'
URL=https://example.com/path?a=b
EMPTY=
ALREADY_SET=from_file
malformed line
`), 0600)

	t.Setenv("ALREADY_SET", "from_env")
	for _, k := range []string{"PLAIN", "EXPORTED", "QUOTED", "SINGLE", "URL", "EMPTY"} {
		t.Setenv(k, "") // registered for cleanup; loadDotEnv skips only set keys
		os.Unsetenv(k)
	}

	loadDotEnv(path)

	want := map[string]string{
		"PLAIN":    "value",
		"EXPORTED": "yes",
		"QUOTED":   "spaced value",
		"SINGLE":   "single",
		"URL":      "https://example.com/path?a=b",
		"EMPTY":    "",
		// A real environment variable must win over the file.
		"ALREADY_SET": "from_env",
	}
	for k, v := range want {
		if got := os.Getenv(k); got != v {
			t.Errorf("%s = %q, want %q", k, got, v)
		}
	}
}

func TestLoadDotEnvMissingFileIsFine(t *testing.T) {
	loadDotEnv(filepath.Join(t.TempDir(), "nope.env")) // must not panic
}

func TestR2URL(t *testing.T) {
	cases := []struct {
		name string
		cfg  R2Config
		want string
	}{
		{"endpoint wins", R2Config{Endpoint: "https://acct.r2.cloudflarestorage.com", AccountID: "other"}, "https://acct.r2.cloudflarestorage.com"},
		{"trailing slash trimmed", R2Config{Endpoint: "https://acct.r2.cloudflarestorage.com/"}, "https://acct.r2.cloudflarestorage.com"},
		{"derived from account id", R2Config{AccountID: "abc123"}, "https://abc123.r2.cloudflarestorage.com"},
		{"neither set", R2Config{}, ""},
	}
	for _, c := range cases {
		if got := c.cfg.URL(); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}

func TestR2Configured(t *testing.T) {
	full := R2Config{Endpoint: "https://x.r2.cloudflarestorage.com", AccessKeyID: "k", SecretAccessKey: "s", Bucket: "b"}
	if !full.Configured() {
		t.Error("complete config should be Configured")
	}
	// Missing any single piece must disable uploads rather than half-work.
	for _, c := range []R2Config{
		{AccessKeyID: "k", SecretAccessKey: "s", Bucket: "b"}, // no endpoint or account
		{Endpoint: "https://x", SecretAccessKey: "s", Bucket: "b"},
		{Endpoint: "https://x", AccessKeyID: "k", Bucket: "b"},
		{Endpoint: "https://x", AccessKeyID: "k", SecretAccessKey: "s"},
	} {
		if c.Configured() {
			t.Errorf("incomplete config reported as Configured: %+v", c)
		}
	}
}
