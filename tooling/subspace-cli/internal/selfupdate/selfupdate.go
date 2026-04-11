package selfupdate

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

const (
	apiBaseURL              = "https://api.github.com"
	releaseRepoOwner        = "warp-oss-org"
	releaseRepoName         = "subspace"
	releaseTagPrefix        = "subspace-cli-v"
	checksumsAssetName      = "checksums.txt"
	releaseMetadataAsset    = "release-metadata.json"
	releaseMetadataSchemaV1 = "subspace.cli.release.v1"
)

type Client struct {
	baseURL string
	client  *http.Client
}

type Release struct {
	TagName     string    `json:"tag_name"`
	Draft       bool      `json:"draft"`
	Prerelease  bool      `json:"prerelease"`
	PublishedAt time.Time `json:"published_at"`
	Assets      []Asset   `json:"assets"`
}

type Asset struct {
	Name string `json:"name"`
	URL  string `json:"browser_download_url"`
}

type ReleaseMetadata struct {
	SchemaVersion  string                 `json:"schemaVersion"`
	ReleaseVersion string                 `json:"releaseVersion"`
	SourceGitSHA   string                 `json:"sourceGitSHA"`
	Assets         []ReleaseMetadataAsset `json:"assets"`
}

type ReleaseMetadataAsset struct {
	Name string `json:"name"`
}

func NewClient(httpClient *http.Client) *Client {
	client := httpClient
	if client == nil {
		client = http.DefaultClient
	}
	return &Client{
		baseURL: apiBaseURL,
		client:  client,
	}
}

func (c *Client) LatestRelease(ctx context.Context) (Release, error) {
	req, err := c.newJSONRequest(ctx, http.MethodGet, "/repos/"+releaseRepoOwner+"/"+releaseRepoName+"/releases?per_page=30")
	if err != nil {
		return Release{}, err
	}

	var releases []Release
	if err := c.doJSON(req, &releases); err != nil {
		return Release{}, err
	}

	candidates := make([]Release, 0, len(releases))
	for _, release := range releases {
		if release.Draft || release.Prerelease {
			continue
		}
		if !strings.HasPrefix(release.TagName, releaseTagPrefix) {
			continue
		}
		candidates = append(candidates, release)
	}
	if len(candidates) == 0 {
		return Release{}, fmt.Errorf("no published %s releases found", releaseTagPrefix)
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		return candidates[i].PublishedAt.After(candidates[j].PublishedAt)
	})
	return candidates[0], nil
}

func (c *Client) ReleaseByTag(ctx context.Context, tag string) (Release, error) {
	if !strings.HasPrefix(tag, releaseTagPrefix) {
		return Release{}, fmt.Errorf("release tag must start with %s", releaseTagPrefix)
	}

	req, err := c.newJSONRequest(ctx, http.MethodGet, "/repos/"+releaseRepoOwner+"/"+releaseRepoName+"/releases/tags/"+url.PathEscape(tag))
	if err != nil {
		return Release{}, err
	}

	var release Release
	if err := c.doJSON(req, &release); err != nil {
		return Release{}, err
	}
	if release.Draft {
		return Release{}, fmt.Errorf("release %s is still a draft", tag)
	}
	if release.Prerelease {
		return Release{}, fmt.Errorf("release %s is a prerelease", tag)
	}
	return release, nil
}

func (c *Client) ReleaseMetadata(ctx context.Context, release Release) (ReleaseMetadata, error) {
	asset, err := FindAsset(release, releaseMetadataAsset)
	if err != nil {
		return ReleaseMetadata{}, err
	}

	b, err := c.DownloadAsset(ctx, asset)
	if err != nil {
		return ReleaseMetadata{}, err
	}

	var metadata ReleaseMetadata
	if err := json.Unmarshal(b, &metadata); err != nil {
		return ReleaseMetadata{}, fmt.Errorf("parse %s: %w", releaseMetadataAsset, err)
	}
	if metadata.SchemaVersion != releaseMetadataSchemaV1 {
		return ReleaseMetadata{}, fmt.Errorf("unsupported release metadata schemaVersion %q", metadata.SchemaVersion)
	}
	if strings.TrimSpace(metadata.ReleaseVersion) == "" {
		return ReleaseMetadata{}, fmt.Errorf("%s missing releaseVersion", releaseMetadataAsset)
	}
	if strings.TrimSpace(metadata.SourceGitSHA) == "" {
		return ReleaseMetadata{}, fmt.Errorf("%s missing sourceGitSHA", releaseMetadataAsset)
	}
	return metadata, nil
}

func (c *Client) Checksums(ctx context.Context, release Release) (map[string]string, error) {
	asset, err := FindAsset(release, checksumsAssetName)
	if err != nil {
		return nil, err
	}

	b, err := c.DownloadAsset(ctx, asset)
	if err != nil {
		return nil, err
	}
	return ParseChecksums(b)
}

func (c *Client) DownloadAsset(ctx context.Context, asset Asset) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, asset.URL, nil)
	if err != nil {
		return nil, fmt.Errorf("create download request for %s: %w", asset.Name, err)
	}
	req.Header.Set("User-Agent", "subspace-cli")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download %s: %w", asset.Name, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("download %s: unexpected status %s", asset.Name, resp.Status)
	}

	b, err := io.ReadAll(io.LimitReader(resp.Body, 128<<20))
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", asset.Name, err)
	}
	return b, nil
}

func FindAsset(release Release, name string) (Asset, error) {
	for _, asset := range release.Assets {
		if asset.Name == name {
			return asset, nil
		}
	}
	return Asset{}, fmt.Errorf("release %s is missing asset %s", release.TagName, name)
}

func ParseChecksums(b []byte) (map[string]string, error) {
	out := map[string]string{}
	scanner := bufio.NewScanner(strings.NewReader(string(b)))
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "  ", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid checksum line %d", lineNumber)
		}
		sum := strings.TrimSpace(parts[0])
		name := strings.TrimSpace(parts[1])
		if len(sum) != sha256.Size*2 {
			return nil, fmt.Errorf("invalid checksum length for %s", name)
		}
		if _, err := hex.DecodeString(sum); err != nil {
			return nil, fmt.Errorf("invalid checksum for %s: %w", name, err)
		}
		out[name] = strings.ToLower(sum)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan checksums: %w", err)
	}
	if len(out) == 0 {
		return nil, errors.New("checksums.txt is empty")
	}
	return out, nil
}

func VerifyChecksum(name string, b []byte, checksums map[string]string) error {
	want, ok := checksums[name]
	if !ok {
		return fmt.Errorf("checksums.txt is missing %s", name)
	}
	got := sha256.Sum256(b)
	if hex.EncodeToString(got[:]) != strings.ToLower(want) {
		return fmt.Errorf("checksum mismatch for %s", name)
	}
	return nil
}

func AssetName(goos, goarch string) (string, error) {
	switch {
	case goos == "darwin" && goarch == "amd64":
		return "subspace-cli-darwin-amd64", nil
	case goos == "darwin" && goarch == "arm64":
		return "subspace-cli-darwin-arm64", nil
	case goos == "linux" && goarch == "amd64":
		return "subspace-cli-linux-amd64", nil
	case goos == "linux" && goarch == "arm64":
		return "subspace-cli-linux-arm64", nil
	case goos == "windows" && goarch == "amd64":
		return "subspace-cli-windows-amd64.exe", nil
	default:
		return "", fmt.Errorf("self-update is unsupported on %s/%s", goos, goarch)
	}
}

func ResolveExecutableTarget(goos string) (string, error) {
	if goos == "windows" {
		return "", fmt.Errorf("self-update is not supported on windows; download the new binary from GitHub Releases")
	}

	executablePath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("resolve current executable: %w", err)
	}

	targetPath := executablePath
	if resolved, err := filepath.EvalSymlinks(executablePath); err == nil {
		targetPath = resolved
	}

	if reason, managed := managedInstallReason(targetPath); managed {
		return "", fmt.Errorf("%s; reinstall the latest GitHub Release binary instead of using subspace update", reason)
	}

	dir := filepath.Dir(targetPath)
	testFile, err := os.CreateTemp(dir, ".subspace-update-*")
	if err != nil {
		return "", fmt.Errorf("binary directory is not writable: %w", err)
	}
	name := testFile.Name()
	if err := testFile.Close(); err != nil {
		_ = os.Remove(name)
		return "", fmt.Errorf("close temp file: %w", err)
	}
	if err := os.Remove(name); err != nil {
		return "", fmt.Errorf("remove temp file: %w", err)
	}

	return targetPath, nil
}

func ReplaceExecutable(targetPath string, b []byte) (string, error) {
	info, err := os.Stat(targetPath)
	if err != nil {
		return "", fmt.Errorf("stat current executable: %w", err)
	}

	dir := filepath.Dir(targetPath)
	tmp, err := os.CreateTemp(dir, ".subspace-update-*")
	if err != nil {
		return "", fmt.Errorf("create temp binary: %w", err)
	}
	tmpPath := tmp.Name()

	if _, err := tmp.Write(b); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("write temp binary: %w", err)
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("close temp binary: %w", err)
	}
	if err := os.Chmod(tmpPath, info.Mode()&0o755|0o700); err != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("chmod temp binary: %w", err)
	}
	if err := os.Rename(tmpPath, targetPath); err != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("replace executable %s: %w", targetPath, err)
	}
	return targetPath, nil
}

func managedInstallReason(path string) (string, bool) {
	normalized := filepath.ToSlash(path)
	switch {
	case strings.Contains(normalized, "/Cellar/"):
		return "current binary appears to be managed by Homebrew", true
	case strings.Contains(normalized, "/nix/store/"):
		return "current binary appears to be managed by Nix", true
	default:
		return "", false
	}
}

func (c *Client) newJSONRequest(ctx context.Context, method, p string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(c.baseURL, "/")+p, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "subspace-cli")
	return req, nil
}

func (c *Client) doJSON(req *http.Request, out any) error {
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("release lookup failed: %s", resp.Status)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("release lookup failed: %s", resp.Status)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode release response: %w", err)
	}
	return nil
}

func CurrentPlatform() (string, string) {
	return runtime.GOOS, runtime.GOARCH
}
