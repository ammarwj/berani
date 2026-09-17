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
