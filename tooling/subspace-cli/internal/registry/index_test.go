package registry

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidateIndex_RejectsPathTraversal(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeFile(t, dir, "kv/manifest.yaml", []byte(validIndexedManifestYAML("kv")))
	writeIndex(t, dir, Index{
		SchemaVersion: SchemaVersion,
		SourceGitSHA:  "abc123",
		Primitives: []IndexItem{
			{
				Name:        "kv",
				Description: "Key-value storage",
				Language:    "typescript",
				Manifest:    "kv/manifest.yaml",
				Files: []IndexFile{
					{Path: "../evil.ts", SHA256: HashBytes([]byte("x"))},
					{Path: "kv/manifest.yaml", SHA256: HashBytes([]byte(validIndexedManifestYAML("kv")))},
				},
			},
		},
	})

	_, err := ValidateIndex(os.DirFS(dir))
	if err == nil {
		t.Fatal("expected traversal error, got nil")
	}
	if !strings.Contains(err.Error(), "escape") && !strings.Contains(err.Error(), "invalid") {
		t.Fatalf("expected traversal-safe error, got %v", err)
	}
}

func TestValidateIndex_RejectsHashMismatch(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	manifest := []byte(validIndexedManifestYAML("kv"))
	writeFile(t, dir, "kv/manifest.yaml", manifest)
	writeIndex(t, dir, Index{
		SchemaVersion: SchemaVersion,
		SourceGitSHA:  "abc123",
		Primitives: []IndexItem{
			{
				Name:        "kv",
				Description: "Key-value storage",
				Language:    "typescript",
				Manifest:    "kv/manifest.yaml",
				Files: []IndexFile{
					{Path: "kv/manifest.yaml", SHA256: strings.Repeat("0", 64)},
				},
			},
		},
	})

	_, err := ValidateIndex(os.DirFS(dir))
	if err == nil {
		t.Fatal("expected hash mismatch, got nil")
	}
	if !strings.Contains(err.Error(), "hash mismatch") {
		t.Fatalf("expected hash mismatch error, got %v", err)
	}
}

func TestValidateIndex_RejectsUnindexedFile(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	manifest := []byte(validIndexedManifestYAML("kv"))
	writeFile(t, dir, "kv/manifest.yaml", manifest)
	writeFile(t, dir, "kv/src/extra.ts", []byte("export {}\n"))
	writeIndex(t, dir, Index{
		SchemaVersion: SchemaVersion,
		SourceGitSHA:  "abc123",
		Primitives: []IndexItem{
			{
				Name:        "kv",
				Description: "Key-value storage",
				Language:    "typescript",
				Manifest:    "kv/manifest.yaml",
				Files: []IndexFile{
					{Path: "kv/manifest.yaml", SHA256: HashBytes(manifest)},
				},
			},
		},
	})

	_, err := ValidateIndex(os.DirFS(dir))
	if err == nil {
		t.Fatal("expected unindexed file error, got nil")
	}
	if !strings.Contains(err.Error(), "not listed") {
		t.Fatalf("expected unindexed file error, got %v", err)
	}
}

func writeIndex(t *testing.T, dir string, idx Index) {
	t.Helper()

	b, err := json.MarshalIndent(idx, "", "  ")
	if err != nil {
		t.Fatalf("marshal index: %v", err)
	}
	writeFile(t, dir, IndexFilename, append(b, '\n'))
}

func writeFile(t *testing.T, dir string, rel string, b []byte) {
	t.Helper()

	p := filepath.Join(dir, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", rel, err)
	}
	if err := os.WriteFile(p, b, 0o644); err != nil {
		t.Fatalf("write %s: %v", rel, err)
	}
}

func validIndexedManifestYAML(name string) string {
	return `name: ` + name + `
description: Key-value storage
language: typescript
copy:
  - from: src
    to: "{{targetDir}}/` + name + `"
`
}
