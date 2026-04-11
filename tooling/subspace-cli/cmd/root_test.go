package cmd

import (
	"testing"
	"testing/fstest"
)

func TestNewRootCmd_IncludesVersionAndUpdate(t *testing.T) {
	t.Parallel()

	cmd := NewRootCmd(fstest.MapFS{})
	found := map[string]bool{}
	for _, child := range cmd.Commands() {
		found[child.Use] = true
	}

	for _, want := range []string{"add <primitive>", "info <primitive>", "init", "list", "registry", "update", "version"} {
		if !found[want] {
			t.Fatalf("expected root subcommand %q", want)
		}
	}
}
