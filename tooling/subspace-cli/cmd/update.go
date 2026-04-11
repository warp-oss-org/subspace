package cmd

import (
	"context"
	"fmt"
	"net/http"
	"runtime"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/buildinfo"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/selfupdate"
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
			return runUpdate(cmd.Context(), opts)
		},
	}

	cmd.Flags().StringVar(&opts.target, "to", "", "explicit release tag to install, for example subspace-cli-v2026.04.11.2")

	return cmd
}

func runUpdate(ctx context.Context, opts updateOptions) error {
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
		fmt.Printf("Current version: %s\n", currentVersion)
		fmt.Printf("Target version:  %s\n", release.TagName)
		fmt.Println("Already up to date.")
		return nil
	}

	metadata, err := client.ReleaseMetadata(ctx, release)
	if err != nil {
		return err
	}
	if metadata.ReleaseVersion != release.TagName {
		return fmt.Errorf("release metadata version mismatch: got %s want %s", metadata.ReleaseVersion, release.TagName)
	}

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

	replacedPath, err := selfupdate.ReplaceExecutable(targetPath, binary)
	if err != nil {
		return err
	}

	fmt.Printf("Current version: %s\n", currentVersion)
	fmt.Printf("Current commit:  %s\n", currentCommit)
	fmt.Printf("Target version:  %s\n", release.TagName)
	fmt.Printf("Target commit:   %s\n", metadata.SourceGitSHA)
	fmt.Printf("Updated binary:  %s\n", replacedPath)
	return nil
}
