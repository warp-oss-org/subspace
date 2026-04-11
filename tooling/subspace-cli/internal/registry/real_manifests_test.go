package registry

import (
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"testing"
)

var expectedRealPrimitives = []string{
	"backoff",
	"cache",
	"clock",
	"config",
	"email",
	"errors",
	"id",
	"kv",
	"lock",
	"logger",
	"retry",
	"secrets",
	"server",
	"singleflight",
	"storage",
}

func TestRealPackageManifests_LoadAndList(t *testing.T) {
	t.Parallel()

	reg := openRealPackagesRegistry(t)

	primitives, err := reg.ListPrimitives()
	if err != nil {
		t.Fatalf("ListPrimitives: %v", err)
	}
	if !reflect.DeepEqual(primitives, expectedRealPrimitives) {
		t.Fatalf("unexpected primitives:\ngot:  %v\nwant: %v", primitives, expectedRealPrimitives)
	}

	for _, primitive := range expectedRealPrimitives {
		t.Run(primitive, func(t *testing.T) {
			t.Parallel()

			m, err := reg.LoadManifest(primitive)
			if err != nil {
				t.Fatalf("LoadManifest(%q): %v", primitive, err)
			}
			if m.Name != primitive {
				t.Fatalf("manifest name mismatch: got %q want %q", m.Name, primitive)
			}
		})
	}
}

func openRealPackagesRegistry(t *testing.T) Registry {
	t.Helper()

	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}

	packagesDir := filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "..", "..", "packages"))
	reg, err := OpenFS("local:"+packagesDir, os.DirFS(packagesDir))
	if err != nil {
		t.Fatalf("OpenFS(%q): %v", packagesDir, err)
	}
	return reg
}
