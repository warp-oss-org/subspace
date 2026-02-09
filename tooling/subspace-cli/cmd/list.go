package cmd

import (
	"fmt"
	"io/fs"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

// NewListCmd creates the list command.
// Does not require subspace.config.yaml — works anywhere.
func NewListCmd(embeddedFS fs.FS) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List available primitives",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runList(embeddedFS)
		},
	}
}

func runList(embeddedFS fs.FS) error {
	reg, err := registry.Open(embeddedFS)
	if err != nil {
		return err
	}

	prims, err := reg.ListPrimitives()
	if err != nil {
		return err
	}

	if len(prims) == 0 {
		fmt.Println("No primitives found.")
		return nil
	}

	fmt.Printf("Available primitives (%s):\n\n", reg.Source())
	for _, p := range prims {
		// Try to load manifest for description; skip on error.
		m, err := reg.LoadManifest(p)
		if err != nil {
			fmt.Printf("  %s\n", p)
			continue
		}
		fmt.Printf("  %-16s %s\n", p, m.Description)
	}
	fmt.Printf("\nRun 'subspace info <primitive>' for details.\n")

	return nil
}
