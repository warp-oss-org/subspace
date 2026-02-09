package cmd

import (
	"fmt"
	"io/fs"
	"os"

	"github.com/spf13/cobra"
)

// NewRootCmd builds the top-level command tree.
func NewRootCmd(embeddedFS fs.FS) *cobra.Command {
	root := &cobra.Command{
		Use:   "subspace",
		Short: "Scaffold Subspace primitives into your repo",
		Long:  "A CLI for adding production-ready infrastructure primitives (shadcn-style, you own the code).",
		// No RunE — prints help by default.
	}

	root.AddCommand(NewInitCmd())
	root.AddCommand(NewListCmd(embeddedFS))
	root.AddCommand(NewInfoCmd(embeddedFS))
	root.AddCommand(NewAddCmd(embeddedFS))

	return root
}

// Execute is the main entrypoint called from main.go.
func Execute(embeddedFS fs.FS) {
	root := NewRootCmd(embeddedFS)
	if err := root.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
