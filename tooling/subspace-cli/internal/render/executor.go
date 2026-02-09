package render

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/plan"
)

// FileReader reads files from the registry. Satisfied by registry.Registry.
type FileReader interface {
	ReadPrimitiveFile(primitive, relPath string) ([]byte, error)
}

// ExecuteOptions controls how the plan is written to disk.
type ExecuteOptions struct {
	Overwrite    bool
	TemplateData TemplateData
}

// Execute creates directories and writes files described by the plan.
// Caller should run PreflightCollisions first if Overwrite is false.
func Execute(reg FileReader, p plan.Plan, opts ExecuteOptions) error {
	// 1) Create directories.
	for _, d := range p.Dirs {
		if err := os.MkdirAll(d.Path, 0o755); err != nil {
			return fmt.Errorf("mkdir %q: %w", d.Path, err)
		}
	}

	// 2) Write files.
	for _, f := range p.Files {
		if err := writeFile(reg, p.Primitive, f, opts); err != nil {
			return err
		}
	}

	return nil
}

func writeFile(reg FileReader, primitive string, f plan.FileOp, opts ExecuteOptions) error {
	if !opts.Overwrite {
		if _, err := os.Stat(f.DestPath); err == nil {
			return fmt.Errorf("refusing to overwrite existing file: %s", f.DestPath)
		}
	}

	src, err := reg.ReadPrimitiveFile(primitive, f.SrcPath)
	if err != nil {
		return fmt.Errorf("read %q from registry: %w", f.SrcPath, err)
	}

	out := src
	if f.Template {
		rendered, err := RenderTemplate(src, opts.TemplateData)
		if err != nil {
			return fmt.Errorf("render template %q: %w", f.SrcPath, err)
		}
		out = rendered
	}

	return writeFileAtomic(f.DestPath, out)
}

func writeFileAtomic(dest string, b []byte) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return fmt.Errorf("mkdir for %q: %w", dest, err)
	}

	tmp := dest + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("write %q: %w", tmp, err)
	}

	if err := os.Rename(tmp, dest); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("rename to %q: %w", dest, err)
	}

	return nil
}
