package cmd

import (
	"errors"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/config"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/tsconfig"
)

func NewInitCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "init",
		Short: "Initialize a subspace.config.yaml in the current directory",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runInit()
		},
	}
}

func runInit() error {
	path := config.DefaultConfigFilename

	if err := config.WriteDefault(path); err != nil {
		return err
	}

	cfg := config.Default()
	if err := ensureTSConfigAlias("tsconfig.json", cfg.TargetDir); err != nil {
		return err
	}

	fmt.Printf("✓ Created %s\n\n", path)
	fmt.Printf("Defaults:\n")
	fmt.Printf("  targetDir:      %s\n", cfg.TargetDir)
	fmt.Printf("  language:       %s\n", cfg.Language)
	fmt.Printf("  packageManager: %s\n", cfg.PackageManager)
	fmt.Printf("\nEdit %s to customize, then run:\n", path)
	fmt.Printf("  subspace add <primitive>\n")

	return nil
}

func ensureTSConfigAlias(tsconfigPath, targetDir string) error {
	cfg, err := tsconfig.Load(tsconfigPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("TypeScript config not found at %q. Create tsconfig.json at repo root, then rerun `subspace init`", tsconfigPath)
		}
		return err
	}

	if err := tsconfig.EnsureSubspaceAlias(&cfg, targetDir); err != nil {
		return fmt.Errorf("update %s alias: %w", tsconfigPath, err)
	}

	if err := tsconfig.WriteAtomic(tsconfigPath, cfg); err != nil {
		return fmt.Errorf("write %s: %w", tsconfigPath, err)
	}

	return nil
}
