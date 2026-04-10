package registry

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

const remoteFetchTimeout = 30 * time.Second

func openRemote(registryURL, expectedSHA256 string) (Registry, error) {
	client, err := remoteHTTPClient(os.Getenv("SUBSPACE_REGISTRY_CA_FILE"))
	if err != nil {
		return nil, err
	}
	return openRemoteWithClient(registryURL, expectedSHA256, client)
}

func remoteHTTPClient(caFile string) (*http.Client, error) {
	client := &http.Client{Timeout: remoteFetchTimeout}
	if strings.TrimSpace(caFile) == "" {
		return client, nil
	}

	pem, err := os.ReadFile(caFile)
	if err != nil {
		return nil, fmt.Errorf("read SUBSPACE_REGISTRY_CA_FILE: %w", err)
	}
	pool, err := x509.SystemCertPool()
	if err != nil {
		pool = x509.NewCertPool()
	}
	if !pool.AppendCertsFromPEM(pem) {
		return nil, fmt.Errorf("SUBSPACE_REGISTRY_CA_FILE contains no PEM certificates")
	}
	client.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{
			RootCAs:    pool,
			MinVersion: tls.VersionTLS12,
		},
	}
	return client, nil
}

func openRemoteWithClient(registryURL, expectedSHA256 string, client *http.Client) (Registry, error) {
	if strings.TrimSpace(expectedSHA256) == "" {
		return nil, fmt.Errorf("SUBSPACE_REGISTRY_SHA256 is required when SUBSPACE_REGISTRY_URL is set")
	}

	u, err := url.Parse(registryURL)
	if err != nil {
		return nil, fmt.Errorf("parse SUBSPACE_REGISTRY_URL: %w", err)
	}
	if u.Scheme != "https" {
		return nil, fmt.Errorf("SUBSPACE_REGISTRY_URL must use https")
	}

	req, err := http.NewRequest(http.MethodGet, registryURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create registry request: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch registry: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("fetch registry: unexpected status %s", resp.Status)
	}

	archiveBytes, err := io.ReadAll(io.LimitReader(resp.Body, 128<<20))
	if err != nil {
		return nil, fmt.Errorf("read registry archive: %w", err)
	}
	if got, want := HashBytes(archiveBytes), normalizeSHA256(expectedSHA256); got != want {
		return nil, fmt.Errorf("registry archive sha256 mismatch: got %s want %s", got, want)
	}

	dir, err := extractRegistryArchive(archiveBytes)
	if err != nil {
		return nil, err
	}

	reg, err := OpenFS("remote:"+registryURL, os.DirFS(dir))
	if err != nil {
		return nil, fmt.Errorf("open remote registry: %w", err)
	}
	return reg, nil
}

func normalizeSHA256(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.TrimPrefix(s, "sha256:")
	return s
}

func extractRegistryArchive(archiveBytes []byte) (string, error) {
	dir, err := os.MkdirTemp("", "subspace-registry-*")
	if err != nil {
		return "", fmt.Errorf("create registry temp dir: %w", err)
	}

	tr, closeReader, err := tarReader(archiveBytes)
	if err != nil {
		_ = os.RemoveAll(dir)
		return "", err
	}
	defer closeReader()

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			_ = os.RemoveAll(dir)
			return "", fmt.Errorf("read registry archive: %w", err)
		}

		clean, err := validateArchivePath(header.Name)
		if err != nil {
			_ = os.RemoveAll(dir)
			return "", err
		}
		if clean == "" {
			continue
		}
		target := filepath.Join(dir, filepath.FromSlash(clean))
		if err := validateExtractTarget(dir, target); err != nil {
			_ = os.RemoveAll(dir)
			return "", err
		}
		if err := extractArchiveEntry(tr, header, target, clean); err != nil {
			_ = os.RemoveAll(dir)
			return "", err
		}
	}

	return dir, nil
}

func extractArchiveEntry(tr *tar.Reader, header *tar.Header, target, cleanPath string) error {
	switch header.Typeflag {
	case tar.TypeDir:
		if err := os.MkdirAll(target, 0o755); err != nil {
			return fmt.Errorf("mkdir archive directory %q: %w", cleanPath, err)
		}
		return nil
	case tar.TypeReg, tar.TypeRegA:
		return extractArchiveFile(tr, header, target, cleanPath)
	default:
		return fmt.Errorf("unsupported archive entry %q type %d", header.Name, header.Typeflag)
	}
}

func extractArchiveFile(tr *tar.Reader, header *tar.Header, target, cleanPath string) error {
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return fmt.Errorf("mkdir archive file directory %q: %w", cleanPath, err)
	}

	mode := fs.FileMode(header.Mode) & 0o644
	out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, mode)
	if err != nil {
		return fmt.Errorf("create archive file %q: %w", cleanPath, err)
	}

	if _, err := io.Copy(out, tr); err != nil {
		_ = out.Close()
		return fmt.Errorf("write archive file %q: %w", cleanPath, err)
	}
	if err := out.Close(); err != nil {
		return fmt.Errorf("close archive file %q: %w", cleanPath, err)
	}
	return nil
}

func tarReader(archiveBytes []byte) (*tar.Reader, func(), error) {
	raw := bytes.NewReader(archiveBytes)
	gz, err := gzip.NewReader(raw)
	if err == nil {
		return tar.NewReader(gz), func() { _ = gz.Close() }, nil
	}

	raw.Seek(0, io.SeekStart)
	return tar.NewReader(raw), func() {}, nil
}

func validateArchivePath(p string) (string, error) {
	raw := strings.TrimPrefix(strings.TrimSpace(p), "./")
	raw = strings.TrimSuffix(raw, "/")
	clean := path.Clean(raw)
	if clean == "." || clean == "" {
		return "", nil
	}
	if strings.HasPrefix(clean, "../") || clean == ".." || path.IsAbs(clean) {
		return "", fmt.Errorf("archive path %q escapes registry root", p)
	}
	if clean != raw {
		return "", fmt.Errorf("archive path %q must be clean", p)
	}
	return clean, nil
}

func validateExtractTarget(root, target string) error {
	root = filepath.Clean(root)
	target = filepath.Clean(target)
	if target == root {
		return nil
	}
	prefix := root + string(os.PathSeparator)
	if !strings.HasPrefix(target, prefix) {
		return fmt.Errorf("archive target %q escapes registry root", target)
	}
	return nil
}
