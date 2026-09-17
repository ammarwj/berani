package crypto

import "testing"

const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

func TestRoundTrip(t *testing.T) {
	c, err := New(testKey)
	if err != nil {
		t.Fatal(err)
	}

	plain := "hari ini aku merasa lebih tenang"
	enc, err := c.Encrypt(plain)
	if err != nil {
		t.Fatal(err)
	}
	if enc == plain {
		t.Fatal("ciphertext must not equal plaintext")
	}

	got, err := c.Decrypt(enc)
	if err != nil {
		t.Fatal(err)
	}
	if got != plain {
		t.Fatalf("got %q, want %q", got, plain)
	}
}

// Same plaintext must produce different ciphertext, or identical journal entries
// would be linkable in the database.
func TestNonceIsRandom(t *testing.T) {
	c, _ := New(testKey)
	a, _ := c.Encrypt("sama")
	b, _ := c.Encrypt("sama")
	if a == b {
		t.Fatal("encrypting the same plaintext twice produced identical ciphertext")
	}
}

func TestWrongKeyFails(t *testing.T) {
	c, _ := New(testKey)
	enc, _ := c.Encrypt("rahasia")

	other, _ := New("f" + testKey[1:])
	if _, err := other.Decrypt(enc); err == nil {
		t.Fatal("decrypting with the wrong key should fail")
	}
}

func TestRejectsBadKeyLength(t *testing.T) {
	if _, err := New("abcd"); err == nil {
		t.Fatal("short key should be rejected")
	}
}
