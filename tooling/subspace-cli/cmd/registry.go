package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registryartifact"
)

type registryBuildOptions struct {
	sourceDir    string
	outDir       string
	sourceGitSHA string
}

type registryValidateOptions struct {
	dir string
}

func NewRegistryCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "registry",
		Short: "Build and validate Subspace source registries",
	}
	cmd.AddCommand(NewRegistryBuildCmd())
	cmd.AddCommand(NewRegistryValidateCmd())
	return cmd
}

func NewRegistryBuildCmd() *cobra.Command {
	opts := registryBuildOptions{}
	cmd := &cobra.Command{
		Use:   "build",
		Short: "Build a deterministic source registry artifact",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runRegistryBuild(opts)
		},
	}
	cmd.Flags().StringVar(&opts.sourceDir, "source", "packages", "source packages directory or repo root")
	cmd.Flags().StringVar(&opts.outDir, "out", "tooling/subspace-cli/registry", "generated registry output directory")
	cmd.Flags().StringVar(&opts.sourceGitSHA, "source-git-sha", "", "source git SHA to record (default: git rev-parse HEAD)")
	return cmd
}

func NewRegistryValidateCmd() *cobra.Command {
	opts := registryValidateOptions{}
	cmd := &cobra.Command{
		Use:   "validate",
		Short: "Validate a generated source registry artifact",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runRegistryValidate(opts)
		},
	}
	cmd.Flags().StringVar(&opts.dir, "dir", "tooling/subspace-cli/registry", "generated registry directory")
	return cmd
}

func runRegistryBuild(opts registryBuildOptions) error {
	sha := opts.sourceGitSHA
	if strings.TrimSpace(sha) == "" {
		resolved, err := registryartifact.ResolveSourceGitSHA(opts.sourceDir)
		if err != nil {
			return err
		}
		sha = resolved
	}

	result, err := registryartifact.Build(registryartifact.BuildOptions{
		SourceDir:    opts.sourceDir,
		OutDir:       opts.outDir,
		SourceGitSHA: sha,
	})
	if err != nil {
		return err
	}

	fmt.Printf(
		"Built registry %s with %d primitives and %d hashed files\n",
		opts.outDir,
		len(result.Index.Primitives),
		registryartifact.CountFiles(result.Index.Primitives),
	)
	return nil
}

func runRegistryValidate(opts registryValidateOptions) error {
	result, err := registryartifact.ValidateDir(opts.dir)
	if err != nil {
		return err
	}

	fmt.Printf(
		"Validated registry %s with %d primitives, %d hashed files, and %d dry-run plans\n",
		opts.dir,
		len(result.Index.Primitives),
		result.FileCount,
		result.PlanCount,
	)
	return nil
}
