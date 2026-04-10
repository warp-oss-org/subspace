package registry

import (
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
)

func openLocal(dir string) (Registry, error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return nil, fmt.Errorf("resolve SUBSPACE_REGISTRY_DIR %q: %w", dir, err)
	}

	info, err := os.Stat(abs)
	if err != nil {
		return nil, fmt.Errorf("stat SUBSPACE_REGISTRY_DIR %q: %w", abs, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("SUBSPACE_REGISTRY_DIR is not a directory: %q", abs)
	}

	reg, err := OpenFS("local:"+abs, os.DirFS(abs))
	if err != nil {
		return nil, fmt.Errorf("open SUBSPACE_REGISTRY_DIR %q: %w", abs, err)
	}
	return reg, nil
}

func resolveRegistryRoot(base fs.FS) (fs.FS, string, error) {
	if info, err := fs.Stat(base, IndexFilename); err == nil && !info.IsDir() {
		return base, ".", nil
	} else if err != nil && !os.IsNotExist(err) {
		return nil, "", fmt.Errorf("stat registry index: %w", err)
	}

	if info, err := fs.Stat(base, path.Join("registry", IndexFilename)); err == nil && !info.IsDir() {
		sub, subErr := fs.Sub(base, "registry")
		if subErr != nil {
			return nil, "", fmt.Errorf("open registry subdir: %w", subErr)
		}
		return sub, "registry", nil
	} else if err != nil && !os.IsNotExist(err) {
		return nil, "", fmt.Errorf("stat registry subdir: %w", err)
	}

	info, err := fs.Stat(base, "packages")
	if err == nil && info.IsDir() {
		sub, subErr := fs.Sub(base, "packages")
		if subErr != nil {
			return nil, "", fmt.Errorf("open packages subdir: %w", subErr)
		}
		return sub, "packages", nil
	}
	if err != nil && !os.IsNotExist(err) {
		return nil, "", fmt.Errorf("stat packages dir: %w", err)
	}
	if _, readErr := fs.ReadDir(base, "."); readErr != nil {
		return nil, "", fmt.Errorf("read registry root: %w", readErr)
	}
	return base, ".", nil
}
