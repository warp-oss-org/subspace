package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registryartifact"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: subspace-registry <build|validate> [flags]")
	}

	switch args[0] {
	case "build":
		return runBuild(args[1:])
	case "validate":
		return runValidate(args[1:])
	default:
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func runBuild(args []string) error {
	flags := flag.NewFlagSet("build", flag.ContinueOnError)
	source := flags.String("source", "../../packages", "source packages directory or repo root")
	out := flags.String("out", "registry", "generated registry output directory")
	sourceGitSHA := flags.String("source-git-sha", "", "source git SHA to record (default: git rev-parse HEAD)")
	if err := flags.Parse(args); err != nil {
		return err
	}

	sha := strings.TrimSpace(*sourceGitSHA)
	if sha == "" {
		resolved, err := registryartifact.ResolveSourceGitSHA(*source)
		if err != nil {
			return err
		}
		sha = resolved
	}

	result, err := registryartifact.Build(registryartifact.BuildOptions{
		SourceDir:    *source,
		OutDir:       *out,
		SourceGitSHA: sha,
	})
	if err != nil {
		return err
	}

	fmt.Printf(
		"Built registry %s with %d primitives and %d hashed files\n",
		*out,
		len(result.Index.Primitives),
		registryartifact.CountFiles(result.Index.Primitives),
	)
	return nil
}

func runValidate(args []string) error {
	flags := flag.NewFlagSet("validate", flag.ContinueOnError)
	dir := flags.String("dir", "registry", "generated registry directory")
	if err := flags.Parse(args); err != nil {
		return err
	}

	result, err := registryartifact.ValidateDir(*dir)
	if err != nil {
		return err
	}

	fmt.Printf(
		"Validated registry %s with %d primitives, %d hashed files, and %d dry-run plans\n",
		*dir,
		len(result.Index.Primitives),
		result.FileCount,
		result.PlanCount,
	)
	return nil
}
