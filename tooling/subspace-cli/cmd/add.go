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
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/ui"
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
			return runAdd(newSession(cmd), args[0], embeddedFS, opts)
		},
	}

	cmd.Flags().StringVar(&opts.adapter, "adapter", "", "adapter to scaffold (default: manifest default)")
	cmd.Flags().BoolVar(&opts.overwrite, "overwrite", false, "overwrite existing files")
	cmd.Flags().BoolVar(&opts.dryRun, "dry-run", false, "print plan without writing files")
	cmd.Flags().BoolVar(&opts.excludeTests, "exclude-tests", false, "exclude common test file and directory names")

	return cmd
}

func runAdd(session ui.Session, primitive string, embeddedFS fs.FS, opts addOptions) error {
	cfg, err := config.Load(config.DefaultConfigFilename)
	if err != nil {
		return err
	}

	reg, err := registry.Open(embeddedFS)
	if err != nil {
		return err
	}

	if err := resolveAdapterPreference(session, reg, primitive, &opts); err != nil {
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
		printPlans(session, plans, depPkgs, cfg)
		return nil
	}

	if !opts.overwrite {
		conflicts, err := collectConflicts(plans)
		if err != nil {
			return err
		}
		if len(conflicts) > 0 {
			session.Errorln("")
			session.Errorln(session.Status("Review required", ui.ToneWarning))
			session.Errorln(session.Muted("The following files already exist and would be overwritten:"))
			for _, c := range conflicts {
				session.Errorln("  " + session.Status(c.Path, ui.ToneError))
			}
			return fmt.Errorf("refusing to overwrite %d existing files; re-run with --overwrite after reviewing the plan", len(conflicts))
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

	printSummary(session, plans, depPkgs, cfg)
	return nil
}

func resolveAdapterPreference(session ui.Session, reg registry.Registry, primitive string, opts *addOptions) error {
	if opts == nil || opts.adapter != "" {
		return nil
	}

	m, err := reg.LoadManifest(primitive)
	if err != nil {
		return err
	}
	adapterNames := sortedAdapterNames(m)
	if len(adapterNames) <= 1 {
		return nil
	}

	if !session.Interactive() {
		return fmt.Errorf(
			"primitive %q has multiple adapters; choose one with --adapter (available: %s, default: %s)",
			primitive,
			strings.Join(adapterNames, ", "),
			m.DefaultAdapter,
		)
	}

	selected, err := session.PromptSelect(
		"Choose an adapter for "+primitive,
		adapterNames,
		m.DefaultAdapter,
	)
	if err != nil {
		return fmt.Errorf("select adapter: %w", err)
	}
	opts.adapter = selected
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

func printPlans(session ui.Session, plans []plan.Plan, depPkgs []string, cfg config.Config) {
	session.Println(session.Banner("Subspace", "Scaffold plan — review before writing"))
	for _, p := range plans {
		session.Println("")
		printPlan(session, p)
	}

	if len(depPkgs) > 0 {
		session.Println("")
		session.Println(session.Section("Dependencies"))
		session.Println("  " + session.Command(cfg.PackageManager+" add "+strings.Join(depPkgs, " ")))
	}
}

func printPlan(session ui.Session, p plan.Plan) {
	subtitle := p.Primitive
	if p.Adapter != "" {
		subtitle = p.Primitive + " · adapter " + p.Adapter
	}
	session.Println(session.Section(subtitle))

	if len(p.Dirs) > 0 {
		session.Println(session.Muted("  Directories"))
		for _, d := range p.Dirs {
			session.Println("    " + d.Path + "/")
		}
	}

	if len(p.Files) > 0 {
		if len(p.Dirs) > 0 {
			session.Println("")
		}
		session.Println(session.Muted("  Files"))
		for _, f := range p.Files {
			tpl := "copy"
			if f.Template {
				tpl = "template"
			}
			session.Println("    " + f.DestPath + "  " + session.Badge(tpl, ui.ToneMuted))
		}
	}
}

func printSummary(session ui.Session, plans []plan.Plan, depPkgs []string, cfg config.Config) {
	createdDirs := 0
	createdFiles := 0
	for _, p := range plans {
		createdDirs += len(p.Dirs)
		createdFiles += len(p.Files)
	}

	session.Println(session.Banner("Subspace", session.Status("Scaffold complete", ui.ToneSuccess)))
	session.Println("")
	session.Println(session.InfoBox([][2]string{
		{"Primitives", fmt.Sprintf("%d", len(plans))},
		{"Directories", fmt.Sprintf("%d created", createdDirs)},
		{"Files", fmt.Sprintf("%d written", createdFiles)},
	}))

	if len(depPkgs) > 0 {
		session.Println("")
		session.Println(session.Section("Install dependencies"))
		session.Println("  " + session.Command(cfg.PackageManager+" add "+strings.Join(depPkgs, " ")))
	}

	session.Println("")
	session.Println(session.Section("Next"))
	session.Println("  " + session.Muted("Review the generated diff before committing."))
	session.Println("  " + session.Muted("Run your normal project checks."))
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

func stripCommandStyle(value string) string {
	return strings.ReplaceAll(strings.TrimSpace(value), "\n", " ")
}
