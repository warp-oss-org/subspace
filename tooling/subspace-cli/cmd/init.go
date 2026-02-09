package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/config"
)

// NewInitCmd creates the init command.
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

	fmt.Printf("✓ Created %s\n\n", path)

	cfg := config.Default()
	fmt.Printf("Defaults:\n")
	fmt.Printf("  targetDir:      %s\n", cfg.TargetDir)
	fmt.Printf("  testsDir:       %s\n", cfg.TestsDir)
	fmt.Printf("  language:       %s\n", cfg.Language)
	fmt.Printf("  packageManager: %s\n", cfg.PackageManager)
	fmt.Printf("\nEdit %s to customize, then run:\n", path)
	fmt.Printf("  subspace add <primitive>\n")

	return nil
}
