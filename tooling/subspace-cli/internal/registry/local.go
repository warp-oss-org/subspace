package registry

import (
	"fmt"
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

	return &fsRegistry{src: "local:" + abs, fs: os.DirFS(abs)}, nil
}
