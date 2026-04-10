package cmd

import (
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

// NewInfoCmd creates the info command.
// Does not require subspace.config.yaml — works anywhere.
func NewInfoCmd(embeddedFS fs.FS) *cobra.Command {
	return &cobra.Command{
		Use:   "info <primitive>",
		Short: "Show details about a primitive",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runInfo(args[0], embeddedFS)
		},
	}
}

func runInfo(primitive string, embeddedFS fs.FS) error {
	reg, err := registry.Open(embeddedFS)
	if err != nil {
		return err
	}

	m, err := reg.LoadManifest(primitive)
	if err != nil {
		return err
	}

	// Header
	fmt.Printf("%s\n", m.Name)
	fmt.Printf("%s\n\n", m.Description)

	// Adapters
	adapters := sortedAdapterNames(m)
	if len(adapters) > 0 {
		fmt.Printf("Adapters:\n")
		for _, name := range adapters {
			a := m.Adapters[name]
			def := ""
			if name == m.DefaultAdapter {
				def = " (default)"
			}
			fmt.Printf("  %-16s %s%s\n", name, a.Description, def)
		}
		fmt.Println()
	}

	// Deps
	if len(m.Deps) > 0 {
		fmt.Printf("Dependencies: %s\n", strings.Join(m.Deps, ", "))
	}

	// Adapter-specific deps
	for _, name := range adapters {
		a := m.Adapters[name]
		if len(a.Deps) > 0 {
			fmt.Printf("Dependencies (%s): %s\n", name, strings.Join(a.Deps, ", "))
		}
	}
	if len(m.Deps) > 0 || hasAdapterDeps(m) {
		fmt.Println()
	}

	// Language
	fmt.Printf("Language: %s\n\n", m.Language)

	// Usage hint
	fmt.Printf("Add to your project:\n")
	fmt.Printf("  subspace add %s\n", m.Name)
	if len(adapters) > 1 {
		fmt.Printf("  subspace add %s --adapter <name>\n", m.Name)
	}

	// README
	readme, err := reg.ReadPrimitiveFile(primitive, "README.md")
	if err == nil && len(readme) > 0 {
		fmt.Printf("\n---\n\n%s\n", string(readme))
	}

	return nil
}

func sortedAdapterNames(m registry.Manifest) []string {
	names := make([]string, 0, len(m.Adapters))
	for name := range m.Adapters {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func hasAdapterDeps(m registry.Manifest) bool {
	for _, a := range m.Adapters {
		if len(a.Deps) > 0 {
			return true
		}
	}
	return false
}
