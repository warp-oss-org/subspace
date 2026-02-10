package tsconfig

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestLoadMissingFile(t *testing.T) {
	t.Parallel()

	_, err := Load(filepath.Join(t.TempDir(), "tsconfig.json"))
	if err == nil {
		t.Fatal("expected error for missing tsconfig")
	}
	if !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected os.ErrNotExist, got %v", err)
	}
}

func TestEnsureSubspaceAliasAddsCompilerOptions(t *testing.T) {
	t.Parallel()

	cfg := TSConfig{Data: map[string]any{}}
	if err := EnsureSubspaceAlias(&cfg, "src/infra/subspace"); err != nil {
		t.Fatalf("EnsureSubspaceAlias: %v", err)
	}

	compilerOptions, ok := cfg.Data["compilerOptions"].(map[string]any)
	if !ok {
		t.Fatal("expected compilerOptions object")
	}
	if compilerOptions["baseUrl"] != "." {
		t.Fatalf("expected baseUrl '.', got %#v", compilerOptions["baseUrl"])
	}
}

func TestEnsureSubspaceAliasAddsBaseURLIfMissing(t *testing.T) {
	t.Parallel()

	cfg := TSConfig{Data: map[string]any{
		"compilerOptions": map[string]any{
			"paths": map[string]any{},
		},
	}}

	if err := EnsureSubspaceAlias(&cfg, "src/infra/subspace"); err != nil {
		t.Fatalf("EnsureSubspaceAlias: %v", err)
	}

	compilerOptions := cfg.Data["compilerOptions"].(map[string]any)
	if compilerOptions["baseUrl"] != "." {
		t.Fatalf("expected baseUrl '.', got %#v", compilerOptions["baseUrl"])
	}
}

func TestEnsureSubspaceAliasOverwritesAlias(t *testing.T) {
	t.Parallel()

	cfg := TSConfig{Data: map[string]any{
		"compilerOptions": map[string]any{
			"baseUrl": ".",
			"paths": map[string]any{
				"@subspace/*": []any{"./wrong/*"},
			},
		},
	}}

	if err := EnsureSubspaceAlias(&cfg, "src/infra/subspace"); err != nil {
		t.Fatalf("EnsureSubspaceAlias: %v", err)
	}

	paths := cfg.Data["compilerOptions"].(map[string]any)["paths"].(map[string]any)
	got, ok := paths["@subspace/*"].([]string)
	if !ok {
		t.Fatalf("expected []string alias, got %T", paths["@subspace/*"])
	}
	want := []string{"./src/infra/subspace/*"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("alias mismatch: got %v, want %v", got, want)
	}
}

func TestEnsureSubspaceAliasPreservesExistingPathsKeys(t *testing.T) {
	t.Parallel()

	cfg := TSConfig{Data: map[string]any{
		"compilerOptions": map[string]any{
			"paths": map[string]any{
				"@existing/*": []any{"./lib/*"},
			},
		},
	}}

	if err := EnsureSubspaceAlias(&cfg, "src/infra/subspace"); err != nil {
		t.Fatalf("EnsureSubspaceAlias: %v", err)
	}

	paths := cfg.Data["compilerOptions"].(map[string]any)["paths"].(map[string]any)
	if _, ok := paths["@existing/*"]; !ok {
		t.Fatal("expected @existing/* entry preserved")
	}
}

func TestEnsureSubspaceAliasPreservesUnrelatedCompilerOptions(t *testing.T) {
	t.Parallel()

	cfg := TSConfig{Data: map[string]any{
		"compilerOptions": map[string]any{
			"strict": true,
		},
	}}

	if err := EnsureSubspaceAlias(&cfg, "src/infra/subspace"); err != nil {
		t.Fatalf("EnsureSubspaceAlias: %v", err)
	}

	compilerOptions := cfg.Data["compilerOptions"].(map[string]any)
	if compilerOptions["strict"] != true {
		t.Fatalf("expected strict=true preserved, got %#v", compilerOptions["strict"])
	}
}

func TestEnsureSubspaceAliasKeepsExistingBaseURL(t *testing.T) {
	t.Parallel()

	cfg := TSConfig{Data: map[string]any{
		"compilerOptions": map[string]any{
			"baseUrl": "./src",
		},
	}}

	if err := EnsureSubspaceAlias(&cfg, "src/infra/subspace"); err != nil {
		t.Fatalf("EnsureSubspaceAlias: %v", err)
	}

	compilerOptions := cfg.Data["compilerOptions"].(map[string]any)
	if compilerOptions["baseUrl"] != "./src" {
		t.Fatalf("expected existing baseUrl preserved, got %#v", compilerOptions["baseUrl"])
	}
}

func TestIdempotentUpdateSemanticEquality(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "tsconfig.json")
	original := []byte(`{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@existing/*": ["./lib/*"]
    }
  }
}`)
	if err := os.WriteFile(path, original, 0o644); err != nil {
		t.Fatalf("write tsconfig: %v", err)
	}

	if err := updateAlias(path, "src/infra/subspace"); err != nil {
		t.Fatalf("first update: %v", err)
	}
	first, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read first result: %v", err)
	}

	if err := updateAlias(path, "src/infra/subspace"); err != nil {
		t.Fatalf("second update: %v", err)
	}
	second, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read second result: %v", err)
	}

	firstObj := decodeJSON(t, first)
	secondObj := decodeJSON(t, second)
	if !reflect.DeepEqual(firstObj, secondObj) {
		t.Fatalf("expected semantic equality after second update\nfirst: %s\nsecond: %s", string(first), string(second))
	}
}

func updateAlias(path, targetDir string) error {
	cfg, err := Load(path)
	if err != nil {
		return err
	}
	if err := EnsureSubspaceAlias(&cfg, targetDir); err != nil {
		return err
	}
	return WriteAtomic(path, cfg)
}

func decodeJSON(t *testing.T, b []byte) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("decode json: %v", err)
	}
	return out
}
