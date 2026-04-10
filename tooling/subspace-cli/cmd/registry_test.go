package cmd

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

func TestRunRegistryBuildAndValidate(t *testing.T) {
	source := t.TempDir()
	writeRegistryCmdTestFile(t, source, "kv/manifest.yaml", []byte(`name: kv
description: Key-value storage
language: typescript
copy:
  - from: src
    to: "{{targetDir}}/kv"
`))
	writeRegistryCmdTestFile(t, source, "kv/src/index.ts", []byte("export const ok = true\n"))

	out := filepath.Join(t.TempDir(), "registry")

	if err := runRegistryBuild(registryBuildOptions{
		sourceDir:    source,
		outDir:       out,
		sourceGitSHA: "test-sha",
	}); err != nil {
		t.Fatalf("runRegistryBuild: %v", err)
	}
	if _, err := os.Stat(filepath.Join(out, registry.IndexFilename)); err != nil {
		t.Fatalf("expected generated registry index: %v", err)
	}
	if err := runRegistryValidate(registryValidateOptions{dir: out}); err != nil {
		t.Fatalf("runRegistryValidate: %v", err)
	}
}

func TestNewRegistryCmd_IncludesBuildAndValidate(t *testing.T) {
	t.Parallel()

	cmd := NewRegistryCmd()
	if cmd.Use != "registry" {
		t.Fatalf("unexpected command use: %q", cmd.Use)
	}

	found := map[string]bool{}
	for _, child := range cmd.Commands() {
		found[child.Use] = true
	}
	for _, want := range []string{"build", "validate"} {
		if !found[want] {
			t.Fatalf("expected registry subcommand %q", want)
		}
	}
}

func writeRegistryCmdTestFile(t *testing.T, dir string, rel string, b []byte) {
	t.Helper()

	p := filepath.Join(dir, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", rel, err)
	}
	if err := os.WriteFile(p, b, 0o644); err != nil {
		t.Fatalf("write %s: %v", rel, err)
	}
}
