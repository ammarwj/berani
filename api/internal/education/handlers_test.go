package education

import "testing"

func TestGradeQuiz(t *testing.T) {
	quiz := []quizQuestion{
		{CorrectIndex: 2},
		{CorrectIndex: 1},
	}

	cases := []struct {
		name    string
		quiz    []quizQuestion
		answers []int
		want    *int
	}{
		{"all correct", quiz, []int{2, 1}, ptr(100)},
		{"half correct", quiz, []int{2, 0}, ptr(50)},
		{"all wrong", quiz, []int{0, 0}, ptr(0)},
		{"short answers score the rest wrong", quiz, []int{2}, ptr(50)},
		{"extra answers ignored", quiz, []int{2, 1, 3}, ptr(100)},
		{"no answers", quiz, nil, nil},
		{"module without quiz", nil, []int{1}, nil},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := gradeQuiz(c.quiz, c.answers)
			switch {
			case c.want == nil && got != nil:
				t.Fatalf("want nil, got %d", *got)
			case c.want != nil && got == nil:
				t.Fatalf("want %d, got nil", *c.want)
			case c.want != nil && *got != *c.want:
				t.Fatalf("want %d, got %d", *c.want, *got)
			}
		})
	}
}

func TestBadgeFor(t *testing.T) {
	cases := []struct {
		completed, total int
		want             string
	}{
		{0, 5, ""},
		{1, 5, "Pemula Berani"},
		{3, 5, "Penjaga Teman"},
		{5, 5, "Sahabat BERANI"},
		{0, 0, ""}, // no modules seeded: not "complete"
	}
	for _, c := range cases {
		if got := badgeFor(c.completed, c.total); got != c.want {
			t.Errorf("badgeFor(%d,%d) = %q, want %q", c.completed, c.total, got, c.want)
		}
	}
}

func ptr(i int) *int { return &i }
