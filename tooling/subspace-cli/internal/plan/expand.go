package plan

import (
	"fmt"
	"path"
	"sort"
	"strings"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/fsx"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

// FileEnumerator lists files within a primitive's registry directory.
// Satisfied by registry.Registry — kept minimal so the planner doesn't
// depend on manifest loading or other registry concerns.
type FileEnumerator interface {
	ListPrimitiveFiles(primitive, dir string) ([]string, error)
}

// Options controls how a plan is built.
type Options struct {
	Adapter string // if empty, uses manifest's defaultAdapter
}

// Build turns a manifest + tokens + options into a deterministic Plan.
// No IO, no filesystem writes — pure data transformation.
func Build(
	primitive string,
	m registry.Manifest,
	tokens Tokens,
	opts Options,
	files FileEnumerator,
) (Plan, error) {
	adapter := opts.Adapter
	if adapter == "" {
		adapter = m.DefaultAdapter
	}

	am, ok := m.Adapters[adapter]
	if !ok {
		available := make([]string, 0, len(m.Adapters))
		for k := range m.Adapters {
			available = append(available, k)
		}
		sort.Strings(available)
		return Plan{}, fmt.Errorf("unknown adapter %q (available: %s)", adapter, strings.Join(available, ", "))
	}

	p := Plan{
		Primitive: primitive,
		Adapter:   adapter,
	}

	// Base copy
	if err := expandCopies(&p, primitive, m.Copy, tokens, files); err != nil {
		return Plan{}, fmt.Errorf("expand base copy: %w", err)
	}

	// Adapter copy
	if err := expandCopies(&p, primitive, am.Copy, tokens, files); err != nil {
		return Plan{}, fmt.Errorf("expand adapter %q copy: %w", adapter, err)
	}

	// Tests
	if m.Tests != nil {
		if err := expandCopies(&p, primitive, m.Tests.Copy, tokens, files); err != nil {
			return Plan{}, fmt.Errorf("expand tests copy: %w", err)
		}
	}

	// Deps: primitive-level + adapter-level, deduped and sorted.
	p.Deps = mergeDeps(m.Deps, am.Deps)

	return p, nil
}

// expandCopies resolves template tokens, enumerates source files, and appends
// FileOps and DirOps to the plan. Uses path (slash-separated) throughout
// because registry paths and dest paths are platform-independent.
func expandCopies(
	p *Plan,
	primitive string,
	ops []registry.CopyOp,
	tokens Tokens,
	files FileEnumerator,
) error {
	for _, op := range ops {
		dst, err := resolveTokens(op.To, tokens)
		if err != nil {
			return fmt.Errorf("resolve %q: %w", op.To, err)
		}

		// Validate after resolution — this is where traversal/absolute path checks happen.
		if _, err := fsx.ValidateRelativePath(dst); err != nil {
			return fmt.Errorf("invalid resolved destination %q: %w", dst, err)
		}

		srcFiles, err := files.ListPrimitiveFiles(primitive, op.From)
		if err != nil {
			return fmt.Errorf("list files %q in %q: %w", op.From, primitive, err)
		}

		for _, f := range srcFiles {
			src := path.Join(op.From, f)

			isTpl := strings.HasSuffix(f, ".tpl")
			out := f
			if isTpl {
				out = strings.TrimSuffix(f, ".tpl")
			}

			dest := path.Join(dst, out)

			p.Files = append(p.Files, FileOp{
				SrcPath:  src,
				DestPath: dest,
				Template: isTpl,
			})

			addDir(p, path.Dir(dest))
		}
	}
	return nil
}

// resolveTokens replaces known template tokens in a string.
// Returns an error if unresolved tokens remain.
func resolveTokens(tpl string, t Tokens) (string, error) {
	s := tpl
	s = strings.ReplaceAll(s, "{{targetDir}}", t.TargetDir)
	s = strings.ReplaceAll(s, "{{testsDir}}", t.TestsDir)

	if strings.Contains(s, "{{") {
		return "", fmt.Errorf("unresolved token in %q", s)
	}

	return s, nil
}

// addDir appends a DirOp if it hasn't been seen yet.
func addDir(p *Plan, dir string) {
	if dir == "." || dir == "" {
		return
	}
	for _, d := range p.Dirs {
		if d.Path == dir {
			return
		}
	}
	p.Dirs = append(p.Dirs, DirOp{Path: dir})
}

// mergeDeps combines two dep slices, deduplicates, and sorts.
func mergeDeps(a, b []string) []string {
	seen := map[string]struct{}{}
	var out []string

	for _, d := range a {
		if _, ok := seen[d]; !ok {
			seen[d] = struct{}{}
			out = append(out, d)
		}
	}
	for _, d := range b {
		if _, ok := seen[d]; !ok {
			seen[d] = struct{}{}
			out = append(out, d)
		}
	}

	sort.Strings(out)
	return out
}
