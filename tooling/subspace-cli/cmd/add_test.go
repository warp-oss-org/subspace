package cmd

import (
	"bytes"
	"reflect"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/ui"
)

func TestExtraExcludesForAdd(t *testing.T) {
	t.Parallel()

	got := extraExcludesForAdd(true)
	want := []string{
		"*.test.ts",
		"*.spec.ts",
		"*.test.tsx",
		"*.spec.tsx",
		"__tests__",
		"__test__",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected excludes: got %v want %v", got, want)
	}

	if got := extraExcludesForAdd(false); got != nil {
		t.Fatalf("expected nil excludes when flag disabled, got %v", got)
	}
}

func TestResolveAdapterPreferenceRequiresExplicitChoiceWhenNonInteractive(t *testing.T) {
	t.Parallel()

	reg, err := registry.OpenFS("test", fstest.MapFS{
		"kv/manifest.yaml": {
			Data: []byte(`
name: kv
description: Key-value primitive
language: typescript
defaultAdapter: memory
copy:
  - from: src
    to: "{{targetDir}}/kv"
adapters:
  memory:
    description: Memory adapter
    copy:
      - from: adapters/memory
        to: "{{targetDir}}/kv/adapters/memory"
  redis:
    description: Redis adapter
    copy:
      - from: adapters/redis
        to: "{{targetDir}}/kv/adapters/redis"
`),
		},
	})
	if err != nil {
		t.Fatalf("open registry: %v", err)
	}

	session := ui.NewSession(strings.NewReader(""), &bytes.Buffer{}, &bytes.Buffer{})
	opts := addOptions{}

	err = resolveAdapterPreference(session, reg, "kv", &opts)
	if err == nil {
		t.Fatal("expected adapter selection error")
	}
	if !strings.Contains(err.Error(), "--adapter") {
		t.Fatalf("expected adapter guidance, got %v", err)
	}
}

func TestResolveAdapterPreferenceKeepsExplicitAdapter(t *testing.T) {
	t.Parallel()

	reg, err := registry.OpenFS("test", fstest.MapFS{
		"kv/manifest.yaml": {
			Data: []byte(`
name: kv
description: Key-value primitive
language: typescript
defaultAdapter: memory
copy:
  - from: src
    to: "{{targetDir}}/kv"
adapters:
  memory:
    description: Memory adapter
    copy:
      - from: adapters/memory
        to: "{{targetDir}}/kv/adapters/memory"
  redis:
    description: Redis adapter
    copy:
      - from: adapters/redis
        to: "{{targetDir}}/kv/adapters/redis"
`),
		},
	})
	if err != nil {
		t.Fatalf("open registry: %v", err)
	}

	session := ui.NewSession(strings.NewReader(""), &bytes.Buffer{}, &bytes.Buffer{})
	opts := addOptions{adapter: "redis"}

	if err := resolveAdapterPreference(session, reg, "kv", &opts); err != nil {
		t.Fatalf("resolve adapter: %v", err)
	}
	if opts.adapter != "redis" {
		t.Fatalf("expected explicit adapter to be preserved, got %q", opts.adapter)
	}
}
