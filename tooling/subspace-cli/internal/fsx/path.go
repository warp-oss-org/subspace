package fsx

import (
	"fmt"
	"path/filepath"
	"strings"
)

// ValidateRelPath ensures p is a safe, relative path.
// It rejects:
// - empty
// - absolute paths (Unix or Windows)
// - "." or ".."
// - any path that escapes its base (contains ".." after cleaning)
//
// It returns a cleaned, OS-native path.
func ValidateRelativePath(path string) (string, error) {
	rawPath := strings.TrimSpace(path)

	if rawPath == "" {
		return "", fmt.Errorf("path cannot be empty")
	}

	if filepath.IsAbs(rawPath) {
		return "", fmt.Errorf("path must be relative, got absolute: %q", rawPath)
	}

	clean := filepath.Clean(rawPath)

	if clean == "." || clean == ".." {
		return "", fmt.Errorf("path cannot be %q", clean)
	}

	if clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path must not escape base (contains '..'): %q", rawPath)
	}

	parts := strings.Split(clean, string(filepath.Separator))
	for _, part := range parts {
		if part == ".." {
			return "", fmt.Errorf("path must not contain '..' segment: %q", rawPath)
		}
	}

	return clean, nil
}
