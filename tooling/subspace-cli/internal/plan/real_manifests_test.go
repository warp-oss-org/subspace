package plan

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

func TestRealPackageManifests_BuildDefaultPlans(t *testing.T) {
	t.Parallel()

	reg := openRealPackagesRegistry(t)
	primitives, err := reg.ListPrimitives()
	if err != nil {
		t.Fatalf("ListPrimitives: %v", err)
	}

	for _, primitive := range primitives {
		t.Run(primitive, func(t *testing.T) {
			t.Parallel()

			m, err := reg.LoadManifest(primitive)
			if err != nil {
				t.Fatalf("LoadManifest(%q): %v", primitive, err)
			}

			p, err := Build(primitive, m, Tokens{TargetDir: "src/infra/subspace"}, Options{}, reg)
			if err != nil {
				t.Fatalf("Build(%q): %v", primitive, err)
			}
			if len(p.Files) == 0 {
				t.Fatalf("expected files in plan for %q", primitive)
			}
			assertUniqueDestPaths(t, p)
		})
	}
}

func TestRealPackageManifests_BuildEveryAdapter(t *testing.T) {
	t.Parallel()

	reg := openRealPackagesRegistry(t)
	primitives, err := reg.ListPrimitives()
	if err != nil {
		t.Fatalf("ListPrimitives: %v", err)
	}

	for _, primitive := range primitives {
		m, err := reg.LoadManifest(primitive)
		if err != nil {
			t.Fatalf("LoadManifest(%q): %v", primitive, err)
		}

		for adapter := range m.Adapters {
			t.Run(primitive+"/"+adapter, func(t *testing.T) {
				t.Parallel()

				p, err := Build(primitive, m, Tokens{TargetDir: "src/infra/subspace"}, Options{Adapter: adapter}, reg)
				if err != nil {
					t.Fatalf("Build(%q, adapter %q): %v", primitive, adapter, err)
				}
				if p.Adapter != adapter {
					t.Fatalf("expected adapter %q, got %q", adapter, p.Adapter)
				}
				assertUniqueDestPaths(t, p)
			})
		}
	}
}

func TestRealPackageManifests_KvMemoryDoesNotCopyRedis(t *testing.T) {
	t.Parallel()

	reg := openRealPackagesRegistry(t)
	m, err := reg.LoadManifest("kv")
	if err != nil {
		t.Fatalf("LoadManifest(kv): %v", err)
	}

	p, err := Build("kv", m, Tokens{TargetDir: "src/infra/subspace"}, Options{Adapter: "memory"}, reg)
	if err != nil {
		t.Fatalf("Build(kv, memory): %v", err)
	}

	for _, f := range p.Files {
		if strings.Contains(f.DestPath, "/kv/adapters/redis/") {
			t.Fatalf("memory adapter plan copied redis file: %s", f.DestPath)
		}
	}
}

func assertUniqueDestPaths(t *testing.T, p Plan) {
	t.Helper()

	seen := map[string]string{}
	for _, f := range p.Files {
		if previous, ok := seen[f.DestPath]; ok {
			t.Fatalf(
				"duplicate destination %q from %q and %q",
				f.DestPath,
				previous,
				f.SrcPath,
			)
		}
		seen[f.DestPath] = f.SrcPath
	}
}

func openRealPackagesRegistry(t *testing.T) registry.Registry {
	t.Helper()

	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}

	packagesDir := filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "..", "..", "packages"))
	reg, err := registry.Open(os.DirFS(packagesDir))
	if err != nil {
		t.Fatalf("Open(%q): %v", packagesDir, err)
	}
	return reg
}
