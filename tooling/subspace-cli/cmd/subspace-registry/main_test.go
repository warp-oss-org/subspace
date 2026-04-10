package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

func TestRunBuildAndValidate(t *testing.T) {
	t.Parallel()

	source := t.TempDir()
	writeTestFile(t, source, "kv/manifest.yaml", []byte(`name: kv
description: Key-value storage
language: typescript
copy:
  - from: src
    to: "{{targetDir}}/kv"
`))
	writeTestFile(t, source, "kv/src/index.ts", []byte("export const ok = true\n"))

	out := filepath.Join(t.TempDir(), "registry")
	if err := run([]string{"build", "--source", source, "--out", out, "--source-git-sha", "test-sha"}); err != nil {
		t.Fatalf("build: %v", err)
	}
	if _, err := os.Stat(filepath.Join(out, registry.IndexFilename)); err != nil {
		t.Fatalf("expected registry index: %v", err)
	}
	if err := run([]string{"validate", "--dir", out}); err != nil {
		t.Fatalf("validate: %v", err)
	}
}

func TestRunRejectsUnknownCommand(t *testing.T) {
	t.Parallel()

	if err := run([]string{"wat"}); err == nil {
		t.Fatal("expected unknown command error")
	}
}

func writeTestFile(t *testing.T, dir string, rel string, b []byte) {
	t.Helper()

	path := filepath.Join(dir, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", rel, err)
	}
	if err := os.WriteFile(path, b, 0o644); err != nil {
		t.Fatalf("write %s: %v", rel, err)
	}
}
