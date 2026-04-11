package cmd

import (
	"fmt"
	"io/fs"
	"strings"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/ui"
)

func NewListCmd(embeddedFS fs.FS) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List available primitives",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runList(newSession(cmd), embeddedFS)
		},
	}
}

func runList(session ui.Session, embeddedFS fs.FS) error {
	reg, err := registry.Open(embeddedFS)
	if err != nil {
		return err
	}

	prims, err := reg.ListPrimitives()
	if err != nil {
		return err
	}

	if len(prims) == 0 {
		session.Println(session.Status("No primitives found.", ui.ToneWarning))
		return nil
	}

	rows := make([][]string, 0, len(prims))
	for _, p := range prims {
		m, err := reg.LoadManifest(p)
		if err != nil {
			rows = append(rows, []string{p, "Manifest unavailable", "—"})
			continue
		}
		defaultAdapter := "—"
		if len(m.Adapters) > 0 {
			defaultAdapter = m.DefaultAdapter
		}
		rows = append(rows, []string{p, m.Description, defaultAdapter})
	}

	session.Println(session.Banner("Subspace", fmt.Sprintf("%d primitives available", len(prims))))
	session.Println("")
	session.Println(session.Table(
		[]string{"Primitive", "Description", "Default"},
		rows,
	))
	session.Println("")
	session.Println(session.Muted("Source: " + displayRegistrySource(reg.Source())))
	session.Println(session.Muted("Next:   " + session.Command("subspace info <primitive>")))

	return nil
}

func displayRegistrySource(source string) string {
	switch source {
	case "embedded:registry":
		return "embedded registry"
	case "local:packages":
		return "local package manifests"
	default:
		return strings.ReplaceAll(source, ":", " ")
	}
}
