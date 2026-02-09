package cmd

import (
	"fmt"
	"io/fs"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/config"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/plan"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/render"
)

var (
	addAdapter   string
	addOverwrite bool
	addDryRun    bool
)

// NewAddCmd creates the add command. embeddedFS is the pre-stripped registry FS.
func NewAddCmd(embeddedFS fs.FS) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "add <primitive>",
		Short: "Scaffold a primitive into your repo",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runAdd(args[0], embeddedFS)
		},
	}

	cmd.Flags().StringVar(&addAdapter, "adapter", "", "adapter to scaffold (default: manifest default)")
	cmd.Flags().BoolVar(&addOverwrite, "overwrite", false, "overwrite existing files")
	cmd.Flags().BoolVar(&addDryRun, "dry-run", false, "print plan without writing files")

	return cmd
}

func runAdd(primitive string, embeddedFS fs.FS) error {
	cfg, err := config.Load(config.DefaultConfigFilename)
	if err != nil {
		return err
	}

	reg, err := registry.Open(embeddedFS)
	if err != nil {
		return err
	}

	m, err := reg.LoadManifest(primitive)
	if err != nil {
		return err
	}

	tokens := plan.Tokens{
		TargetDir: cfg.TargetDir,
		TestsDir:  cfg.TestsDir,
	}

	p, err := plan.Build(primitive, m, tokens, plan.Options{Adapter: addAdapter}, reg)
	if err != nil {
		return err
	}

	// Dry run: print plan and exit.
	if addDryRun {
		printPlan(p, cfg)
		return nil
	}

	// Collision check.
	conflicts, err := plan.PreflightCollisions(p, os.Stat)
	if err != nil {
		return err
	}
	if len(conflicts) > 0 && !addOverwrite {
		fmt.Fprintf(os.Stderr, "\nThe following files already exist:\n")
		for _, c := range conflicts {
			fmt.Fprintf(os.Stderr, "  • %s\n", c.Path)
		}
		return fmt.Errorf("refusing: %d files already exist (re-run with --overwrite)", len(conflicts))
	}

	// Execute.
	err = render.Execute(reg, p, render.ExecuteOptions{
		Overwrite: addOverwrite,
		TemplateData: render.TemplateData{
			"targetDir": cfg.TargetDir,
			"testsDir":  cfg.TestsDir,
		},
	})
	if err != nil {
		return err
	}

	// Summary.
	printSummary(p, cfg)
	return nil
}

func printPlan(p plan.Plan, cfg config.Config) {
	fmt.Printf("Primitive: %s (adapter: %s)\n\n", p.Primitive, p.Adapter)

	if len(p.Dirs) > 0 {
		fmt.Println("Directories:")
		for _, d := range p.Dirs {
			fmt.Printf("  %s/\n", d.Path)
		}
		fmt.Println()
	}

	if len(p.Files) > 0 {
		fmt.Println("Files:")
		for _, f := range p.Files {
			tpl := ""
			if f.Template {
				tpl = " (template)"
			}
			fmt.Printf("  %s%s\n", f.DestPath, tpl)
		}
		fmt.Println()
	}

	if len(p.Deps) > 0 {
		fmt.Printf("Dependencies:\n  %s add %s\n\n", cfg.PackageManager, strings.Join(p.Deps, " "))
	}
}

func printSummary(p plan.Plan, cfg config.Config) {
	for _, d := range p.Dirs {
		fmt.Printf("✓ Created %s/\n", d.Path)
	}
	fmt.Println()

	if len(p.Deps) > 0 {
		fmt.Println("Install dependencies:")
		fmt.Printf("  %s add %s\n\n", cfg.PackageManager, strings.Join(p.Deps, " "))
	}

	fmt.Printf("Run behavior tests:\n  %s test %s\n", cfg.PackageManager, cfg.TestsDir)
}
