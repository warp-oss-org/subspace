package ui

import (
	"bytes"
	"strings"
	"testing"
)

func TestTableRendersHeadersAndRows(t *testing.T) {
	t.Parallel()

	session := NewSession(strings.NewReader(""), &bytes.Buffer{}, &bytes.Buffer{})
	out := session.Table([]string{"Primitive", "Description"}, [][]string{
		{"kv", "Key-value storage"},
		{"cache", "Cache ports"},
	})

	for _, want := range []string{"Primitive", "Description", "kv", "cache"} {
		if !strings.Contains(out, want) {
			t.Fatalf("table missing %q: %s", want, out)
		}
	}
}

func TestCommandFallbackWithoutColor(t *testing.T) {
	t.Parallel()

	session := NewSession(strings.NewReader(""), &bytes.Buffer{}, &bytes.Buffer{})
	got := session.Command("subspace add kv")
	if got == "" || !strings.Contains(got, "subspace add kv") {
		t.Fatalf("unexpected command render: %q", got)
	}
}

func TestPromptSelectRejectsNonInteractiveSession(t *testing.T) {
	t.Parallel()

	session := NewSession(strings.NewReader(""), &bytes.Buffer{}, &bytes.Buffer{})
	if _, err := session.PromptSelect("Pick one", []string{"a", "b"}, "a"); err == nil {
		t.Fatal("expected non-interactive prompt error")
	}
}
