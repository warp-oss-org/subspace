package registry

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/fsx"
)

var adapterNameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9\-_]*$`)

type Manifest struct {
	Name           string                     `yaml:"name"`
	Description    string                     `yaml:"description"`
	Language       string                     `yaml:"language"`
	DefaultAdapter string                     `yaml:"defaultAdapter"`
	Exclude        []string                   `yaml:"exclude"`
	Copy           []CopyOp                   `yaml:"copy"`
	Tests          *TestsSection              `yaml:"tests"`
	Requires       []string                   `yaml:"requires"`
	Deps           []string                   `yaml:"deps"`
	Adapters       map[string]AdapterManifest `yaml:"adapters"`
}

type AdapterManifest struct {
	Description string   `yaml:"description"`
	Copy        []CopyOp `yaml:"copy"`
	Deps        []string `yaml:"deps"`
}

type TestsSection struct {
	Copy []CopyOp `yaml:"copy"`
}

type CopyOp struct {
	From string `yaml:"from"`
	To   string `yaml:"to"`
}

// ResolvedCopyOp is a CopyOp after template resolution.
// Both From and To are validated relative paths.
type ResolvedCopyOp struct {
	From string
	To   string
}

// ParseManifestYAML unmarshals, normalizes, and structurally validates a manifest.
// To fields in CopyOps are NOT path-validated here because they contain template tokens.
// Call ValidateResolvedPaths after template resolution.
func ParseManifestYAML(b []byte) (Manifest, error) {
	var m Manifest
	if err := yaml.Unmarshal(b, &m); err != nil {
		return Manifest{}, fmt.Errorf("parse manifest: %w", err)
	}

	m.Normalize()

	if err := m.ValidateStructural(); err != nil {
		return Manifest{}, fmt.Errorf("invalid manifest: %w", err)
	}

	return m, nil
}

// Normalize trims whitespace, lowercases relevant fields, and deduplicates deps.
// Must be called before ValidateStructural.
func (m *Manifest) Normalize() {
	m.Name = strings.TrimSpace(m.Name)
	m.Description = strings.TrimSpace(m.Description)
	m.Language = strings.ToLower(strings.TrimSpace(m.Language))
	m.DefaultAdapter = strings.TrimSpace(m.DefaultAdapter)
	m.Exclude = normalizeExcludePatterns(m.Exclude)
	m.Requires = normalizeDeps(m.Requires)
	m.Deps = normalizeDeps(m.Deps)

	for k, a := range m.Adapters {
		a.Description = strings.TrimSpace(a.Description)
		a.Deps = normalizeDeps(a.Deps)
		m.Adapters[k] = a
	}
}

// ValidateStructural checks everything that can be verified at parse time:
// required fields, language/adapter constraints, From paths, and adapter names.
// Does NOT validate To paths (they contain template tokens like {{targetDir}}).
func (m Manifest) ValidateStructural() error {
	if m.Name == "" {
		return errors.New("name is required")
	}
	if m.Description == "" {
		return errors.New("description is required")
	}
	if m.Language == "" {
		return errors.New("language is required")
	}
	if m.DefaultAdapter == "" {
		return errors.New("defaultAdapter is required")
	}

	if m.Language != "typescript" {
		return fmt.Errorf("unsupported language: %q (v1 supports: typescript)", m.Language)
	}

	if len(m.Copy) == 0 {
		return errors.New("copy must have at least one entry")
	}
	for i, p := range m.Exclude {
		if strings.TrimSpace(p) == "" {
			return fmt.Errorf("exclude[%d] must not be empty", i)
		}
	}
	for i, req := range m.Requires {
		if !primitiveNameRe.MatchString(req) {
			return fmt.Errorf("requires[%d]: invalid primitive name %q", i, req)
		}
	}
	for i, op := range m.Copy {
		if err := validateFromPath(op.From); err != nil {
			return fmt.Errorf("copy[%d].from: %w", i, err)
		}
		if op.To == "" {
			return fmt.Errorf("copy[%d].to is required", i)
		}
	}

	if m.Tests != nil {
		for i, op := range m.Tests.Copy {
			if err := validateFromPath(op.From); err != nil {
				return fmt.Errorf("tests.copy[%d].from: %w", i, err)
			}
			if op.To == "" {
				return fmt.Errorf("tests.copy[%d].to is required", i)
			}
		}
	}

	if len(m.Adapters) == 0 {
		return errors.New("adapters must have at least one entry")
	}
	if _, ok := m.Adapters[m.DefaultAdapter]; !ok {
		return fmt.Errorf("defaultAdapter %q not found in adapters", m.DefaultAdapter)
	}

	for name, a := range m.Adapters {
		if !adapterNameRe.MatchString(name) {
			return fmt.Errorf("adapter name %q is invalid (allowed: lowercase alphanumeric, -, _)", name)
		}
		if len(a.Copy) == 0 {
			return fmt.Errorf("adapters.%s.copy must have at least one entry", name)
		}
		for i, op := range a.Copy {
			if err := validateFromPath(op.From); err != nil {
				return fmt.Errorf("adapters.%s.copy[%d].from: %w", name, i, err)
			}
			if op.To == "" {
				return fmt.Errorf("adapters.%s.copy[%d].to is required", name, i)
			}
		}
	}

	return nil
}

// ValidateResolvedPaths validates To paths after template resolution.
// Returns ResolvedCopyOps with all paths validated as safe relative paths.
func ValidateResolvedPaths(ops []CopyOp) ([]ResolvedCopyOp, error) {
	resolved := make([]ResolvedCopyOp, len(ops))

	for i, op := range ops {
		from, err := fsx.ValidateRelativePath(op.From)
		if err != nil {
			return nil, fmt.Errorf("op[%d].from: %w", i, err)
		}
		to, err := fsx.ValidateRelativePath(op.To)
		if err != nil {
			return nil, fmt.Errorf("op[%d].to: %w", i, err)
		}
		resolved[i] = ResolvedCopyOp{From: from, To: to}
	}

	return resolved, nil
}

// validateFromPath validates a From path (always a literal registry-relative path).
func validateFromPath(from string) error {
	if _, err := fsx.ValidateRelativePath(from); err != nil {
		return err
	}
	return nil
}

func normalizeDeps(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))

	for _, d := range in {
		d = strings.TrimSpace(d)
		if d == "" {
			continue
		}
		if _, ok := seen[d]; ok {
			continue
		}
		seen[d] = struct{}{}
		out = append(out, d)
	}

	sort.Strings(out)
	return out
}

func normalizeExcludePatterns(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, p := range in {
		p = strings.TrimSpace(p)
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
	}
	sort.Strings(out)
	return out
}
