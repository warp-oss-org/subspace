package registry

import (
	"fmt"
	"io/fs"
	"os"
	"path"
)

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
