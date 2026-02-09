package render

import "testing"

func TestRenderTemplate_Valid(t *testing.T) {
	t.Parallel()

	src := []byte(`import { KVPort } from "{{.importPrefix}}/kv/port";`)
	data := TemplateData{"importPrefix": "@infra/subspace"}

	out, err := RenderTemplate(src, data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `import { KVPort } from "@infra/subspace/kv/port";`
	if string(out) != expected {
		t.Fatalf("expected %q, got %q", expected, string(out))
	}
}

func TestRenderTemplate_MissingKeyFails(t *testing.T) {
	t.Parallel()

	src := []byte(`{{.missingKey}}`)
	data := TemplateData{}

	_, err := RenderTemplate(src, data)
	if err == nil {
		t.Fatal("expected error for missing key, got nil")
	}
}

func TestRenderTemplate_InvalidTemplateSyntax(t *testing.T) {
	t.Parallel()

	src := []byte(`{{.unclosed`)
	data := TemplateData{}

	_, err := RenderTemplate(src, data)
	if err == nil {
		t.Fatal("expected error for bad syntax, got nil")
	}
}

func TestRenderTemplate_NoTokens(t *testing.T) {
	t.Parallel()

	src := []byte(`export const x = 42;`)
	data := TemplateData{}

	out, err := RenderTemplate(src, data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(out) != "export const x = 42;" {
		t.Fatalf("expected passthrough, got %q", string(out))
	}
}
