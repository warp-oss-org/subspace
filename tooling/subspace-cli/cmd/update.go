package cmd

import (
	"context"
	"fmt"
	"net/http"
	"runtime"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/buildinfo"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/selfupdate"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/ui"
)

type updateOptions struct {
	target string
}

func NewUpdateCmd() *cobra.Command {
	opts := updateOptions{}
	cmd := &cobra.Command{
		Use:   "update",
		Short: "Update the installed Subspace CLI binary",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runUpdate(cmd.Context(), newSession(cmd), opts)
		},
	}

	cmd.Flags().StringVar(&opts.target, "to", "", "explicit release tag to install, for example subspace-cli-v2026.04.11.2")

	return cmd
}

func runUpdate(ctx context.Context, session ui.Session, opts updateOptions) error {
	client := selfupdate.NewClient(http.DefaultClient)

	currentVersion := buildinfo.Version()
	currentCommit := buildinfo.Commit()

	var (
		release selfupdate.Release
		err     error
	)
	if opts.target != "" {
		release, err = client.ReleaseByTag(ctx, opts.target)
	} else {
		release, err = client.LatestRelease(ctx)
	}
	if err != nil {
		return err
	}

	if currentVersion == release.TagName {
		session.Println(session.Banner("Subspace", session.Status("Already up to date", ui.ToneSuccess)))
		session.Println("")
		session.Println(session.InfoBox([][2]string{
			{"Current version", currentVersion},
			{"Target version", release.TagName},
		}))
		return nil
	}

	session.Println(session.Banner("Subspace", "Updating CLI binary"))
	session.Println("")
	session.Println(session.InfoBox([][2]string{
		{"Current version", currentVersion},
		{"Current commit", currentCommit},
		{"Target version", release.TagName},
	}))

	metadata, err := client.ReleaseMetadata(ctx, release)
	if err != nil {
		return err
	}
	if metadata.ReleaseVersion != release.TagName {
		return fmt.Errorf("release metadata version mismatch: got %s want %s", metadata.ReleaseVersion, release.TagName)
	}
	session.Println("")
	session.Println(session.Step("Resolved release metadata"))

	assetName, err := selfupdate.AssetName(runtime.GOOS, runtime.GOARCH)
	if err != nil {
		return err
	}

	checksums, err := client.Checksums(ctx, release)
	if err != nil {
		return err
	}

	asset, err := selfupdate.FindAsset(release, assetName)
	if err != nil {
		return err
	}
	session.Println(session.Step("Selected asset " + asset.Name))

	targetPath, err := selfupdate.ResolveExecutableTarget(runtime.GOOS)
	if err != nil {
		return err
	}

	binary, err := client.DownloadAsset(ctx, asset)
	if err != nil {
		return err
	}
	if err := selfupdate.VerifyChecksum(asset.Name, binary, checksums); err != nil {
		return err
	}
	session.Println(session.Step("Verified checksum for " + asset.Name))

	replacedPath, err := selfupdate.ReplaceExecutable(targetPath, binary)
	if err != nil {
		return err
	}
	session.Println(session.Step("Installed " + release.TagName))
	session.Println("")
	session.Println(session.InfoBox([][2]string{
		{"Target commit", metadata.SourceGitSHA},
		{"Binary path", replacedPath},
	}))
	return nil
}
