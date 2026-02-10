package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWriteDefaultRefusesToOverwrite(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, DefaultConfigFilename)

	if err := WriteDefault(path); err != nil {
		t.Fatalf("first write: %v", err)
	}
	if err := WriteDefault(path); err == nil {
		t.Fatal("expected overwrite refusal, got nil")
	}
}

func TestWriteDefaultRoundTrip(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, DefaultConfigFilename)

	if err := WriteDefault(path); err != nil {
		t.Fatalf("write: %v", err)
	}

	c, err := Load(path)
	if err != nil {
		t.Fatalf("load written config: %v", err)
	}

	d := Default()
	if c.TargetDir != d.TargetDir ||
		c.Language != d.Language || c.PackageManager != d.PackageManager {
		t.Fatalf("round-tripped config doesn't match defaults:\ngot:  %+v\nwant: %+v", c, d)
	}
}

func TestLoadNormalizesFields(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, DefaultConfigFilename)

	content := []byte(`
targetDir: "  src/infra/subspace  "
language: TypeScript
packageManager: PNPM
`)
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	c, err := Load(path)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if c.Language != "typescript" {
		t.Fatalf("expected language normalized, got %q", c.Language)
	}
	if c.PackageManager != "pnpm" {
		t.Fatalf("expected pm normalized, got %q", c.PackageManager)
	}
	if c.TargetDir != "src/infra/subspace" {
		t.Fatalf("expected targetDir trimmed, got %q", c.TargetDir)
	}
}

func TestLoadRejectsMissingFile(t *testing.T) {
	t.Parallel()

	_, err := Load("/nonexistent/path/subspace.config.yaml")
	if err == nil {
		t.Fatal("expected error for missing file, got nil")
	}
}

func TestLoadRejectsMalformedYAML(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, DefaultConfigFilename)

	if err := os.WriteFile(path, []byte("{{not yaml"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	_, err := Load(path)
	if err == nil {
		t.Fatal("expected error for malformed YAML, got nil")
	}
}

func TestValidateRejectsEmptyFields(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		config Config
	}{
		{"empty targetDir", Config{TargetDir: "", Language: "typescript", PackageManager: "pnpm"}},
		{"empty language", Config{TargetDir: "x", Language: "", PackageManager: "pnpm"}},
		{"empty packageManager", Config{TargetDir: "x", Language: "typescript", PackageManager: ""}},
		{"whitespace targetDir", Config{TargetDir: "   ", Language: "typescript", PackageManager: "pnpm"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			tt.config.Normalize()
			if err := tt.config.Validate(); err == nil {
				t.Fatal("expected validation error, got nil")
			}
		})
	}
}

func TestValidateRejectsUnsupportedValues(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		config Config
	}{
		{"bad language", Config{TargetDir: "src", Language: "python", PackageManager: "pnpm"}},
		{"bad pm", Config{TargetDir: "src", Language: "typescript", PackageManager: "cargo"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if err := tt.config.Validate(); err == nil {
				t.Fatal("expected validation error, got nil")
			}
		})
	}
}

func TestValidateRejectsUnsafePaths(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		config Config
	}{
		{"absolute targetDir", Config{TargetDir: "/etc/evil", Language: "typescript", PackageManager: "pnpm"}},
		{"traversal targetDir", Config{TargetDir: "../etc", Language: "typescript", PackageManager: "pnpm"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if err := tt.config.Validate(); err == nil {
				t.Fatal("expected validation error, got nil")
			}
		})
	}
}
