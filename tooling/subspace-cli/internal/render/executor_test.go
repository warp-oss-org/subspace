package render

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/plan"
)

type stubReader struct {
	files map[string]string
}

func (s *stubReader) ReadPrimitiveFile(primitive, relPath string) ([]byte, error) {
	key := primitive + "/" + relPath

	if content, ok := s.files[key]; ok {
		return []byte(content), nil
	}

	return nil, fmt.Errorf("file not found: %s/%s", primitive, relPath)
}

func TestExecute_CreatesDirectoriesAndFiles(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	reg := &stubReader{files: map[string]string{
		"kv/base/port.ts":            "export interface KVPort {}",
		"kv/adapters/memory/impl.ts": "export class MemoryKV {}",
	}}

	p := plan.Plan{
		Primitive: "kv",
		Adapter:   "memory",
		Dirs: []plan.DirOp{
			{Path: filepath.Join(dir, "kv")},
			{Path: filepath.Join(dir, "kv", "adapters", "memory")},
		},
		Files: []plan.FileOp{
			{
				SrcPath:  "base/port.ts",
				DestPath: filepath.Join(dir, "kv", "port.ts"),
			},
			{
				SrcPath:  "adapters/memory/impl.ts",
				DestPath: filepath.Join(dir, "kv", "adapters", "memory", "impl.ts"),
			},
		},
	}

	err := Execute(reg, p, ExecuteOptions{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	b, err := os.ReadFile(filepath.Join(dir, "kv", "port.ts"))
	if err != nil {
		t.Fatalf("read port.ts: %v", err)
	}
	if string(b) != "export interface KVPort {}" {
		t.Fatalf("unexpected content: %q", string(b))
	}

	b, err = os.ReadFile(filepath.Join(dir, "kv", "adapters", "memory", "impl.ts"))
	if err != nil {
		t.Fatalf("read impl.ts: %v", err)
	}
	if string(b) != "export class MemoryKV {}" {
		t.Fatalf("unexpected content: %q", string(b))
	}
}

func TestExecute_RendersTemplateFiles(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	reg := &stubReader{files: map[string]string{
		"kv/base/index.ts.tpl": `export * from "{{.importPrefix}}/kv/port";`,
	}}

	p := plan.Plan{
		Primitive: "kv",
		Adapter:   "memory",
		Files: []plan.FileOp{
			{
				SrcPath:  "base/index.ts.tpl",
				DestPath: filepath.Join(dir, "kv", "index.ts"),
				Template: true,
			},
		},
	}

	err := Execute(reg, p, ExecuteOptions{
		TemplateData: TemplateData{"importPrefix": "@infra/subspace"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	b, err := os.ReadFile(filepath.Join(dir, "kv", "index.ts"))
	if err != nil {
		t.Fatalf("read: %v", err)
	}

	expected := `export * from "@infra/subspace/kv/port";`
	if string(b) != expected {
		t.Fatalf("expected %q, got %q", expected, string(b))
	}
}

func TestExecute_RefusesOverwriteByDefault(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	dest := filepath.Join(dir, "kv", "port.ts")
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(dest, []byte("existing"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	reg := &stubReader{files: map[string]string{
		"kv/base/port.ts": "new content",
	}}

	p := plan.Plan{
		Primitive: "kv",
		Adapter:   "memory",
		Files: []plan.FileOp{
			{SrcPath: "base/port.ts", DestPath: dest},
		},
	}

	err := Execute(reg, p, ExecuteOptions{Overwrite: false})
	if err == nil {
		t.Fatal("expected overwrite refusal, got nil")
	}

	b, err := os.ReadFile(dest)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if string(b) != "existing" {
		t.Fatalf("expected original content preserved, got %q", string(b))
	}
}

func TestExecute_OverwritesWhenAllowed(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	dest := filepath.Join(dir, "kv", "port.ts")
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(dest, []byte("old"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	reg := &stubReader{files: map[string]string{
		"kv/base/port.ts": "new content",
	}}

	p := plan.Plan{
		Primitive: "kv",
		Adapter:   "memory",
		Files: []plan.FileOp{
			{SrcPath: "base/port.ts", DestPath: dest},
		},
	}

	err := Execute(reg, p, ExecuteOptions{Overwrite: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	b, err := os.ReadFile(dest)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if string(b) != "new content" {
		t.Fatalf("expected overwritten content, got %q", string(b))
	}
}

func TestExecute_FailsOnMissingRegistryFile(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	reg := &stubReader{files: map[string]string{}}

	p := plan.Plan{
		Primitive: "kv",
		Adapter:   "memory",
		Files: []plan.FileOp{
			{SrcPath: "base/missing.ts", DestPath: filepath.Join(dir, "missing.ts")},
		},
	}

	err := Execute(reg, p, ExecuteOptions{})
	if err == nil {
		t.Fatal("expected error for missing registry file, got nil")
	}
}

func TestExecute_FailsOnBadTemplate(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	reg := &stubReader{files: map[string]string{
		"kv/base/bad.ts.tpl": `{{.missingKey}}`,
	}}

	p := plan.Plan{
		Primitive: "kv",
		Adapter:   "memory",
		Files: []plan.FileOp{
			{
				SrcPath:  "base/bad.ts.tpl",
				DestPath: filepath.Join(dir, "bad.ts"),
				Template: true,
			},
		},
	}

	err := Execute(reg, p, ExecuteOptions{TemplateData: TemplateData{}})
	if err == nil {
		t.Fatal("expected error for bad template, got nil")
	}
}

func TestExecute_EmptyPlan(t *testing.T) {
	t.Parallel()

	reg := &stubReader{files: map[string]string{}}

	err := Execute(reg, plan.Plan{}, ExecuteOptions{})
	if err != nil {
		t.Fatalf("unexpected error for empty plan: %v", err)
	}
}
