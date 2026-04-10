package registry

import (
	"fmt"
	"io/fs"
	"os"
	"path"
	"sort"
	"strings"
)

// Registry provides read access to Subspace primitive templates.
type Registry interface {
	// Source returns a human-readable description of where this registry loads from.
	Source() string

	// ListPrimitives returns sorted names of all valid primitives in the registry.
	ListPrimitives() ([]string, error)

	// LoadManifest parses and structurally validates the manifest for a primitive.
	LoadManifest(primitive string) (Manifest, error)

	// ReadPrimitiveFile reads a file relative to a primitive's root directory.
	ReadPrimitiveFile(primitive, relPath string) ([]byte, error)

	// ListPrimitiveFiles returns all file paths under a primitive source path.
	//
	// `fromDir` is a path relative to the primitive root (e.g. "base", "adapters/redis", "adapters/fs.ts").
	// The returned paths are relative to `fromDir` (e.g. "port.ts", "nested/file.ts").
	// If `fromDir` points to a file, the returned sentinel path is ".".
	// Results are sorted and contain files only (no directories).
	ListPrimitiveFiles(primitive, fromDir string, excludes []string) ([]string, error)
}

// Open returns a Registry. If SUBSPACE_REGISTRY_DIR is set, uses local filesystem.
// Otherwise uses the provided embedded FS.
func Open(embedded fs.FS) (Registry, error) {
	if dir := os.Getenv("SUBSPACE_REGISTRY_DIR"); dir != "" {
		return openLocal(dir)
	}

	rootFS, root, err := resolveRegistryRoot(embedded)
	if err != nil {
		return nil, err
	}
	src := "embedded"
	if root != "." {
		src = "embedded:" + root
	}
	return &fsRegistry{src: src, fs: rootFS}, nil
}

// fsRegistry implements Registry over any fs.FS.
// Used by both embedded and local backends.
type fsRegistry struct {
	src string
	fs  fs.FS
}

func (r *fsRegistry) Source() string { return r.src }

func (r *fsRegistry) ListPrimitives() ([]string, error) {
	entries, err := fs.ReadDir(r.fs, ".")
	if err != nil {
		return nil, fmt.Errorf("list primitives: %w", err)
	}

	var out []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		if validatePrimitiveName(e.Name()) != nil {
			continue // skip non-primitive dirs (notes, etc.)
		}
		if _, err := r.LoadManifest(e.Name()); err != nil {
			continue // only list installable primitives with valid manifests
		}
		out = append(out, e.Name())
	}

	sort.Strings(out)
	return out, nil
}

func (r *fsRegistry) LoadManifest(primitive string) (Manifest, error) {
	if err := validatePrimitiveName(primitive); err != nil {
		return Manifest{}, err
	}

	p := primitivePath(primitive, "manifest.yaml")
	b, err := fs.ReadFile(r.fs, p)
	if err != nil {
		return Manifest{}, fmt.Errorf("load manifest for %q: %w", primitive, err)
	}

	m, err := ParseManifestYAML(b)
	if err != nil {
		return Manifest{}, fmt.Errorf("parse manifest for %q: %w", primitive, err)
	}

	return m, nil
}

func (r *fsRegistry) ReadPrimitiveFile(primitive, relPath string) ([]byte, error) {
	if err := validatePrimitiveName(primitive); err != nil {
		return nil, err
	}

	full, err := safePrimitiveJoin(primitive, relPath)
	if err != nil {
		return nil, fmt.Errorf("read file in %q: %w", primitive, err)
	}

	b, err := fs.ReadFile(r.fs, full)
	if err != nil {
		return nil, fmt.Errorf("read %q in %q: %w", relPath, primitive, err)
	}

	return b, nil
}

func (r *fsRegistry) ListPrimitiveFiles(primitive, fromDir string, excludes []string) ([]string, error) {
	if err := validatePrimitiveName(primitive); err != nil {
		return nil, err
	}

	root, err := safePrimitiveJoin(primitive, fromDir)
	if err != nil {
		return nil, fmt.Errorf("list files in %q: %w", primitive, err)
	}

	info, err := fs.Stat(r.fs, root)
	if err != nil {
		return nil, fmt.Errorf("stat %q/%q: %w", primitive, fromDir, err)
	}
	if !info.IsDir() {
		if shouldExcludeName(path.Base(root), excludes) {
			return nil, nil
		}
		return []string{"."}, nil
	}

	var out []string
	walkErr := fs.WalkDir(r.fs, root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if p == root {
				return nil
			}
			if shouldExcludeName(d.Name(), excludes) {
				return fs.SkipDir
			}
			return nil
		}
		if shouldExcludeName(d.Name(), excludes) {
			return nil
		}

		// fs.FS paths are slash-separated. Produce paths relative to `fromDir`.
		if p == root {
			return nil
		}

		prefix := root + "/"
		rel := strings.TrimPrefix(p, prefix)
		if rel == p {
			return nil
		}
		out = append(out, rel)
		return nil
	})
	if walkErr != nil {
		return nil, fmt.Errorf("list files under %q/%q: %w", primitive, fromDir, walkErr)
	}

	sort.Strings(out)
	return out, nil
}

func shouldExcludeName(name string, patterns []string) bool {
	for _, p := range patterns {
		if hasGlobMeta(p) {
			match, err := path.Match(p, name)
			if err != nil {
				continue
			}
			if match {
				return true
			}
			continue
		}
		if name == p {
			return true
		}
	}
	return false
}

func hasGlobMeta(s string) bool {
	return strings.ContainsAny(s, "*?[")
}
