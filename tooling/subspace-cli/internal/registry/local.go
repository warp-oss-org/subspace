package registry

import (
	"fmt"
	"io/fs"
	"os"
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

	rootFS, _, err := resolveRegistryRoot(os.DirFS(abs))
	if err != nil {
		return nil, fmt.Errorf("open SUBSPACE_REGISTRY_DIR %q: %w", abs, err)
	}

	return &fsRegistry{src: "local:" + abs, fs: rootFS}, nil
}

func resolveRegistryRoot(base fs.FS) (fs.FS, string, error) {
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
