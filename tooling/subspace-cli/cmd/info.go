package cmd

import (
	"io/fs"
	"sort"
	"strings"

	"github.com/spf13/cobra"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/ui"
)

func NewInfoCmd(embeddedFS fs.FS) *cobra.Command {
	return &cobra.Command{
		Use:   "info <primitive>",
		Short: "Show details about a primitive",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runInfo(newSession(cmd), args[0], embeddedFS)
		},
	}
}

func runInfo(session ui.Session, primitive string, embeddedFS fs.FS) error {
	reg, err := registry.Open(embeddedFS)
	if err != nil {
		return err
	}

	m, err := reg.LoadManifest(primitive)
	if err != nil {
		return err
	}

	defaultAdapter := "—"
	if len(m.Adapters) > 0 {
		defaultAdapter = m.DefaultAdapter
	}
	depsValue := "None"
	if len(m.Deps) > 0 {
		depsValue = strings.Join(m.Deps, ", ")
	}

	session.Println(session.Banner(m.Name, m.Description))
	session.Println("")
	session.Println(session.InfoBox([][2]string{
		{"Language", m.Language},
		{"Default adapter", defaultAdapter},
		{"Base dependencies", depsValue},
	}))

	adapters := sortedAdapterNames(m)
	if len(adapters) > 0 {
		session.Println("")
		session.Println(session.Section("Adapters"))
		rows := make([][]string, 0, len(adapters))
		for _, name := range adapters {
			a := m.Adapters[name]
			badge := ""
			if name == m.DefaultAdapter {
				badge = session.Badge("default", ui.ToneAccent)
			}
			deps := "—"
			if len(a.Deps) > 0 {
				deps = strings.Join(a.Deps, ", ")
			}
			rows = append(rows, []string{name, a.Description, deps, badge})
		}
		session.Println(session.Table([]string{"Adapter", "Description", "Dependencies", ""}, rows))
	}

	session.Println("")
	session.Println(session.Section("Next"))
	session.Println("  " + session.Command("subspace add "+m.Name))
	if len(adapters) > 1 {
		session.Println("  " + session.Command("subspace add "+m.Name+" --adapter <name>"))
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
