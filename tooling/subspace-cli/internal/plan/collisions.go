package plan

import (
	"errors"
	"fmt"
	"io/fs"
	"sort"
)

// Collisions are computed in a separate preflight step, but we model them here
// for consistent reporting if you want to attach them to a Plan later.
type Collision struct {
	Path   string
	Reason CollisionReason
}

type CollisionReason string

const (
	CollisionReasonExists CollisionReason = "exists"
)

// StatFunc abstracts filesystem stat for testing.
// In production, pass os.Stat.
type StatFunc func(path string) (fs.FileInfo, error)

// PreflightCollisions checks all planned file destination paths for existence.
// Returns a sorted list of conflicts. Does NOT mutate the filesystem.
func PreflightCollisions(p Plan, stat StatFunc) ([]Collision, error) {
	seen := map[string]struct{}{}
	var conflicts []Collision

	for _, f := range p.Files {
		if f.DestPath == "" {
			return nil, fmt.Errorf("empty destination path in plan")
		}
		if _, ok := seen[f.DestPath]; ok {
			continue
		}
		seen[f.DestPath] = struct{}{}

		_, err := stat(f.DestPath)
		if err == nil {
			conflicts = append(conflicts, Collision{Path: f.DestPath})
			continue
		}
		if errors.Is(err, fs.ErrNotExist) {
			continue
		}
		return nil, fmt.Errorf("stat %q: %w", f.DestPath, err)
	}

	sort.Slice(conflicts, func(i, j int) bool {
		return conflicts[i].Path < conflicts[j].Path
	})
	return conflicts, nil
}
