package registry

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"path"
	"sort"
	"strings"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/fsx"
)

const (
	IndexFilename = "registry.json"
	SchemaVersion = "subspace.registry.v1"
)

type Index struct {
	SchemaVersion string      `json:"schemaVersion"`
	SourceGitSHA  string      `json:"sourceGitSha"`
	Primitives    []IndexItem `json:"primitives"`
}

type IndexItem struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Language    string      `json:"language"`
	Manifest    string      `json:"manifest"`
	Files       []IndexFile `json:"files"`
}

type IndexFile struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

func HasIndex(fsys fs.FS) bool {
	info, err := fs.Stat(fsys, IndexFilename)
	return err == nil && !info.IsDir()
}

func ReadIndex(fsys fs.FS) (Index, error) {
	b, err := fs.ReadFile(fsys, IndexFilename)
	if err != nil {
		return Index{}, fmt.Errorf("read %s: %w", IndexFilename, err)
	}

	var idx Index
	if err := json.Unmarshal(b, &idx); err != nil {
		return Index{}, fmt.Errorf("parse %s: %w", IndexFilename, err)
	}
	return idx, nil
}

func ValidateIndex(fsys fs.FS) (Index, error) {
	idx, err := ReadIndex(fsys)
	if err != nil {
		return Index{}, err
	}
	if err := validateIndexHeader(idx); err != nil {
		return Index{}, err
	}

	indexedFiles := map[string]struct{}{}
	seenPrimitives := map[string]struct{}{}

	for itemIndex, item := range idx.Primitives {
		if itemIndex > 0 && item.Name <= idx.Primitives[itemIndex-1].Name {
			return Index{}, fmt.Errorf("primitives must be sorted by name")
		}
		if err := validateIndexItem(fsys, itemIndex, item, seenPrimitives, indexedFiles); err != nil {
			return Index{}, err
		}
	}

	if err := validateNoUnindexedFiles(fsys, indexedFiles); err != nil {
		return Index{}, err
	}

	return idx, nil
}

func validateIndexHeader(idx Index) error {
	if idx.SchemaVersion != SchemaVersion {
		return fmt.Errorf("unsupported registry schemaVersion %q", idx.SchemaVersion)
	}
	if strings.TrimSpace(idx.SourceGitSHA) == "" {
		return fmt.Errorf("sourceGitSha is required")
	}
	if len(idx.Primitives) == 0 {
		return fmt.Errorf("primitives must have at least one entry")
	}
	return nil
}

func validateIndexItem(
	fsys fs.FS,
	itemIndex int,
	item IndexItem,
	seenPrimitives map[string]struct{},
	indexedFiles map[string]struct{},
) error {
	if err := validatePrimitiveName(item.Name); err != nil {
		return fmt.Errorf("primitives[%d].name: %w", itemIndex, err)
	}
	if _, ok := seenPrimitives[item.Name]; ok {
		return fmt.Errorf("duplicate primitive %q", item.Name)
	}
	seenPrimitives[item.Name] = struct{}{}

	if expected := path.Join(item.Name, "manifest.yaml"); item.Manifest != expected {
		return fmt.Errorf("primitive %q manifest must be %q", item.Name, expected)
	}

	manifest, err := loadIndexedManifest(fsys, item)
	if err != nil {
		return err
	}
	if err := validateItemManifestMetadata(item, manifest); err != nil {
		return err
	}
	if len(item.Files) == 0 {
		return fmt.Errorf("primitive %q files must have at least one entry", item.Name)
	}

	seenManifest := false
	for fileIndex, file := range item.Files {
		if fileIndex > 0 && file.Path <= item.Files[fileIndex-1].Path {
			return fmt.Errorf("primitive %q files must be sorted by path", item.Name)
		}
		if err := validateIndexFile(fsys, item, fileIndex, file, indexedFiles); err != nil {
			return err
		}
		seenManifest = seenManifest || file.Path == item.Manifest
	}
	if !seenManifest {
		return fmt.Errorf("primitive %q manifest is not listed in files", item.Name)
	}
	return nil
}

func validateItemManifestMetadata(item IndexItem, manifest Manifest) error {
	if manifest.Name != item.Name {
		return fmt.Errorf("primitive %q manifest name mismatch: %q", item.Name, manifest.Name)
	}
	if item.Description != manifest.Description {
		return fmt.Errorf("primitive %q description mismatch", item.Name)
	}
	if item.Language != manifest.Language {
		return fmt.Errorf("primitive %q language mismatch", item.Name)
	}
	return nil
}

func validateIndexFile(
	fsys fs.FS,
	item IndexItem,
	fileIndex int,
	file IndexFile,
	indexedFiles map[string]struct{},
) error {
	clean, err := validateRegistryPath(file.Path)
	if err != nil {
		return fmt.Errorf("primitive %q files[%d].path: %w", item.Name, fileIndex, err)
	}
	if clean != file.Path {
		return fmt.Errorf("primitive %q files[%d].path must be clean: %q", item.Name, fileIndex, file.Path)
	}
	if !strings.HasPrefix(file.Path, item.Name+"/") {
		return fmt.Errorf("primitive %q file %q is outside primitive directory", item.Name, file.Path)
	}
	if _, ok := indexedFiles[file.Path]; ok {
		return fmt.Errorf("duplicate indexed file %q", file.Path)
	}
	indexedFiles[file.Path] = struct{}{}

	return validateIndexedFileHash(fsys, file)
}

func loadIndexedManifest(fsys fs.FS, item IndexItem) (Manifest, error) {
	b, err := fs.ReadFile(fsys, item.Manifest)
	if err != nil {
		return Manifest{}, fmt.Errorf("read manifest %q: %w", item.Manifest, err)
	}
	m, err := ParseManifestYAML(b)
	if err != nil {
		return Manifest{}, fmt.Errorf("parse manifest %q: %w", item.Manifest, err)
	}
	return m, nil
}

func validateIndexedFileHash(fsys fs.FS, file IndexFile) error {
	if len(file.SHA256) != sha256.Size*2 {
		return fmt.Errorf("file %q has invalid sha256 length", file.Path)
	}
	if _, err := hex.DecodeString(file.SHA256); err != nil {
		return fmt.Errorf("file %q has invalid sha256: %w", file.Path, err)
	}

	info, err := fs.Stat(fsys, file.Path)
	if err != nil {
		return fmt.Errorf("stat indexed file %q: %w", file.Path, err)
	}
	if info.IsDir() {
		return fmt.Errorf("indexed file %q is a directory", file.Path)
	}

	b, err := fs.ReadFile(fsys, file.Path)
	if err != nil {
		return fmt.Errorf("read indexed file %q: %w", file.Path, err)
	}
	got := HashBytes(b)
	if got != strings.ToLower(file.SHA256) {
		return fmt.Errorf("hash mismatch for %q: got %s want %s", file.Path, got, file.SHA256)
	}
	return nil
}

func validateNoUnindexedFiles(fsys fs.FS, indexedFiles map[string]struct{}) error {
	var actual []string
	err := fs.WalkDir(fsys, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if p == "." || p == IndexFilename {
			return nil
		}
		actual = append(actual, p)
		return nil
	})
	if err != nil {
		return fmt.Errorf("walk registry files: %w", err)
	}

	sort.Strings(actual)
	for _, p := range actual {
		if _, ok := indexedFiles[p]; !ok {
			return fmt.Errorf("file %q is not listed in %s", p, IndexFilename)
		}
	}
	return nil
}

func validateRegistryPath(p string) (string, error) {
	if p == "" {
		return "", fmt.Errorf("path is empty")
	}
	if p == IndexFilename {
		return "", fmt.Errorf("path must not be %s", IndexFilename)
	}
	clean := path.Clean(p)
	if clean == "." {
		return "", fmt.Errorf("path is empty")
	}
	if _, err := fsx.ValidateRelativePath(clean); err != nil {
		return "", err
	}
	return clean, nil
}

func HashBytes(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}
