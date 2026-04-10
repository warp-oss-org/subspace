package registryartifact

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/deps"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/plan"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

type ValidateResult struct {
	Index      registry.Index
	PlanCount  int
	FileCount  int
	SourceDesc string
}

func ValidateDir(dir string) (ValidateResult, error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return ValidateResult{}, fmt.Errorf("resolve registry dir: %w", err)
	}

	idx, err := registry.ValidateIndex(os.DirFS(abs))
	if err != nil {
		return ValidateResult{}, err
	}

	reg, err := registry.OpenFS("local:"+abs, os.DirFS(abs))
	if err != nil {
		return ValidateResult{}, err
	}

	primitives, err := reg.ListPrimitives()
	if err != nil {
		return ValidateResult{}, err
	}
	if len(primitives) != len(idx.Primitives) {
		return ValidateResult{}, fmt.Errorf("listed primitive count mismatch: got %d want %d", len(primitives), len(idx.Primitives))
	}

	planCount := 0
	for _, primitive := range primitives {
		order, err := deps.ResolveScaffoldOrder(primitive, reg, func(string) (bool, error) {
			return false, nil
		})
		if err != nil {
			return ValidateResult{}, fmt.Errorf("resolve dry-run order for %q: %w", primitive, err)
		}

		for _, ordered := range order {
			m, err := reg.LoadManifest(ordered)
			if err != nil {
				return ValidateResult{}, err
			}
			p, err := plan.Build(
				ordered,
				m,
				plan.Tokens{TargetDir: "src/infra/subspace"},
				plan.Options{},
				reg,
			)
			if err != nil {
				return ValidateResult{}, fmt.Errorf("build dry-run plan for %q: %w", ordered, err)
			}
			if len(p.Files) == 0 {
				return ValidateResult{}, fmt.Errorf("dry-run plan for %q has no files", ordered)
			}
			planCount++
		}
	}

	fileCount := 0
	for _, item := range idx.Primitives {
		fileCount += len(item.Files)
	}

	return ValidateResult{
		Index:      idx,
		PlanCount:  planCount,
		FileCount:  fileCount,
		SourceDesc: reg.Source(),
	}, nil
}
