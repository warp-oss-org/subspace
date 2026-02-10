package cmd

import (
	"reflect"
	"testing"
)

func TestExtraExcludesForAdd(t *testing.T) {
	t.Parallel()

	got := extraExcludesForAdd(true)
	want := []string{
		"*.test.ts",
		"*.spec.ts",
		"*.test.tsx",
		"*.spec.tsx",
		"__tests__",
		"__test__",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected excludes: got %v want %v", got, want)
	}

	if got := extraExcludesForAdd(false); got != nil {
		t.Fatalf("expected nil excludes when flag disabled, got %v", got)
	}
}
