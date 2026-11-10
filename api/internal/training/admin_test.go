package training

import "testing"

func TestValidateOptions(t *testing.T) {
	best := option{Label: "Laporkan ke guru", Feedback: "Tepat.", IsBest: true}
	other := option{Label: "Diamkan saja", Feedback: "Kurang membantu."}

	cases := []struct {
		name    string
		opts    []option
		wantErr bool
	}{
		{"one best among two", []option{best, other}, false},
		{"no options", nil, true},
		{"single option", []option{best}, true},
		// Nol is_best bikin skenario tak pernah bisa dijawab benar, diam-diam.
		{"no best answer", []option{other, other}, true},
		{"two best answers", []option{best, best}, true},
		{"blank label", []option{best, {Label: " ", Feedback: "x"}}, true},
		{"missing feedback", []option{best, {Label: "Diam"}}, true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if err := validateOptions(c.opts); (err != nil) != c.wantErr {
				t.Fatalf("validateOptions() error = %v, wantErr %v", err, c.wantErr)
			}
		})
	}
}

func TestNormalizeMedia(t *testing.T) {
	cases := []struct {
		name     string
		url      string
		kind     string
		wantURL  string
		wantKind string
		wantErr  bool
	}{
		{"tanpa media", "", "", "", "", false},
		// Kind sisa dari media yang baru dihapus guru: tanpa URL dia tidak
		// menunjuk apa pun, jadi dibersihkan daripada disimpan menggantung.
		{"kind yatim dibersihkan", "", "image", "", "", false},
		{"gambar terunggah", "/uploads/materi/a.png", "image", "/uploads/materi/a.png", "image", false},
		{"video eksternal", "https://cdn.id/a.mp4", "video", "https://cdn.id/a.mp4", "video", false},
		{"youtube", "https://youtu.be/abcdefghijk", "youtube", "https://youtu.be/abcdefghijk", "youtube", false},
		{"spasi dipangkas", "  https://cdn.id/a.png  ", " image ", "https://cdn.id/a.png", "image", false},
		// Skema berbahaya: renderer siswa memilih elemen dari kolom ini.
		{"javascript ditolak", "javascript:alert(1)", "image", "", "", true},
		{"data uri ditolak", "data:image/png;base64,AAAA", "image", "", "", true},
		// Kind asing berarti medianya tidak akan pernah muncul di halaman siswa.
		{"kind tak dikenal", "https://cdn.id/a.png", "audio", "", "", true},
		{"kind kosong padahal ada url", "https://cdn.id/a.png", "", "", "", true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := adminScenario{MediaURL: c.url, MediaKind: c.kind}
			err := normalizeMedia(&s)
			if (err != nil) != c.wantErr {
				t.Fatalf("normalizeMedia() error = %v, wantErr %v", err, c.wantErr)
			}
			if c.wantErr {
				return
			}
			if s.MediaURL != c.wantURL || s.MediaKind != c.wantKind {
				t.Fatalf("normalizeMedia() = %q/%q, want %q/%q",
					s.MediaURL, s.MediaKind, c.wantURL, c.wantKind)
			}
		})
	}
}

// Satu positif palsu di sini menghapus objek R2 yang bukan milik skenario ini.
func TestUploadKey(t *testing.T) {
	cases := []struct {
		name string
		url  string
		want string
	}{
		{"kosong", "", ""},
		{"relatif", "/uploads/materi/a.png", "materi/a.png"},
		{"alamat penuh", "https://api.berani.site/uploads/materi/b.mp4", "materi/b.mp4"},
		// Bukan milik bucket ini: Delete atasnya tidak pernah benar.
		{"eksternal", "https://contoh.id/x.png", ""},
		{"youtube", "https://youtu.be/abcdefghijk", ""},
		// Lampiran laporan privat — tidak boleh ada jalan ke sini sama sekali.
		{"lampiran laporan", "/uploads/laporan/rahasia.png", ""},
		{"traversal ke laporan", "/uploads/materi/../laporan/x.png", ""},
		{"prefix tanpa nama", "/uploads/materi/", ""},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := uploadKey(c.url); got != c.want {
				t.Fatalf("uploadKey(%q) = %q, want %q", c.url, got, c.want)
			}
		})
	}
}
