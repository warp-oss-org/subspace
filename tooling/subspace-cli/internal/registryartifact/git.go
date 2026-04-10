package registryartifact

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

func ResolveSourceGitSHA(sourceDir string) (string, error) {
	out, err := exec.Command("git", "-C", sourceDir, "rev-parse", "HEAD").Output()
	if err != nil {
		return "", fmt.Errorf("resolve source git SHA: %w", err)
	}
	sha := strings.TrimSpace(string(out))
	if sha == "" {
		return "", fmt.Errorf("resolve source git SHA: empty output")
	}
	return sha, nil
}

func CountFiles(items []registry.IndexItem) int {
	count := 0
	for _, item := range items {
		count += len(item.Files)
	}
	return count
}
