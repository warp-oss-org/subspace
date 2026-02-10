package registry

import "testing"

// --- Happy path ---

func TestParseManifestYAML_ValidMinimal(t *testing.T) {
	t.Parallel()

	m, err := ParseManifestYAML([]byte(`
name: kv
description: Key-value storage
language: typescript
defaultAdapter: memory
copy:
  - from: base
    to: "{{targetDir}}/kv"
adapters:
  memory:
    description: In-memory
    copy:
      - from: adapters/memory
        to: "{{targetDir}}/kv/adapters/memory"
`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if m.Name != "kv" {
		t.Fatalf("expected name 'kv', got %q", m.Name)
	}
	if m.DefaultAdapter != "memory" {
		t.Fatalf("expected defaultAdapter 'memory', got %q", m.DefaultAdapter)
	}
	if _, ok := m.Adapters["memory"]; !ok {
		t.Fatal("expected 'memory' adapter to exist")
	}
}

func TestParseManifestYAML_MultipleAdapters(t *testing.T) {
	t.Parallel()

	m, err := ParseManifestYAML([]byte(`
name: kv
description: Key-value storage
language: typescript
defaultAdapter: memory
copy:
  - from: base
    to: "{{targetDir}}/kv"
deps:
  - zod
adapters:
  memory:
    description: In-memory
    copy:
      - from: adapters/memory
        to: "{{targetDir}}/kv/adapters/memory"
  redis:
    description: Redis-backed
    copy:
      - from: adapters/redis
        to: "{{targetDir}}/kv/adapters/redis"
    deps:
      - ioredis
`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(m.Adapters) != 2 {
		t.Fatalf("expected 2 adapters, got %d", len(m.Adapters))
	}
	if len(m.Deps) != 1 || m.Deps[0] != "zod" {
		t.Fatalf("expected primitive deps [zod], got %v", m.Deps)
	}
	redis := m.Adapters["redis"]
	if len(redis.Deps) != 1 || redis.Deps[0] != "ioredis" {
		t.Fatalf("expected redis deps [ioredis], got %v", redis.Deps)
	}
}

func TestParseManifestYAML_ParsesRequires(t *testing.T) {
	t.Parallel()

	m, err := ParseManifestYAML([]byte(`
name: cache
description: Cache primitive
language: typescript
defaultAdapter: memory
requires:
  - clock
copy:
  - from: base
    to: "{{targetDir}}/cache"
adapters:
  memory:
    description: In-memory
    copy:
      - from: adapters/memory
        to: "{{targetDir}}/cache/adapters/memory"
`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(m.Requires) != 1 || m.Requires[0] != "clock" {
		t.Fatalf("expected requires [clock], got %v", m.Requires)
	}
}

func TestParseManifestYAML_ParsesExclude(t *testing.T) {
	t.Parallel()

	m, err := ParseManifestYAML([]byte(`
name: kv
description: test
language: typescript
defaultAdapter: memory
exclude:
  - "*.test.ts"
  - "__tests__"
copy:
  - from: base
    to: "{{targetDir}}/kv"
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: x
`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(m.Exclude) != 2 {
		t.Fatalf("expected 2 exclude patterns, got %d", len(m.Exclude))
	}
}

// --- Normalization ---

func TestParseManifestYAML_NormalizesFields(t *testing.T) {
	t.Parallel()

	m, err := ParseManifestYAML([]byte(`
name: "  kv  "
description: "  Key-value storage  "
language: "  TypeScript  "
defaultAdapter: memory
copy:
  - from: base
    to: "{{targetDir}}/kv"
adapters:
  memory:
    description: "  In-memory  "
    copy:
      - from: adapters/memory
        to: "{{targetDir}}/kv/adapters/memory"
`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if m.Name != "kv" {
		t.Fatalf("expected name trimmed, got %q", m.Name)
	}
	if m.Language != "typescript" {
		t.Fatalf("expected language lowercased, got %q", m.Language)
	}
	if m.Adapters["memory"].Description != "In-memory" {
		t.Fatalf("expected adapter description trimmed, got %q", m.Adapters["memory"].Description)
	}
}

func TestParseManifestYAML_NormalizesDeps(t *testing.T) {
	t.Parallel()

	m, err := ParseManifestYAML([]byte(`
name: kv
description: test
language: typescript
defaultAdapter: memory
copy:
  - from: base
    to: "{{targetDir}}/kv"
deps:
  - " zod "
  - "zod"
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: "{{targetDir}}/kv/adapters/memory"
    deps:
      - " ioredis "
      - ""
`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(m.Deps) != 1 || m.Deps[0] != "zod" {
		t.Fatalf("expected deps [zod], got %#v", m.Deps)
	}
	mem := m.Adapters["memory"]
	if len(mem.Deps) != 1 || mem.Deps[0] != "ioredis" {
		t.Fatalf("expected adapter deps [ioredis], got %#v", mem.Deps)
	}
}

// --- Structural validation: required fields ---

func TestParseManifestYAML_RejectsEmptyFields(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		yaml string
	}{
		{"missing name", `
name: ""
description: test
language: typescript
defaultAdapter: memory
copy:
  - from: base
    to: dest
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: x
`},
		{"missing description", `
name: kv
description: ""
language: typescript
defaultAdapter: memory
copy:
  - from: base
    to: dest
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: x
`},
		{"missing language", `
name: kv
description: test
language: ""
defaultAdapter: memory
copy:
  - from: base
    to: dest
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: x
`},
		{"missing defaultAdapter", `
name: kv
description: test
language: typescript
defaultAdapter: ""
copy:
  - from: base
    to: dest
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: x
`},
		{"no copy entries", `
name: kv
description: test
language: typescript
defaultAdapter: memory
copy: []
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: x
`},
		{"no adapters", `
name: kv
description: test
language: typescript
defaultAdapter: memory
copy:
  - from: base
    to: dest
adapters: {}
`},
		{"empty to field", `
name: kv
description: test
language: typescript
defaultAdapter: memory
copy:
  - from: base
    to: ""
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: x
`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := ParseManifestYAML([]byte(tt.yaml))
			if err == nil {
				t.Fatal("expected validation error, got nil")
			}
		})
	}
}

// --- Structural validation: referential + semantic ---

func TestParseManifestYAML_RejectsDefaultAdapterNotInMap(t *testing.T) {
	t.Parallel()

	_, err := ParseManifestYAML([]byte(`
name: kv
description: test
language: typescript
defaultAdapter: redis
copy:
  - from: base
    to: dest
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: x
`))
	if err == nil {
		t.Fatal("expected error for missing default adapter, got nil")
	}
}

func TestParseManifestYAML_RejectsUnsupportedLanguage(t *testing.T) {
	t.Parallel()

	_, err := ParseManifestYAML([]byte(`
name: kv
description: test
language: python
defaultAdapter: memory
copy:
  - from: base
    to: dest
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: x
`))
	if err == nil {
		t.Fatal("expected error for unsupported language, got nil")
	}
}

func TestParseManifestYAML_RejectsBadAdapterName(t *testing.T) {
	t.Parallel()

	_, err := ParseManifestYAML([]byte(`
name: kv
description: test
language: typescript
defaultAdapter: memory
copy:
  - from: base
    to: dest
adapters:
  "../redis":
    description: nope
    copy:
      - from: adapters/redis
        to: x
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: y
`))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestParseManifestYAML_RejectsInvalidRequiresName(t *testing.T) {
	t.Parallel()

	_, err := ParseManifestYAML([]byte(`
name: cache
description: test
language: typescript
defaultAdapter: memory
requires:
  - "../clock"
copy:
  - from: base
    to: dest
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: x
`))
	if err == nil {
		t.Fatal("expected error for invalid requires primitive name, got nil")
	}
}

func TestParseManifestYAML_RejectsEmptyExcludePattern(t *testing.T) {
	t.Parallel()

	_, err := ParseManifestYAML([]byte(`
name: kv
description: test
language: typescript
defaultAdapter: memory
exclude:
  - ""
copy:
  - from: base
    to: dest
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: x
`))
	if err == nil {
		t.Fatal("expected validation error for empty exclude pattern, got nil")
	}
}

func TestParseManifestYAML_RejectsAdapterWithNoCopy(t *testing.T) {
	t.Parallel()

	_, err := ParseManifestYAML([]byte(`
name: kv
description: test
language: typescript
defaultAdapter: memory
copy:
  - from: base
    to: dest
adapters:
  memory:
    description: mem
    copy: []
`))
	if err == nil {
		t.Fatal("expected error for adapter with empty copy, got nil")
	}
}

// --- Structural validation: From path safety ---

func TestParseManifestYAML_RejectsTraversalInFrom(t *testing.T) {
	t.Parallel()

	_, err := ParseManifestYAML([]byte(`
name: kv
description: test
language: typescript
defaultAdapter: memory
copy:
  - from: "../../evil"
    to: dest
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: x
`))
	if err == nil {
		t.Fatal("expected error for traversal in from path, got nil")
	}
}

// --- Structural validation: To is not validated as path (contains templates) ---

func TestParseManifestYAML_AcceptsTemplateTokensInTo(t *testing.T) {
	t.Parallel()

	_, err := ParseManifestYAML([]byte(`
name: kv
description: test
language: typescript
defaultAdapter: memory
copy:
  - from: base
    to: "{{targetDir}}/kv"
adapters:
  memory:
    description: mem
    copy:
      - from: adapters/memory
        to: "{{targetDir}}/kv/adapters/memory"
`))
	if err != nil {
		t.Fatalf("template tokens in To should be accepted at parse time, got: %v", err)
	}
}

// --- Malformed input ---

func TestParseManifestYAML_RejectsMalformedYAML(t *testing.T) {
	t.Parallel()

	_, err := ParseManifestYAML([]byte(`{{not yaml`))
	if err == nil {
		t.Fatal("expected error for malformed YAML, got nil")
	}
}

// --- Resolved path validation (post-template) ---

func TestValidateResolvedPaths_Valid(t *testing.T) {
	t.Parallel()

	ops := []CopyOp{
		{From: "base", To: "src/infra/subspace/kv"},
		{From: "adapters/redis", To: "src/infra/subspace/kv/adapters/redis"},
	}

	resolved, err := ValidateResolvedPaths(ops)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resolved) != 2 {
		t.Fatalf("expected 2 resolved ops, got %d", len(resolved))
	}
	if resolved[0].To != "src/infra/subspace/kv" {
		t.Fatalf("expected resolved To, got %q", resolved[0].To)
	}
}

func TestValidateResolvedPaths_RejectsTraversalInTo(t *testing.T) {
	t.Parallel()

	ops := []CopyOp{
		{From: "base", To: "../../etc/evil"},
	}

	_, err := ValidateResolvedPaths(ops)
	if err == nil {
		t.Fatal("expected error for traversal in resolved To, got nil")
	}
}

func TestValidateResolvedPaths_RejectsAbsoluteTo(t *testing.T) {
	t.Parallel()

	ops := []CopyOp{
		{From: "base", To: "/etc/passwd"},
	}

	_, err := ValidateResolvedPaths(ops)
	if err == nil {
		t.Fatal("expected error for absolute resolved To, got nil")
	}
}
