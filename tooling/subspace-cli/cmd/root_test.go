package cmd

import (
	"bytes"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/ui"
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

func TestRunVersionIncludesVersionAndCommit(t *testing.T) {
	t.Parallel()

	var out bytes.Buffer
	session := ui.NewSession(strings.NewReader(""), &out, &bytes.Buffer{})

	if err := runVersion(session); err != nil {
		t.Fatalf("runVersion: %v", err)
	}

	rendered := out.String()
	for _, want := range []string{"Subspace CLI", "Version", "Commit"} {
		if !strings.Contains(rendered, want) {
			t.Fatalf("expected %q in version output: %s", want, rendered)
		}
	}
}
