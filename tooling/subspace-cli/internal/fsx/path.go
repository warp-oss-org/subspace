package fsx

import (
	"fmt"
	"path/filepath"
	"strings"
)

// ValidateRelativePath returns a cleaned path that cannot escape its base.
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
