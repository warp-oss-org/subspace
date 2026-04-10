package tsconfig

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/fsx"
)

type TSConfig struct {
	Data map[string]any
}

func Load(path string) (TSConfig, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return TSConfig{}, fmt.Errorf("read tsconfig %q: %w", path, err)
	}

	dec := json.NewDecoder(bytes.NewReader(b))
	dec.UseNumber()

	var root map[string]any
	if err := dec.Decode(&root); err != nil {
		return TSConfig{}, fmt.Errorf("parse tsconfig %q: %w", path, err)
	}
	if root == nil {
		root = map[string]any{}
	}

	return TSConfig{Data: root}, nil
}

func EnsureSubspaceAlias(cfg *TSConfig, targetDir string) error {
	if cfg == nil {
		return fmt.Errorf("tsconfig is nil")
	}
	if _, err := fsx.ValidateRelativePath(targetDir); err != nil {
		return fmt.Errorf("invalid targetDir %q: %w", targetDir, err)
	}

	if cfg.Data == nil {
		cfg.Data = map[string]any{}
	}

	compilerOptions := ensureObject(cfg.Data, "compilerOptions")
	if _, ok := compilerOptions["baseUrl"]; !ok {
		compilerOptions["baseUrl"] = "."
	}

	paths := ensureObject(compilerOptions, "paths")
	aliasTarget := "./" + strings.ReplaceAll(targetDir, "\\", "/") + "/*"
	paths["@subspace/*"] = []string{aliasTarget}

	return nil
}

func WriteAtomic(path string, cfg TSConfig) error {
	if cfg.Data == nil {
		cfg.Data = map[string]any{}
	}

	b, err := json.MarshalIndent(cfg.Data, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal tsconfig %q: %w", path, err)
	}
	b = append(b, '\n')

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("mkdir %q: %w", dir, err)
	}

	tmp, err := os.CreateTemp(dir, filepath.Base(path)+".tmp-*")
	if err != nil {
		return fmt.Errorf("create temp for %q: %w", path, err)
	}
	tmpName := tmp.Name()

	if _, err := tmp.Write(b); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmpName)
		return fmt.Errorf("write temp tsconfig %q: %w", tmpName, err)
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpName)
		return fmt.Errorf("close temp tsconfig %q: %w", tmpName, err)
	}

	if err := os.Rename(tmpName, path); err != nil {
		_ = os.Remove(tmpName)
		return fmt.Errorf("rename tsconfig %q: %w", path, err)
	}

	return nil
}

func ensureObject(parent map[string]any, key string) map[string]any {
	if v, ok := parent[key]; ok {
		if m, ok := v.(map[string]any); ok {
			return m
		}
	}
	m := map[string]any{}
	parent[key] = m
	return m
}
