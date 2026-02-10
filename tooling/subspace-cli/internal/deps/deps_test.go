package deps

import (
	"strings"
	"testing"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

type stubLoader struct {
	manifests map[string]registry.Manifest
}

func (s stubLoader) LoadManifest(primitive string) (registry.Manifest, error) {
	m, ok := s.manifests[primitive]
	if !ok {
		return registry.Manifest{}, nil
	}
	return m, nil
}

func TestResolveScaffoldOrder_MissingRequirementsFirst(t *testing.T) {
	t.Parallel()

	loader := stubLoader{manifests: map[string]registry.Manifest{
		"cache": {Requires: []string{"clock"}},
		"clock": {},
	}}

	installed := map[string]bool{
		"clock": false,
	}

	order, err := ResolveScaffoldOrder("cache", loader, func(primitive string) (bool, error) {
		return installed[primitive], nil
	})
	if err != nil {
		t.Fatalf("ResolveScaffoldOrder: %v", err)
	}

	if len(order) != 2 || order[0] != "clock" || order[1] != "cache" {
		t.Fatalf("expected [clock cache], got %v", order)
	}
}

func TestResolveScaffoldOrder_SkipsInstalledRequirements(t *testing.T) {
	t.Parallel()

	loader := stubLoader{manifests: map[string]registry.Manifest{
		"cache": {Requires: []string{"clock"}},
	}}

	order, err := ResolveScaffoldOrder("cache", loader, func(primitive string) (bool, error) {
		return primitive == "clock", nil
	})
	if err != nil {
		t.Fatalf("ResolveScaffoldOrder: %v", err)
	}

	if len(order) != 1 || order[0] != "cache" {
		t.Fatalf("expected [cache], got %v", order)
	}
}

func TestResolveScaffoldOrder_Cycle(t *testing.T) {
	t.Parallel()

	loader := stubLoader{manifests: map[string]registry.Manifest{
		"a": {Requires: []string{"b"}},
		"b": {Requires: []string{"a"}},
	}}

	_, err := ResolveScaffoldOrder("a", loader, func(primitive string) (bool, error) {
		return false, nil
	})
	if err == nil {
		t.Fatal("expected cycle error, got nil")
	}
	if !strings.Contains(err.Error(), "dependency cycle detected") {
		t.Fatalf("expected cycle error, got %v", err)
	}
}
