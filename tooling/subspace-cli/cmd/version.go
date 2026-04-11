package cmd

import (
	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/buildinfo"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/ui"
)

func NewVersionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Show CLI version information",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runVersion(newSession(cmd))
		},
	}
}

func runVersion(session ui.Session) error {
	version := buildinfo.Version()
	buildType := "Local development build"
	if version != "dev" {
		buildType = "Release build"
	}

	session.Println(session.Banner("Subspace CLI", buildType))
	session.Println("")
	session.Println(session.InfoBox([][2]string{
		{"Version", version},
		{"Commit", buildinfo.Commit()},
	}))
	session.Println("")
	if version != "dev" {
		session.Println(session.Muted("Run " + session.Command("subspace update") + " to install a newer published release."))
	} else {
		session.Println(session.Muted("This binary was built from local source."))
	}
	return nil
}
