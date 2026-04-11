package selfupdate

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestAssetName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		goos    string
		goarch  string
		want    string
		wantErr bool
	}{
		{goos: "darwin", goarch: "arm64", want: "subspace-cli-darwin-arm64"},
		{goos: "linux", goarch: "amd64", want: "subspace-cli-linux-amd64"},
		{goos: "windows", goarch: "amd64", want: "subspace-cli-windows-amd64.exe"},
		{goos: "linux", goarch: "386", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.goos+"-"+tt.goarch, func(t *testing.T) {
			t.Parallel()
			got, err := AssetName(tt.goos, tt.goarch)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("AssetName: %v", err)
			}
			if got != tt.want {
				t.Fatalf("unexpected asset name: got %s want %s", got, tt.want)
			}
		})
	}
}

func TestParseChecksums(t *testing.T) {
	t.Parallel()

	got, err := ParseChecksums([]byte("abc123  bad\n"))
	if err == nil || got != nil {
		t.Fatalf("expected parse error, got %v %v", got, err)
	}

	sum := strings.Repeat("a", 64)
	got, err = ParseChecksums([]byte(sum + "  subspace-cli-linux-amd64\n"))
	if err != nil {
		t.Fatalf("ParseChecksums: %v", err)
	}
	want := map[string]string{"subspace-cli-linux-amd64": sum}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected checksums: got %v want %v", got, want)
	}
}

func TestVerifyChecksum(t *testing.T) {
	t.Parallel()

	payload := []byte("binary")
	sum := sha256.Sum256(payload)
	checksums := map[string]string{"subspace-cli-linux-amd64": hex.EncodeToString(sum[:])}

	if err := VerifyChecksum("subspace-cli-linux-amd64", payload, checksums); err != nil {
		t.Fatalf("VerifyChecksum: %v", err)
	}
	if err := VerifyChecksum("subspace-cli-linux-amd64", []byte("other"), checksums); err == nil {
		t.Fatal("expected mismatch error")
	}
}

func TestLatestReleaseSelectsNewestPublishedMatchingTag(t *testing.T) {
	t.Parallel()

	client := NewClient(&http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.URL.Path != "/repos/warp-oss-org/subspace/releases" {
			t.Fatalf("unexpected path: %s", req.URL.Path)
		}
		return jsonResponse(`[
			{"tag_name":"subspace-cli-v2026.04.10.1","draft":false,"prerelease":false,"published_at":"2026-04-10T10:00:00Z","assets":[]},
			{"tag_name":"subspace-cli-v2026.04.11.2","draft":false,"prerelease":false,"published_at":"2026-04-11T10:00:00Z","assets":[]},
			{"tag_name":"subspace-cli-v2026.04.12.1","draft":true,"prerelease":false,"published_at":"2026-04-12T10:00:00Z","assets":[]}
		]`), nil
	})})
	client.baseURL = "https://example.test"

	release, err := client.LatestRelease(context.Background())
	if err != nil {
		t.Fatalf("LatestRelease: %v", err)
	}
	if release.TagName != "subspace-cli-v2026.04.11.2" {
		t.Fatalf("unexpected latest release: %s", release.TagName)
	}
}

func TestReleaseMetadataAndChecksums(t *testing.T) {
	t.Parallel()

	baseURL := "https://example.test"
	client := NewClient(&http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Path {
		case "/repos/warp-oss-org/subspace/releases/tags/subspace-cli-v2026.04.11.2":
			return jsonResponse(fmt.Sprintf(`{"tag_name":"subspace-cli-v2026.04.11.2","draft":false,"prerelease":false,"assets":[
				{"name":"release-metadata.json","browser_download_url":"%s/assets/release-metadata.json"},
				{"name":"checksums.txt","browser_download_url":"%s/assets/checksums.txt"},
				{"name":"subspace-cli-linux-amd64","browser_download_url":"%s/assets/subspace-cli-linux-amd64"}
			]}`, baseURL, baseURL, baseURL)), nil
		case "/assets/release-metadata.json":
			return jsonResponse(`{"schemaVersion":"subspace.cli.release.v1","releaseVersion":"subspace-cli-v2026.04.11.2","sourceGitSHA":"abc123","assets":[{"name":"checksums.txt"}]}`), nil
		case "/assets/checksums.txt":
			sum := sha256.Sum256([]byte("binary"))
			return textResponse(fmt.Sprintf("%s  subspace-cli-linux-amd64\n", hex.EncodeToString(sum[:]))), nil
		case "/assets/subspace-cli-linux-amd64":
			return textResponse("binary"), nil
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
			return nil, fmt.Errorf("unexpected path: %s", r.URL.Path)
		}
	})})
	client.baseURL = baseURL

	release, err := client.ReleaseByTag(context.Background(), "subspace-cli-v2026.04.11.2")
	if err != nil {
		t.Fatalf("ReleaseByTag: %v", err)
	}
	metadata, err := client.ReleaseMetadata(context.Background(), release)
	if err != nil {
		t.Fatalf("ReleaseMetadata: %v", err)
	}
	if metadata.SourceGitSHA != "abc123" {
		t.Fatalf("unexpected source git sha: %s", metadata.SourceGitSHA)
	}
	checksums, err := client.Checksums(context.Background(), release)
	if err != nil {
		t.Fatalf("Checksums: %v", err)
	}
	b, err := client.DownloadAsset(context.Background(), release.Assets[2])
	if err != nil {
		t.Fatalf("DownloadAsset: %v", err)
	}
	if err := VerifyChecksum("subspace-cli-linux-amd64", b, checksums); err != nil {
		t.Fatalf("VerifyChecksum: %v", err)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func jsonResponse(body string) *http.Response {
	resp := textResponse(body)
	resp.Header.Set("Content-Type", "application/json")
	return resp
}

func textResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Status:     "200 OK",
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func TestResolveExecutableTargetRejectsManagedInstall(t *testing.T) {
	t.Parallel()

	path := "/opt/homebrew/Cellar/subspace/1.0.0/bin/subspace"
	if reason, managed := managedInstallReason(path); !managed || !strings.Contains(reason, "Homebrew") {
		t.Fatalf("expected managed Homebrew path, got managed=%v reason=%q", managed, reason)
	}
}

func TestReplaceExecutable(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	target := filepath.Join(dir, "subspace")
	if err := os.WriteFile(target, []byte("old"), 0o755); err != nil {
		t.Fatalf("write old binary: %v", err)
	}

	replaced, err := ReplaceExecutable(target, []byte("new"))
	if err != nil {
		t.Fatalf("ReplaceExecutable: %v", err)
	}
	if replaced != target {
		t.Fatalf("unexpected replaced path: %s", replaced)
	}
	got, err := os.ReadFile(target)
	if err != nil {
		t.Fatalf("read updated binary: %v", err)
	}
	if string(got) != "new" {
		t.Fatalf("unexpected binary contents: %s", string(got))
	}
}
