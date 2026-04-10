package plan

import (
	"errors"
	"fmt"
	"io/fs"
	"sort"
)

type Collision struct {
	Path   string
	Reason CollisionReason
}

type CollisionReason string

const (
	CollisionReasonExists CollisionReason = "exists"
)

type StatFunc func(path string) (fs.FileInfo, error)

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
