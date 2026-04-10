package registry

import (
	"fmt"
	"io/fs"
	"os"
	"path"
	"sort"
	"strings"
)

type Registry interface {
	Source() string
	ListPrimitives() ([]string, error)
	LoadManifest(primitive string) (Manifest, error)
	ReadPrimitiveFile(primitive, relPath string) ([]byte, error)
	ListPrimitiveFiles(primitive, fromDir string, excludes []string) ([]string, error)
}

func Open(embedded fs.FS) (Registry, error) {
	if dir := os.Getenv("SUBSPACE_REGISTRY_DIR"); dir != "" {
		if os.Getenv("SUBSPACE_REGISTRY_URL") != "" {
			return nil, fmt.Errorf("set either SUBSPACE_REGISTRY_DIR or SUBSPACE_REGISTRY_URL, not both")
		}
		return openLocal(dir)
	}
	if url := os.Getenv("SUBSPACE_REGISTRY_URL"); url != "" {
		return openRemote(url, os.Getenv("SUBSPACE_REGISTRY_SHA256"))
	}

	return OpenFS("embedded", embedded)
}

func OpenFS(src string, base fs.FS) (Registry, error) {
	rootFS, root, err := resolveRegistryRoot(base)
	if err != nil {
		return nil, err
	}
	resolvedSrc := src
	if root != "." {
		resolvedSrc = src + ":" + root
	}
	if HasIndex(rootFS) {
		if _, err := ValidateIndex(rootFS); err != nil {
			return nil, fmt.Errorf("validate registry index: %w", err)
		}
	}
	return &fsRegistry{src: resolvedSrc, fs: rootFS}, nil
}

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
			continue
		}
		if _, err := r.LoadManifest(e.Name()); err != nil {
			continue
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
