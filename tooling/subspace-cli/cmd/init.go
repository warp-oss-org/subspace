package cmd

import (
	"errors"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/config"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/tsconfig"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/ui"
)

func NewInitCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "init",
		Short: "Initialize a subspace.config.yaml in the current directory",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runInit(newSession(cmd))
		},
	}
}

func runInit(session ui.Session) error {
	path := config.DefaultConfigFilename

	if err := config.WriteDefault(path); err != nil {
		return err
	}

	cfg := config.Default()
	tsconfigChanged, err := ensureTSConfigAlias("tsconfig.json", cfg.TargetDir)
	if err != nil {
		return err
	}

	session.Println(session.Banner("Subspace", session.Status("Project initialized", ui.ToneSuccess)))
	session.Println("")
	session.Println(session.InfoBox([][2]string{
		{"Config", path},
		{"Target dir", cfg.TargetDir},
		{"Language", cfg.Language},
		{"Package manager", cfg.PackageManager},
	}))
	session.Println("")

	if tsconfigChanged {
		session.Println(session.Step("Updated tsconfig.json to map @subspace-kit/* into " + cfg.TargetDir))
	} else {
		session.Println(session.Step("Verified tsconfig.json already maps @subspace-kit/* into " + cfg.TargetDir))
	}

	session.Println("")
	session.Println(session.Section("Next"))
	session.Println("  " + session.Command("subspace list"))
	session.Println("  " + session.Command("subspace add <primitive>"))

	return nil
}

func ensureTSConfigAlias(tsconfigPath, targetDir string) (bool, error) {
	cfg, err := tsconfig.Load(tsconfigPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, fmt.Errorf("TypeScript config not found at %q. Create tsconfig.json at repo root, then rerun `subspace init`", tsconfigPath)
		}
		return false, err
	}

	alreadyConfigured := tsconfigAliasConfigured(cfg, targetDir)
	if err := tsconfig.EnsureSubspaceAlias(&cfg, targetDir); err != nil {
		return false, fmt.Errorf("update %s alias: %w", tsconfigPath, err)
	}

	if err := tsconfig.WriteAtomic(tsconfigPath, cfg); err != nil {
		return false, fmt.Errorf("write %s: %w", tsconfigPath, err)
	}

	return !alreadyConfigured, nil
}

func tsconfigAliasConfigured(cfg tsconfig.TSConfig, targetDir string) bool {
	compilerOptions, ok := cfg.Data["compilerOptions"].(map[string]any)
	if !ok {
		return false
	}
	paths, ok := compilerOptions["paths"].(map[string]any)
	if !ok {
		return false
	}
	values, ok := paths["@subspace-kit/*"].([]any)
	if !ok || len(values) != 1 {
		return false
	}
	alias, ok := values[0].(string)
	if !ok {
		return false
	}
	return alias == "./"+targetDir+"/*"
}
