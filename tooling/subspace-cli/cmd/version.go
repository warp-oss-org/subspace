package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/buildinfo"
)

func NewVersionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Show CLI version information",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("Version: %s\n", buildinfo.Version())
			fmt.Printf("Commit:  %s\n", buildinfo.Commit())
			return nil
		},
	}
}
