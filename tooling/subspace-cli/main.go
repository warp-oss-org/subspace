package main

import (
	"os"
	"path/filepath"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/cmd"
)

func main() {
	if packagesDir, ok := discoverPackagesDir(); ok {
		cmd.Execute(os.DirFS(packagesDir))
		return
	}

	cmd.Execute(embeddedRegistry)
}

func discoverPackagesDir() (string, bool) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", false
	}

	dir := cwd
	for {
		candidate := filepath.Join(dir, "packages")
		info, err := os.Stat(candidate)
		if err == nil && info.IsDir() && hasAnyPrimitiveManifest(candidate) {
			return candidate, true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", false
		}
		dir = parent
	}
}

func hasAnyPrimitiveManifest(packagesDir string) bool {
	entries, err := os.ReadDir(packagesDir)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		manifestPath := filepath.Join(packagesDir, e.Name(), "manifest.yaml")
		info, err := os.Stat(manifestPath)
		if err == nil && !info.IsDir() {
			return true
		}
	}
	return false
}
