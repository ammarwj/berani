package education

import "testing"

func TestValidateQuiz(t *testing.T) {
	ok := quizQuestion{Question: "Apa itu bullying?", Options: []string{"A", "B"}, CorrectIndex: 1}

	cases := []struct {
		name    string
		quiz    []quizQuestion
		wantErr bool
	}{
		{"empty quiz is allowed", nil, false},
		{"valid question", []quizQuestion{ok}, false},
		{"blank question", []quizQuestion{{Question: "  ", Options: []string{"A", "B"}}}, true},
		{"single option", []quizQuestion{{Question: "Q", Options: []string{"A"}}}, true},
		{"blank option", []quizQuestion{{Question: "Q", Options: []string{"A", " "}}}, true},
		{"correct_index past end", []quizQuestion{{Question: "Q", Options: []string{"A", "B"}, CorrectIndex: 2}}, true},
		{"negative correct_index", []quizQuestion{{Question: "Q", Options: []string{"A", "B"}, CorrectIndex: -1}}, true},
		{"second question invalid", []quizQuestion{ok, {Question: "Q", Options: []string{"A"}}}, true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if err := validateQuiz(c.quiz); (err != nil) != c.wantErr {
				t.Fatalf("validateQuiz() error = %v, wantErr %v", err, c.wantErr)
			}
		})
	}
}

// uploadKeys menentukan objek R2 mana yang ikut terhapus bersama materi, jadi
// positif palsu di sini berarti menghapus file milik materi lain.
func TestUploadKeys(t *testing.T) {
	cases := []struct {
		name string
		body string
		want []string
	}{
		{"kosong", "", nil},
		{"tanpa gambar", "# Judul\n\nIsi biasa saja.", nil},
		{"satu gambar", "![alt](/uploads/materi/abc123.png)", []string{"materi/abc123.png"}},
		{
			"sufiks lebar dibuang",
			"![alt](/uploads/materi/abc123.png =600x)",
			[]string{"materi/abc123.png"},
		},
		{
			"beberapa gambar",
			"![a](/uploads/materi/a.png)\n\ntext\n\n![b](/uploads/materi/b.webp =320x)",
			[]string{"materi/a.png", "materi/b.webp"},
		},
		// Key di luar bucket ini: Delete atasnya tidak pernah benar.
		{"gambar eksternal dilewati", "![a](https://contoh.id/x.png)", nil},
		{"lampiran laporan dilewati", "![a](/uploads/laporan/rahasia.png)", nil},
		{"tanda tutup hilang", "![a](/uploads/materi/a.png", nil},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := uploadKeys(c.body)
			if len(got) != len(c.want) {
				t.Fatalf("uploadKeys() = %v, want %v", got, c.want)
			}
			for i := range got {
				if got[i] != c.want[i] {
					t.Fatalf("uploadKeys()[%d] = %q, want %q", i, got[i], c.want[i])
				}
			}
		})
	}
}
