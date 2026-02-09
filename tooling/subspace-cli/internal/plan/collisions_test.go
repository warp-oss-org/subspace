package plan

import (
	"fmt"
	"io/fs"
	"testing"
	"time"
)

// fakeStat returns a StatFunc that reports the given paths as existing.
// All other paths return fs.ErrNotExist.
func fakeStat(existing map[string]bool) StatFunc {
	return func(path string) (fs.FileInfo, error) {
		if existing[path] {
			return fakeFileInfo{name: path}, nil
		}
		return nil, &fs.PathError{Op: "stat", Path: path, Err: fs.ErrNotExist}
	}
}

// failStat returns a StatFunc that returns an unexpected error for the given paths.
func failStat(failPaths map[string]bool) StatFunc {
	return func(path string) (fs.FileInfo, error) {
		if failPaths[path] {
			return nil, fmt.Errorf("permission denied: %s", path)
		}
		return nil, &fs.PathError{Op: "stat", Path: path, Err: fs.ErrNotExist}
	}
}

type fakeFileInfo struct{ name string }

func (f fakeFileInfo) Name() string       { return f.name }
func (f fakeFileInfo) Size() int64        { return 0 }
func (f fakeFileInfo) Mode() fs.FileMode  { return 0o644 }
func (f fakeFileInfo) ModTime() time.Time { return time.Time{} }
func (f fakeFileInfo) IsDir() bool        { return false }
func (f fakeFileInfo) Sys() any           { return nil }

func TestPreflightCollisions_NoConflicts(t *testing.T) {
	t.Parallel()

	p := Plan{
		Files: []FileOp{
			{DestPath: "src/kv/port.ts"},
			{DestPath: "src/kv/adapter.ts"},
		},
	}

	conflicts, err := PreflightCollisions(p, fakeStat(nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(conflicts) != 0 {
		t.Fatalf("expected no conflicts, got %v", conflicts)
	}
}

func TestPreflightCollisions_DetectsExisting(t *testing.T) {
	t.Parallel()

	p := Plan{
		Files: []FileOp{
			{DestPath: "src/kv/port.ts"},
			{DestPath: "src/kv/adapter.ts"},
			{DestPath: "src/kv/types.ts"},
		},
	}

	existing := map[string]bool{
		"src/kv/port.ts":  true,
		"src/kv/types.ts": true,
	}

	conflicts, err := PreflightCollisions(p, fakeStat(existing))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(conflicts) != 2 {
		t.Fatalf("expected 2 conflicts, got %d: %v", len(conflicts), conflicts)
	}
	// Sorted
	if conflicts[0].Path != "src/kv/port.ts" || conflicts[1].Path != "src/kv/types.ts" {
		t.Fatalf("expected sorted conflicts, got %v", conflicts)
	}
}

func TestPreflightCollisions_DeduplicatesPaths(t *testing.T) {
	t.Parallel()

	p := Plan{
		Files: []FileOp{
			{DestPath: "src/kv/port.ts"},
			{DestPath: "src/kv/port.ts"}, // duplicate
		},
	}

	existing := map[string]bool{"src/kv/port.ts": true}

	conflicts, err := PreflightCollisions(p, fakeStat(existing))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(conflicts) != 1 {
		t.Fatalf("expected 1 conflict (deduped), got %d", len(conflicts))
	}
}

func TestPreflightCollisions_RejectsEmptyDestPath(t *testing.T) {
	t.Parallel()

	p := Plan{
		Files: []FileOp{
			{DestPath: ""},
		},
	}

	_, err := PreflightCollisions(p, fakeStat(nil))
	if err == nil {
		t.Fatal("expected error for empty dest path, got nil")
	}
}

func TestPreflightCollisions_PropagatesStatError(t *testing.T) {
	t.Parallel()

	p := Plan{
		Files: []FileOp{
			{DestPath: "src/kv/port.ts"},
		},
	}

	_, err := PreflightCollisions(p, failStat(map[string]bool{"src/kv/port.ts": true}))
	if err == nil {
		t.Fatal("expected error for stat failure, got nil")
	}
}

func TestPreflightCollisions_EmptyPlan(t *testing.T) {
	t.Parallel()

	conflicts, err := PreflightCollisions(Plan{}, fakeStat(nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(conflicts) != 0 {
		t.Fatalf("expected no conflicts for empty plan, got %v", conflicts)
	}
}
