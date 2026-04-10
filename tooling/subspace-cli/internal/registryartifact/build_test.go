package registryartifact

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"sort"
	"testing"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

func TestBuild_DeterministicAndValidates(t *testing.T) {
	t.Parallel()

	source := realPackagesDir(t)
	outA := filepath.Join(t.TempDir(), "registry")
	outB := filepath.Join(t.TempDir(), "registry")

	resultA, err := Build(BuildOptions{SourceDir: source, OutDir: outA, SourceGitSHA: "test-sha"})
	if err != nil {
		t.Fatalf("Build A: %v", err)
	}
	resultB, err := Build(BuildOptions{SourceDir: source, OutDir: outB, SourceGitSHA: "test-sha"})
	if err != nil {
		t.Fatalf("Build B: %v", err)
	}

	if !reflect.DeepEqual(resultA.Index, resultB.Index) {
		t.Fatal("expected deterministic registry index")
	}

	filesA := registryFileHashes(t, outA)
	filesB := registryFileHashes(t, outB)
	if !reflect.DeepEqual(filesA, filesB) {
		t.Fatalf("expected deterministic registry files:\nA: %v\nB: %v", filesA, filesB)
	}

	if _, err := ValidateDir(outA); err != nil {
		t.Fatalf("ValidateDir: %v", err)
	}
}

func TestBuild_TarRoundTripPreservesHashes(t *testing.T) {
	t.Parallel()

	source := realPackagesDir(t)
	out := filepath.Join(t.TempDir(), "registry")
	if _, err := Build(BuildOptions{SourceDir: source, OutDir: out, SourceGitSHA: "test-sha"}); err != nil {
		t.Fatalf("Build: %v", err)
	}

	archive := tarGzipDir(t, out)
	unpacked := t.TempDir()
	untarGzip(t, archive, unpacked)

	if _, err := registry.ValidateIndex(os.DirFS(unpacked)); err != nil {
		t.Fatalf("ValidateIndex unpacked: %v", err)
	}
	if !reflect.DeepEqual(registryFileHashes(t, out), registryFileHashes(t, unpacked)) {
		t.Fatal("expected tar round-trip to preserve file hashes")
	}
}

func TestBuild_FiltersJunkFilesFromBroadCopy(t *testing.T) {
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
	writeTestFile(t, source, "kv/src/package.json", []byte("{}\n"))
	writeTestFile(t, source, "kv/src/dist/generated.js", []byte("generated\n"))
	writeTestFile(t, source, "kv/src/node_modules/pkg/index.js", []byte("module\n"))
	writeTestFile(t, source, "kv/src/docker-compose.yml", []byte("services: {}\n"))
	writeTestFile(t, source, "kv/src/cache.tsbuildinfo", []byte("{}\n"))

	out := filepath.Join(t.TempDir(), "registry")
	result, err := Build(BuildOptions{SourceDir: source, OutDir: out, SourceGitSHA: "test-sha"})
	if err != nil {
		t.Fatalf("Build: %v", err)
	}

	got := map[string]bool{}
	for _, file := range result.Index.Primitives[0].Files {
		got[file.Path] = true
	}
	for _, want := range []string{"kv/manifest.yaml", "kv/src/index.ts"} {
		if !got[want] {
			t.Fatalf("expected %s in registry files: %v", want, got)
		}
	}
	for _, junk := range []string{
		"kv/src/package.json",
		"kv/src/dist/generated.js",
		"kv/src/node_modules/pkg/index.js",
		"kv/src/docker-compose.yml",
		"kv/src/cache.tsbuildinfo",
	} {
		if got[junk] {
			t.Fatalf("did not expect junk file %s in registry files", junk)
		}
	}
}

func TestBuild_RejectsNonEmptyNonRegistryOutputDir(t *testing.T) {
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

	out := t.TempDir()
	writeTestFile(t, out, "keep.txt", []byte("do not delete\n"))

	_, err := Build(BuildOptions{SourceDir: source, OutDir: out, SourceGitSHA: "test-sha"})
	if err == nil {
		t.Fatal("expected non-registry output dir rejection")
	}
	if got := string(mustReadFile(t, filepath.Join(out, "keep.txt"))); got != "do not delete\n" {
		t.Fatalf("expected existing file to be preserved, got %q", got)
	}
}

func registryFileHashes(t *testing.T, dir string) map[string]string {
	t.Helper()

	out := map[string]string{}
	err := filepath.WalkDir(dir, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(dir, p)
		if err != nil {
			return err
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		out[filepath.ToSlash(rel)] = registry.HashBytes(b)
		return nil
	})
	if err != nil {
		t.Fatalf("walk %s: %v", dir, err)
	}
	return out
}

func tarGzipDir(t *testing.T, dir string) []byte {
	t.Helper()

	var files []string
	if err := filepath.WalkDir(dir, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		files = append(files, p)
		return nil
	}); err != nil {
		t.Fatalf("walk %s: %v", dir, err)
	}
	sort.Strings(files)

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for _, file := range files {
		rel, err := filepath.Rel(dir, file)
		if err != nil {
			t.Fatalf("rel %s: %v", file, err)
		}
		b, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		if err := tw.WriteHeader(&tar.Header{
			Name:     filepath.ToSlash(rel),
			Typeflag: tar.TypeReg,
			Mode:     0o644,
			Size:     int64(len(b)),
		}); err != nil {
			t.Fatalf("write tar header %s: %v", rel, err)
		}
		if _, err := tw.Write(b); err != nil {
			t.Fatalf("write tar body %s: %v", rel, err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatalf("close tar: %v", err)
	}
	if err := gz.Close(); err != nil {
		t.Fatalf("close gzip: %v", err)
	}
	return buf.Bytes()
}

func untarGzip(t *testing.T, archive []byte, dir string) {
	t.Helper()

	gz, err := gzip.NewReader(bytes.NewReader(archive))
	if err != nil {
		t.Fatalf("open gzip: %v", err)
	}
	defer gz.Close()
	tr := tar.NewReader(gz)

	for {
		header, err := tr.Next()
		if err == io.EOF {
			return
		}
		if err != nil {
			t.Fatalf("read tar: %v", err)
		}
		target := filepath.Join(dir, filepath.FromSlash(header.Name))
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			t.Fatalf("mkdir %s: %v", header.Name, err)
		}
		b, err := io.ReadAll(tr)
		if err != nil {
			t.Fatalf("read body %s: %v", header.Name, err)
		}
		if err := os.WriteFile(target, b, 0o644); err != nil {
			t.Fatalf("write %s: %v", header.Name, err)
		}
	}
}

func realPackagesDir(t *testing.T) string {
	t.Helper()

	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "..", "..", "packages"))
}

func mustReadFile(t *testing.T, path string) []byte {
	t.Helper()

	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return b
}

func writeTestFile(t *testing.T, dir string, rel string, b []byte) {
	t.Helper()

	p := filepath.Join(dir, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", rel, err)
	}
	if err := os.WriteFile(p, b, 0o644); err != nil {
		t.Fatalf("write %s: %v", rel, err)
	}
}
