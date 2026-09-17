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
