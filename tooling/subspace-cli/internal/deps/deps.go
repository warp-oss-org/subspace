package deps

import (
	"fmt"
	"sort"
	"strings"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

// ManifestLoader loads a primitive manifest by name.
type ManifestLoader interface {
	LoadManifest(primitive string) (registry.Manifest, error)
}

// PrimitiveInstalledFunc reports whether a primitive already exists in the consumer repo.
// It should return true for installed, false for missing.
type PrimitiveInstalledFunc func(primitive string) (bool, error)

// ResolveScaffoldOrder returns primitives to scaffold in deterministic order.
// Required primitives that are missing are scaffolded first; root is always last.
func ResolveScaffoldOrder(
	root string,
	loader ManifestLoader,
	isInstalled PrimitiveInstalledFunc,
) ([]string, error) {
	if strings.TrimSpace(root) == "" {
		return nil, fmt.Errorf("primitive name is required")
	}

	state := map[string]int{} // 0=unseen, 1=visiting, 2=done
	stack := []string{}
	order := []string{}
	added := map[string]struct{}{}

	var visit func(string) error
	visit = func(primitive string) error {
		switch state[primitive] {
		case 1:
			cycleStart := 0
			for i, p := range stack {
				if p == primitive {
					cycleStart = i
					break
				}
			}
			cycle := append(append([]string{}, stack[cycleStart:]...), primitive)
			return fmt.Errorf("dependency cycle detected: %s", strings.Join(cycle, " -> "))
		case 2:
			return nil
		}

		state[primitive] = 1
		stack = append(stack, primitive)
		defer func() {
			stack = stack[:len(stack)-1]
			state[primitive] = 2
		}()

		m, err := loader.LoadManifest(primitive)
		if err != nil {
			return fmt.Errorf("load manifest for %q: %w", primitive, err)
		}

		requires := append([]string(nil), m.Requires...)
		sort.Strings(requires)

		for _, req := range requires {
			installed, err := isInstalled(req)
			if err != nil {
				return fmt.Errorf("check required primitive %q: %w", req, err)
			}
			if installed {
				continue
			}
			if err := visit(req); err != nil {
				return err
			}
			if _, ok := added[req]; !ok {
				order = append(order, req)
				added[req] = struct{}{}
			}
		}

		return nil
	}

	if err := visit(root); err != nil {
		return nil, err
	}

	order = append(order, root)
	return order, nil
}
