package registry

import (
	"fmt"
	"path"
	"regexp"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/fsx"
)

var primitiveNameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9\-_]*$`)

func validatePrimitiveName(name string) error {
	if !primitiveNameRe.MatchString(name) {
		return fmt.Errorf("invalid primitive name %q (allowed: lowercase alphanumeric, -, _)", name)
	}
	return nil
}

// primitivePath joins a primitive name with a known-safe relative suffix.
// Used for fixed paths like manifest.yaml and README.md.
func primitivePath(primitive, file string) string {
	return path.Join(primitive, file)
}

// safePrimitiveJoin joins a primitive name with a user/manifest-provided relative path.
// Validates the relative path to prevent traversal outside the primitive directory.
// Uses path (slash-separated) because fs.FS uses forward slashes.
func safePrimitiveJoin(primitive, rel string) (string, error) {
	if rel == "" {
		return "", fmt.Errorf("relative path is empty")
	}

	// ValidateRelativePath uses filepath (OS-native), but fs.FS uses slashes.
	// Clean with path.Clean first, then validate the cleaned result.
	clean := path.Clean(rel)

	// Convert to OS path for validation, then back to slash for fs.FS.
	if _, err := fsx.ValidateRelativePath(clean); err != nil {
		return "", fmt.Errorf("invalid path %q: %w", rel, err)
	}

	return path.Join(primitive, clean), nil
}
