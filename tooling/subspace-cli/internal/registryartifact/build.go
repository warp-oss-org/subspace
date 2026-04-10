package registryartifact

import (
	"encoding/json"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

type BuildOptions struct {
	SourceDir    string
	OutDir       string
	SourceGitSHA string
}

type BuildResult struct {
	Index registry.Index
}

func Build(opts BuildOptions) (BuildResult, error) {
	sourceDir, err := filepath.Abs(opts.SourceDir)
	if err != nil {
		return BuildResult{}, fmt.Errorf("resolve source dir: %w", err)
	}
	outDir, err := filepath.Abs(opts.OutDir)
	if err != nil {
		return BuildResult{}, fmt.Errorf("resolve output dir: %w", err)
	}
	if sourceDir == outDir {
		return BuildResult{}, fmt.Errorf("source and output directories must be different")
	}
	if strings.TrimSpace(opts.SourceGitSHA) == "" {
		return BuildResult{}, fmt.Errorf("source git SHA is required")
	}

	source, err := registry.OpenFS("source:"+sourceDir, os.DirFS(sourceDir))
	if err != nil {
		return BuildResult{}, err
	}

	primitives, err := source.ListPrimitives()
	if err != nil {
		return BuildResult{}, err
	}
	if len(primitives) == 0 {
		return BuildResult{}, fmt.Errorf("source registry has no manifest-backed primitives")
	}

	if err := prepareOutputDir(outDir); err != nil {
		return BuildResult{}, err
	}

	idx := registry.Index{
		SchemaVersion: registry.SchemaVersion,
		SourceGitSHA:  opts.SourceGitSHA,
		Primitives:    make([]registry.IndexItem, 0, len(primitives)),
	}

	for _, primitive := range primitives {
		item, err := buildPrimitive(outDir, source, primitive)
		if err != nil {
			return BuildResult{}, err
		}
		idx.Primitives = append(idx.Primitives, item)
	}

	sort.Slice(idx.Primitives, func(i, j int) bool {
		return idx.Primitives[i].Name < idx.Primitives[j].Name
	})

	if err := writeIndex(outDir, idx); err != nil {
		return BuildResult{}, err
	}

	if _, err := registry.ValidateIndex(os.DirFS(outDir)); err != nil {
		return BuildResult{}, fmt.Errorf("validate generated registry: %w", err)
	}

	return BuildResult{Index: idx}, nil
}

func prepareOutputDir(outDir string) error {
	if err := validateOutputDir(outDir); err != nil {
		return err
	}

	entries, err := os.ReadDir(outDir)
	if os.IsNotExist(err) {
		return os.MkdirAll(outDir, 0o755)
	}
	if err != nil {
		return fmt.Errorf("read output dir: %w", err)
	}
	if len(entries) > 0 && !hasGeneratedRegistryIndex(entries) {
		return fmt.Errorf("output dir %q is not empty and does not contain %s", outDir, registry.IndexFilename)
	}
	if err := os.RemoveAll(outDir); err != nil {
		return fmt.Errorf("remove output dir: %w", err)
	}
	return os.MkdirAll(outDir, 0o755)
}

func validateOutputDir(outDir string) error {
	clean := filepath.Clean(outDir)
	if clean == string(filepath.Separator) {
		return fmt.Errorf("refusing to use filesystem root as output dir")
	}
	if clean == "." {
		return fmt.Errorf("refusing to use current directory as output dir")
	}
	return nil
}

func hasGeneratedRegistryIndex(entries []os.DirEntry) bool {
	for _, entry := range entries {
		if !entry.IsDir() && entry.Name() == registry.IndexFilename {
			return true
		}
	}
	return false
}

func buildPrimitive(outDir string, source registry.Registry, primitive string) (registry.IndexItem, error) {
	m, err := source.LoadManifest(primitive)
	if err != nil {
		return registry.IndexItem{}, err
	}

	item := registry.IndexItem{
		Name:        primitive,
		Description: m.Description,
		Language:    m.Language,
		Manifest:    path.Join(primitive, "manifest.yaml"),
	}

	files := map[string]registry.IndexFile{}
	if err := copyIndexedFile(outDir, source, primitive, "manifest.yaml", files); err != nil {
		return registry.IndexItem{}, err
	}
	if err := copyOptionalIndexedFile(outDir, source, primitive, "README.md", files); err != nil {
		return registry.IndexItem{}, err
	}

	sourceFiles, err := manifestSourceFiles(source, primitive, m)
	if err != nil {
		return registry.IndexItem{}, err
	}
	for _, srcPath := range sourceFiles {
		if err := copyIndexedFile(outDir, source, primitive, srcPath, files); err != nil {
			return registry.IndexItem{}, err
		}
	}

	item.Files = sortedIndexFiles(files)
	return item, nil
}

func manifestSourceFiles(
	source registry.Registry,
	primitive string,
	m registry.Manifest,
) ([]string, error) {
	files := map[string]struct{}{}
	for _, op := range manifestCopyOps(m) {
		listed, err := source.ListPrimitiveFiles(primitive, op.From, m.Exclude)
		if err != nil {
			return nil, fmt.Errorf("list %s/%s: %w", primitive, op.From, err)
		}
		for _, rel := range listed {
			srcPath := path.Join(op.From, rel)
			if rel == "." {
				srcPath = op.From
			}
			if !shouldSkipRegistrySourcePath(srcPath) {
				files[srcPath] = struct{}{}
			}
		}
	}

	out := make([]string, 0, len(files))
	for file := range files {
		out = append(out, file)
	}
	sort.Strings(out)
	return out, nil
}

func manifestCopyOps(m registry.Manifest) []registry.CopyOp {
	ops := append([]registry.CopyOp{}, m.Copy...)
	if m.Tests != nil {
		ops = append(ops, m.Tests.Copy...)
	}
	for _, adapterName := range sortedAdapterNames(m) {
		ops = append(ops, m.Adapters[adapterName].Copy...)
	}
	return ops
}

func copyOptionalIndexedFile(
	outDir string,
	source registry.Registry,
	primitive string,
	relPath string,
	files map[string]registry.IndexFile,
) error {
	if _, err := source.ReadPrimitiveFile(primitive, relPath); err != nil {
		return nil
	}
	return copyIndexedFile(outDir, source, primitive, relPath, files)
}

func copyIndexedFile(
	outDir string,
	source registry.Registry,
	primitive string,
	relPath string,
	files map[string]registry.IndexFile,
) error {
	indexPath := path.Join(primitive, relPath)
	if _, ok := files[indexPath]; ok {
		return nil
	}

	b, err := source.ReadPrimitiveFile(primitive, relPath)
	if err != nil {
		return fmt.Errorf("read %s/%s: %w", primitive, relPath, err)
	}

	dest := filepath.Join(outDir, filepath.FromSlash(indexPath))
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return fmt.Errorf("create directory for %s: %w", indexPath, err)
	}
	if err := os.WriteFile(dest, b, 0o644); err != nil {
		return fmt.Errorf("write %s: %w", indexPath, err)
	}

	files[indexPath] = registry.IndexFile{
		Path:   indexPath,
		SHA256: registry.HashBytes(b),
	}
	return nil
}

func writeIndex(outDir string, idx registry.Index) error {
	b, err := json.MarshalIndent(idx, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal registry index: %w", err)
	}
	b = append(b, '\n')
	if err := os.WriteFile(filepath.Join(outDir, registry.IndexFilename), b, 0o644); err != nil {
		return fmt.Errorf("write registry index: %w", err)
	}
	return nil
}

func sortedAdapterNames(m registry.Manifest) []string {
	names := make([]string, 0, len(m.Adapters))
	for name := range m.Adapters {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func sortedIndexFiles(files map[string]registry.IndexFile) []registry.IndexFile {
	out := make([]registry.IndexFile, 0, len(files))
	for _, file := range files {
		out = append(out, file)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Path < out[j].Path
	})
	return out
}

func shouldSkipRegistrySourcePath(p string) bool {
	base := path.Base(p)
	if base == "package.json" || strings.HasSuffix(base, ".tsbuildinfo") {
		return true
	}
	if strings.HasPrefix(base, "docker-compose") {
		return true
	}
	for _, part := range strings.Split(p, "/") {
		if part == "dist" || part == "node_modules" {
			return true
		}
	}
	return false
}
