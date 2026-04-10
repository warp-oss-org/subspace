package registry

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestOpenRemoteWithClient_VerifiesArchiveHash(t *testing.T) {
	t.Parallel()

	archive := validRegistryArchive(t)
	server := newTLSServerOrSkip(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(archive)
	}))
	defer server.Close()

	_, err := openRemoteWithClient(server.URL, strings.Repeat("0", 64), server.Client())
	if err == nil {
		t.Fatal("expected hash mismatch, got nil")
	}
	if !strings.Contains(err.Error(), "sha256 mismatch") {
		t.Fatalf("expected hash mismatch error, got %v", err)
	}
}

func TestOpenRemoteWithClient_LoadsHTTPSRegistry(t *testing.T) {
	t.Parallel()

	archive := validRegistryArchive(t)
	server := newTLSServerOrSkip(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(archive)
	}))
	defer server.Close()

	reg, err := openRemoteWithClient(server.URL, HashBytes(archive), server.Client())
	if err != nil {
		t.Fatalf("openRemoteWithClient: %v", err)
	}

	primitives, err := reg.ListPrimitives()
	if err != nil {
		t.Fatalf("ListPrimitives: %v", err)
	}
	if len(primitives) != 1 || primitives[0] != "kv" {
		t.Fatalf("unexpected primitives: %v", primitives)
	}
}

func newTLSServerOrSkip(t *testing.T, handler http.Handler) *httptest.Server {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("local listener unavailable: %v", err)
	}
	server := httptest.NewUnstartedServer(handler)
	server.Listener = listener
	server.StartTLS()
	return server
}

func TestExtractRegistryArchive_RejectsTraversal(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	if err := tw.WriteHeader(&tar.Header{Name: "../evil", Typeflag: tar.TypeReg, Mode: 0o644, Size: 1}); err != nil {
		t.Fatalf("write tar header: %v", err)
	}
	if _, err := tw.Write([]byte("x")); err != nil {
		t.Fatalf("write tar body: %v", err)
	}
	if err := tw.Close(); err != nil {
		t.Fatalf("close tar: %v", err)
	}
	if err := gz.Close(); err != nil {
		t.Fatalf("close gzip: %v", err)
	}

	_, err := extractRegistryArchive(buf.Bytes())
	if err == nil {
		t.Fatal("expected traversal error, got nil")
	}
	if !strings.Contains(err.Error(), "escapes") {
		t.Fatalf("expected traversal error, got %v", err)
	}
}

func validRegistryArchive(t *testing.T) []byte {
	t.Helper()

	dir := t.TempDir()
	manifest := []byte(validIndexedManifestYAML("kv"))
	source := []byte("export const value = 1\n")
	writeFile(t, dir, "kv/manifest.yaml", manifest)
	writeFile(t, dir, "kv/src/index.ts", source)
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
					{Path: "kv/src/index.ts", SHA256: HashBytes(source)},
				},
			},
		},
	})

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	files := []string{IndexFilename, "kv/manifest.yaml", "kv/src/index.ts"}
	for _, rel := range files {
		p := filepath.Join(dir, filepath.FromSlash(rel))
		b, err := os.ReadFile(p)
		if err != nil {
			t.Fatalf("read %s: %v", rel, err)
		}
		if err := tw.WriteHeader(&tar.Header{Name: rel, Typeflag: tar.TypeReg, Mode: 0o644, Size: int64(len(b))}); err != nil {
			t.Fatalf("write tar header %s: %v", rel, err)
		}
		if _, err := tw.Write(b); err != nil {
			t.Fatalf("write tar file %s: %v", rel, err)
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
