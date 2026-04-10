package cmd

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/config"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/deps"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/plan"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/render"
)

type addOptions struct {
	adapter      string
	overwrite    bool
	dryRun       bool
	excludeTests bool
}

func NewAddCmd(embeddedFS fs.FS) *cobra.Command {
	opts := addOptions{}
	cmd := &cobra.Command{
		Use:   "add <primitive>",
		Short: "Scaffold a primitive into your repo",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runAdd(args[0], embeddedFS, opts)
		},
	}

	cmd.Flags().StringVar(&opts.adapter, "adapter", "", "adapter to scaffold (default: manifest default)")
	cmd.Flags().BoolVar(&opts.overwrite, "overwrite", false, "overwrite existing files")
	cmd.Flags().BoolVar(&opts.dryRun, "dry-run", false, "print plan without writing files")
	cmd.Flags().BoolVar(&opts.excludeTests, "exclude-tests", false, "exclude common test file and directory names")

	return cmd
}

func runAdd(primitive string, embeddedFS fs.FS, opts addOptions) error {
	cfg, err := config.Load(config.DefaultConfigFilename)
	if err != nil {
		return err
	}

	reg, err := registry.Open(embeddedFS)
	if err != nil {
		return err
	}

	primitives, err := deps.ResolveScaffoldOrder(primitive, reg, func(name string) (bool, error) {
		return primitiveInstalled(cfg.TargetDir, name)
	})
	if err != nil {
		return err
	}

	plans, err := buildScaffoldPlans(reg, primitives, cfg.TargetDir, primitive, opts)
	if err != nil {
		return err
	}

	depPkgs := collectDeps(plans)

	if opts.dryRun {
		printPlans(plans, depPkgs, cfg)
		return nil
	}

	if !opts.overwrite {
		conflicts, err := collectConflicts(plans)
		if err != nil {
			return err
		}
		if len(conflicts) > 0 {
			fmt.Fprintf(os.Stderr, "\nThe following files already exist:\n")
			for _, c := range conflicts {
				fmt.Fprintf(os.Stderr, "  • %s\n", c.Path)
			}
			return fmt.Errorf("refusing: %d files already exist (re-run with --overwrite)", len(conflicts))
		}
	}

	for _, p := range plans {
		if err := render.Execute(reg, p, render.ExecuteOptions{
			Overwrite: opts.overwrite,
			TemplateData: render.TemplateData{
				"targetDir": cfg.TargetDir,
			},
		}); err != nil {
			return err
		}
	}

	printSummary(plans, depPkgs, cfg)
	return nil
}

func buildScaffoldPlans(
	reg registry.Registry,
	primitives []string,
	targetDir string,
	rootPrimitive string,
	addOpts addOptions,
) ([]plan.Plan, error) {
	tokens := plan.Tokens{TargetDir: targetDir}
	out := make([]plan.Plan, 0, len(primitives))

	for _, primitive := range primitives {
		m, err := reg.LoadManifest(primitive)
		if err != nil {
			return nil, err
		}

		planOpts := plan.Options{}
		planOpts.ExtraExcludes = extraExcludesForAdd(addOpts.excludeTests)
		if primitive == rootPrimitive {
			planOpts.Adapter = addOpts.adapter
		}

		p, err := plan.Build(primitive, m, tokens, planOpts, reg)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}

	return out, nil
}

func extraExcludesForAdd(excludeTests bool) []string {
	if !excludeTests {
		return nil
	}
	return []string{
		"*.test.ts",
		"*.spec.ts",
		"*.test.tsx",
		"*.spec.tsx",
		"__tests__",
		"__test__",
	}
}

func printPlans(plans []plan.Plan, depPkgs []string, cfg config.Config) {
	for i, p := range plans {
		if i > 0 {
			fmt.Println()
		}
		printPlan(p)
	}

	if len(depPkgs) > 0 {
		fmt.Printf("Dependencies:\n  %s add %s\n", cfg.PackageManager, strings.Join(depPkgs, " "))
	}
}

func printPlan(p plan.Plan) {
	if p.Adapter == "" {
		fmt.Printf("Primitive: %s\n\n", p.Primitive)
	} else {
		fmt.Printf("Primitive: %s (adapter: %s)\n\n", p.Primitive, p.Adapter)
	}

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
}

func printSummary(plans []plan.Plan, depPkgs []string, cfg config.Config) {
	for _, p := range plans {
		for _, d := range p.Dirs {
			fmt.Printf("✓ Created %s/\n", d.Path)
		}
	}
	fmt.Println()

	if len(depPkgs) > 0 {
		fmt.Println("Install dependencies:")
		fmt.Printf("  %s add %s\n\n", cfg.PackageManager, strings.Join(depPkgs, " "))
	}

	fmt.Printf("Run behavior tests:\n  %s", cfg.PackageManager)
}

func primitiveInstalled(targetDir, primitive string) (bool, error) {
	path := filepath.Join(targetDir, primitive)
	info, err := os.Stat(path)
	if err == nil {
		if !info.IsDir() {
			return false, fmt.Errorf("required primitive path exists but is not a directory: %s", path)
		}
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, fmt.Errorf("stat %q: %w", path, err)
}

func collectConflicts(plans []plan.Plan) ([]plan.Collision, error) {
	conflicts := make([]plan.Collision, 0)
	for _, p := range plans {
		c, err := plan.PreflightCollisions(p, os.Stat)
		if err != nil {
			return nil, err
		}
		conflicts = append(conflicts, c...)
	}
	return conflicts, nil
}

func collectDeps(plans []plan.Plan) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0)
	for _, p := range plans {
		for _, d := range p.Deps {
			if _, ok := seen[d]; ok {
				continue
			}
			seen[d] = struct{}{}
			out = append(out, d)
		}
	}
	sort.Strings(out)
	return out
}
