package plan

import (
	"fmt"
	"path"
	"sort"
	"strings"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/fsx"
	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

type FileEnumerator interface {
	ListPrimitiveFiles(primitive, dir string, excludes []string) ([]string, error)
}

type Options struct {
	Adapter       string
	ExtraExcludes []string
}

func Build(
	primitive string,
	m registry.Manifest,
	tokens Tokens,
	opts Options,
	files FileEnumerator,
) (Plan, error) {
	p := Plan{
		Primitive: primitive,
	}
	excludes := mergeExcludes(m.Exclude, opts.ExtraExcludes)

	if err := expandCopies(&p, primitive, m.Copy, excludes, tokens, files); err != nil {
		return Plan{}, fmt.Errorf("expand base copy: %w", err)
	}

	adapter, adapterManifest, err := resolveAdapter(primitive, m, opts.Adapter)
	if err != nil {
		return Plan{}, err
	}
	if adapter != "" {
		p.Adapter = adapter
		if err := expandCopies(&p, primitive, adapterManifest.Copy, excludes, tokens, files); err != nil {
			return Plan{}, fmt.Errorf("expand adapter %q copy: %w", adapter, err)
		}
	}
	p.Deps = mergeDeps(m.Deps, adapterManifest.Deps)

	if m.Tests != nil {
		if err := expandCopies(&p, primitive, m.Tests.Copy, excludes, tokens, files); err != nil {
			return Plan{}, fmt.Errorf("expand tests copy: %w", err)
		}
	}

	return p, nil
}

func resolveAdapter(
	primitive string,
	m registry.Manifest,
	requested string,
) (string, registry.AdapterManifest, error) {
	if len(m.Adapters) == 0 {
		if requested != "" {
			return "", registry.AdapterManifest{}, fmt.Errorf("primitive %q does not support adapters", primitive)
		}
		return "", registry.AdapterManifest{}, nil
	}

	adapter := requested
	if adapter == "" {
		adapter = m.DefaultAdapter
	}

	adapterManifest, ok := m.Adapters[adapter]
	if !ok {
		return "", registry.AdapterManifest{}, fmt.Errorf(
			"unknown adapter %q (available: %s)",
			adapter,
			strings.Join(sortedAdapterNames(m.Adapters), ", "),
		)
	}

	return adapter, adapterManifest, nil
}

func expandCopies(
	p *Plan,
	primitive string,
	ops []registry.CopyOp,
	excludes []string,
	tokens Tokens,
	files FileEnumerator,
) error {
	for _, op := range ops {
		dst, err := resolveTokens(op.To, tokens)
		if err != nil {
			return fmt.Errorf("resolve %q: %w", op.To, err)
		}

		if _, err := fsx.ValidateRelativePath(dst); err != nil {
			return fmt.Errorf("invalid resolved destination %q: %w", dst, err)
		}

		srcFiles, err := files.ListPrimitiveFiles(primitive, op.From, excludes)
		if err != nil {
			return fmt.Errorf("list files %q in %q: %w", op.From, primitive, err)
		}

		for _, f := range srcFiles {
			src := path.Join(op.From, f)
			out := f
			if f == "." {
				src = op.From
				out = path.Base(op.From)
			}

			isTpl := strings.HasSuffix(out, ".tpl")
			if isTpl {
				out = strings.TrimSuffix(out, ".tpl")
			}

			dest := path.Join(dst, out)

			if err := addFile(p, FileOp{
				SrcPath:  src,
				DestPath: dest,
				Template: isTpl,
			}); err != nil {
				return err
			}

			addDir(p, path.Dir(dest))
		}
	}
	return nil
}

func addFile(p *Plan, file FileOp) error {
	for _, existing := range p.Files {
		if existing.DestPath != file.DestPath {
			continue
		}
		if existing.SrcPath == file.SrcPath && existing.Template == file.Template {
			return nil
		}
		return fmt.Errorf(
			"destination %q already planned from %q",
			file.DestPath,
			existing.SrcPath,
		)
	}

	p.Files = append(p.Files, file)
	return nil
}

func resolveTokens(tpl string, t Tokens) (string, error) {
	s := tpl
	s = strings.ReplaceAll(s, "{{targetDir}}", t.TargetDir)

	if strings.Contains(s, "{{") {
		return "", fmt.Errorf("unresolved token in %q", s)
	}

	return s, nil
}

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

func sortedAdapterNames(adapters map[string]registry.AdapterManifest) []string {
	names := make([]string, 0, len(adapters))
	for name := range adapters {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func mergeExcludes(a, b []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(a)+len(b))

	for _, e := range a {
		if _, ok := seen[e]; ok {
			continue
		}
		seen[e] = struct{}{}
		out = append(out, e)
	}
	for _, e := range b {
		if _, ok := seen[e]; ok {
			continue
		}
		seen[e] = struct{}{}
		out = append(out, e)
	}

	sort.Strings(out)
	return out
}
