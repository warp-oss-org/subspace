package cmd

import (
	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/ui"
)

func newSession(cmd *cobra.Command) ui.Session {
	return ui.NewSession(cmd.InOrStdin(), cmd.OutOrStdout(), cmd.ErrOrStderr())
}
