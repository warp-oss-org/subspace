package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/fsx"
	"gopkg.in/yaml.v3"
)

const DefaultConfigFilename = "subspace.config.yaml"

type Config struct {
	TargetDir      string `yaml:"targetDir"`
	Language       string `yaml:"language"`
	PackageManager string `yaml:"packageManager"`
}

func Default() Config {
	return Config{
		TargetDir:      "src/infra/subspace",
		Language:       "typescript",
		PackageManager: "pnpm",
	}
}

func (c *Config) Normalize() {
	c.TargetDir = strings.TrimSpace(c.TargetDir)
	c.Language = strings.ToLower(strings.TrimSpace(c.Language))
	c.PackageManager = strings.ToLower(strings.TrimSpace(c.PackageManager))
}

func (c Config) Validate() error {
	if c.TargetDir == "" {
		return errors.New("targetDir is required")
	}
	if c.Language == "" {
		return errors.New("language is required")
	}
	if c.PackageManager == "" {
		return errors.New("packageManager is required")
	}

	if _, err := fsx.ValidateRelativePath(c.TargetDir); err != nil {
		return fmt.Errorf("targetDir: %w", err)
	}

	switch c.Language {
	case "typescript":
	default:
		return fmt.Errorf("unsupported language: %q (v1 supports: typescript)", c.Language)
	}

	switch c.PackageManager {
	case "pnpm", "npm", "yarn", "bun":
	default:
		return fmt.Errorf("unsupported packageManager: %q (supported: pnpm, npm, yarn, bun)", c.PackageManager)
	}

	return nil
}

func Load(path string) (Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("read config %q: %w", path, err)
	}

	var c Config
	if err := yaml.Unmarshal(b, &c); err != nil {
		return Config{}, fmt.Errorf("parse config %q: %w", path, err)
	}

	c.Normalize()

	if err := c.Validate(); err != nil {
		return Config{}, fmt.Errorf("invalid config %q: %w", path, err)
	}

	return c, nil
}

func WriteDefault(path string) error {
	if _, err := os.Stat(path); err == nil {
		return fmt.Errorf("config already exists: %s", path)
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("stat config %q: %w", path, err)
	}

	c := Default()
	c.Normalize()
	if err := c.Validate(); err != nil {
		return fmt.Errorf("default config invalid: %w", err)
	}

	out, err := yaml.Marshal(&c)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("mkdir %q: %w", dir, err)
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, out, 0o644); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("write temp config %q: %w", tmp, err)
	}

	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("rename config %q: %w", path, err)
	}

	return nil
}
