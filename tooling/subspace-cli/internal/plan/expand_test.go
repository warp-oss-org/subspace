package plan

import (
	"testing"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/internal/registry"
)

// stubEnumerator implements FileEnumerator for testing.
type stubEnumerator struct {
	// files maps "primitive/dir" → list of relative file paths
	files map[string][]string
	seen  map[string][]string
}

func (s *stubEnumerator) ListPrimitiveFiles(primitive, dir string, excludes []string) ([]string, error) {
	key := primitive + "/" + dir
	if s.seen == nil {
		s.seen = map[string][]string{}
	}
	s.seen[key] = append([]string(nil), excludes...)
	if files, ok := s.files[key]; ok {
		return files, nil
	}
	return nil, nil
}

func baseManifest() registry.Manifest {
	return registry.Manifest{
		Name:           "kv",
		Description:    "Key-value storage",
		Language:       "typescript",
		DefaultAdapter: "memory",
		Copy: []registry.CopyOp{
			{From: "base", To: "{{targetDir}}/kv"},
		},
		Adapters: map[string]registry.AdapterManifest{
			"memory": {
				Description: "In-memory",
				Copy: []registry.CopyOp{
					{From: "adapters/memory", To: "{{targetDir}}/kv/adapters/memory"},
				},
			},
			"redis": {
				Description: "Redis-backed",
				Copy: []registry.CopyOp{
					{From: "adapters/redis", To: "{{targetDir}}/kv/adapters/redis"},
				},
				Deps: []string{"ioredis"},
			},
		},
		Deps:    []string{"zod"},
		Exclude: []string{"__tests__"},
	}
}

func baseTokens() Tokens {
	return Tokens{
		TargetDir: "src/infra/subspace",
	}
}

// --- Happy path ---

func TestBuild_DefaultAdapter(t *testing.T) {
	t.Parallel()

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":            {"port.ts", "types.ts"},
		"kv/adapters/memory": {"adapter.ts"},
	}}

	p, err := Build("kv", baseManifest(), baseTokens(), Options{}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if p.Adapter != "memory" {
		t.Fatalf("expected default adapter 'memory', got %q", p.Adapter)
	}
	if len(p.Files) != 3 {
		t.Fatalf("expected 3 files, got %d", len(p.Files))
	}
}

func TestBuild_ExplicitAdapter(t *testing.T) {
	t.Parallel()

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":           {"port.ts"},
		"kv/adapters/redis": {"adapter.ts"},
	}}

	p, err := Build("kv", baseManifest(), baseTokens(), Options{Adapter: "redis"}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if p.Adapter != "redis" {
		t.Fatalf("expected adapter 'redis', got %q", p.Adapter)
	}
}

func TestBuild_ResolvesTokensInDestPaths(t *testing.T) {
	t.Parallel()

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":            {"port.ts"},
		"kv/adapters/memory": {"adapter.ts"},
	}}

	p, err := Build("kv", baseManifest(), baseTokens(), Options{}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	found := false
	for _, f := range p.Files {
		if f.DestPath == "src/infra/subspace/kv/port.ts" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected resolved dest path 'src/infra/subspace/kv/port.ts', got files: %v", p.Files)
	}
}

// --- Template (.tpl) handling ---

func TestBuild_StripsTplSuffix(t *testing.T) {
	t.Parallel()

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":            {"index.ts.tpl", "port.ts"},
		"kv/adapters/memory": {"adapter.ts"},
	}}

	p, err := Build("kv", baseManifest(), baseTokens(), Options{}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var tplFile *FileOp
	for i, f := range p.Files {
		if f.SrcPath == "base/index.ts.tpl" {
			tplFile = &p.Files[i]
			break
		}
	}

	if tplFile == nil {
		t.Fatal("expected to find .tpl source file in plan")
	}
	if !tplFile.Template {
		t.Fatal("expected Template=true for .tpl file")
	}
	if tplFile.DestPath != "src/infra/subspace/kv/index.ts" {
		t.Fatalf("expected .tpl suffix stripped in dest, got %q", tplFile.DestPath)
	}
}

func TestBuild_NonTplFilesNotMarkedAsTemplate(t *testing.T) {
	t.Parallel()

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":            {"port.ts"},
		"kv/adapters/memory": {"adapter.ts"},
	}}

	p, err := Build("kv", baseManifest(), baseTokens(), Options{}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, f := range p.Files {
		if f.Template {
			t.Fatalf("expected no template files, but %q is marked as template", f.SrcPath)
		}
	}
}

func TestBuild_FileCopySource(t *testing.T) {
	t.Parallel()

	m := baseManifest()
	m.Copy = []registry.CopyOp{
		{From: "src/adapters/fs-storage.ts", To: "{{targetDir}}/storage/adapters"},
	}
	m.Adapters = nil
	m.DefaultAdapter = ""

	enum := &stubEnumerator{files: map[string][]string{
		"storage/src/adapters/fs-storage.ts": {"."},
	}}

	p, err := Build("storage", m, baseTokens(), Options{}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(p.Files) != 1 {
		t.Fatalf("expected one file, got %d", len(p.Files))
	}
	if p.Files[0].SrcPath != "src/adapters/fs-storage.ts" {
		t.Fatalf("unexpected src path: %q", p.Files[0].SrcPath)
	}
	if p.Files[0].DestPath != "src/infra/subspace/storage/adapters/fs-storage.ts" {
		t.Fatalf("unexpected dest path: %q", p.Files[0].DestPath)
	}
}

func TestBuild_FileCopyTemplateSource(t *testing.T) {
	t.Parallel()

	m := baseManifest()
	m.Copy = []registry.CopyOp{
		{From: "src/index.ts.tpl", To: "{{targetDir}}/errors"},
	}
	m.Adapters = nil
	m.DefaultAdapter = ""

	enum := &stubEnumerator{files: map[string][]string{
		"errors/src/index.ts.tpl": {"."},
	}}

	p, err := Build("errors", m, baseTokens(), Options{}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(p.Files) != 1 {
		t.Fatalf("expected one file, got %d", len(p.Files))
	}
	if p.Files[0].SrcPath != "src/index.ts.tpl" {
		t.Fatalf("unexpected src path: %q", p.Files[0].SrcPath)
	}
	if p.Files[0].DestPath != "src/infra/subspace/errors/index.ts" {
		t.Fatalf("unexpected dest path: %q", p.Files[0].DestPath)
	}
	if !p.Files[0].Template {
		t.Fatal("expected Template=true for .tpl file source")
	}
}

func TestBuild_DeduplicatesIdenticalFiles(t *testing.T) {
	t.Parallel()

	m := baseManifest()
	m.Copy = []registry.CopyOp{
		{From: "src/common", To: "{{targetDir}}/config/common"},
	}
	m.DefaultAdapter = "env"
	m.Adapters = map[string]registry.AdapterManifest{
		"env": {
			Description: "Environment",
			Copy: []registry.CopyOp{
				{From: "src/common", To: "{{targetDir}}/config/common"},
			},
		},
	}

	enum := &stubEnumerator{files: map[string][]string{
		"config/src/common": {"env-source.ts"},
	}}

	p, err := Build("config", m, baseTokens(), Options{}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(p.Files) != 1 {
		t.Fatalf("expected duplicate file to be skipped, got %d files: %v", len(p.Files), p.Files)
	}
}

func TestBuild_RejectsConflictingDestinationFiles(t *testing.T) {
	t.Parallel()

	m := baseManifest()
	m.Copy = []registry.CopyOp{
		{From: "src/common", To: "{{targetDir}}/config"},
		{From: "src/other", To: "{{targetDir}}/config"},
	}
	m.Adapters = nil
	m.DefaultAdapter = ""

	enum := &stubEnumerator{files: map[string][]string{
		"config/src/common": {"index.ts"},
		"config/src/other":  {"index.ts"},
	}}

	_, err := Build("config", m, baseTokens(), Options{}, enum)
	if err == nil {
		t.Fatal("expected destination conflict error, got nil")
	}
}

// --- Tests section ---

func TestBuild_IncludesTests(t *testing.T) {
	t.Parallel()

	m := baseManifest()
	m.Tests = &registry.TestsSection{
		Copy: []registry.CopyOp{
			{From: "tests", To: "{{targetDir}}/kv/__tests__"},
		},
	}

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":            {"port.ts"},
		"kv/adapters/memory": {"adapter.ts"},
		"kv/tests":           {"kv.behavior.test.ts"},
	}}

	p, err := Build("kv", m, baseTokens(), Options{}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	found := false
	for _, f := range p.Files {
		if f.DestPath == "src/infra/subspace/kv/__tests__/kv.behavior.test.ts" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected test file in plan, got files: %v", p.Files)
	}
}

func TestBuild_NoTestsSection(t *testing.T) {
	t.Parallel()

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":            {"port.ts"},
		"kv/adapters/memory": {"adapter.ts"},
	}}

	p, err := Build("kv", baseManifest(), baseTokens(), Options{}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Only base + adapter files, no test files.
	if len(p.Files) != 2 {
		t.Fatalf("expected 2 files (no tests), got %d", len(p.Files))
	}
}

func TestBuild_PrimitiveWithoutAdapters(t *testing.T) {
	t.Parallel()

	m := registry.Manifest{
		Name:        "errors",
		Description: "Error helpers",
		Language:    "typescript",
		Copy: []registry.CopyOp{
			{From: "src", To: "{{targetDir}}/errors"},
		},
	}
	enum := &stubEnumerator{files: map[string][]string{
		"errors/src": {"index.ts", "core/base-error.ts"},
	}}

	p, err := Build("errors", m, baseTokens(), Options{}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.Adapter != "" {
		t.Fatalf("expected no adapter, got %q", p.Adapter)
	}
	if len(p.Files) != 2 {
		t.Fatalf("expected 2 files, got %d", len(p.Files))
	}
}

func TestBuild_RejectsAdapterForPrimitiveWithoutAdapters(t *testing.T) {
	t.Parallel()

	m := registry.Manifest{
		Name:        "errors",
		Description: "Error helpers",
		Language:    "typescript",
		Copy: []registry.CopyOp{
			{From: "src", To: "{{targetDir}}/errors"},
		},
	}
	enum := &stubEnumerator{files: map[string][]string{
		"errors/src": {"index.ts"},
	}}

	_, err := Build("errors", m, baseTokens(), Options{Adapter: "memory"}, enum)
	if err == nil {
		t.Fatal("expected adapter error, got nil")
	}
}

// --- Deps ---

func TestBuild_MergesDeps(t *testing.T) {
	t.Parallel()

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":           {"port.ts"},
		"kv/adapters/redis": {"adapter.ts"},
	}}

	p, err := Build("kv", baseManifest(), baseTokens(), Options{Adapter: "redis"}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(p.Deps) != 2 {
		t.Fatalf("expected 2 deps, got %d: %v", len(p.Deps), p.Deps)
	}
	// Sorted: ioredis, zod
	if p.Deps[0] != "ioredis" || p.Deps[1] != "zod" {
		t.Fatalf("expected sorted [ioredis zod], got %v", p.Deps)
	}
}

func TestBuild_DeduplicatesDeps(t *testing.T) {
	t.Parallel()

	m := baseManifest()
	m.Adapters["redis"] = registry.AdapterManifest{
		Description: "Redis",
		Copy: []registry.CopyOp{
			{From: "adapters/redis", To: "{{targetDir}}/kv/adapters/redis"},
		},
		Deps: []string{"zod", "ioredis"}, // zod duplicates primitive-level dep
	}

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":           {"port.ts"},
		"kv/adapters/redis": {"adapter.ts"},
	}}

	p, err := Build("kv", m, baseTokens(), Options{Adapter: "redis"}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(p.Deps) != 2 {
		t.Fatalf("expected 2 deps (deduped), got %d: %v", len(p.Deps), p.Deps)
	}
}

func TestBuild_NoDeps(t *testing.T) {
	t.Parallel()

	m := baseManifest()
	m.Deps = nil
	m.Adapters["memory"] = registry.AdapterManifest{
		Description: "In-memory",
		Copy: []registry.CopyOp{
			{From: "adapters/memory", To: "{{targetDir}}/kv/adapters/memory"},
		},
		// no deps
	}

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":            {"port.ts"},
		"kv/adapters/memory": {"adapter.ts"},
	}}

	p, err := Build("kv", m, baseTokens(), Options{}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(p.Deps) != 0 {
		t.Fatalf("expected no deps, got %v", p.Deps)
	}
}

func TestBuild_PassesMergedExcludesToEnumerator(t *testing.T) {
	t.Parallel()

	m := baseManifest()
	m.Exclude = []string{"__tests__", "*.spec.ts"}

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":            {"port.ts"},
		"kv/adapters/memory": {"adapter.ts"},
	}}

	_, err := Build("kv", m, baseTokens(), Options{
		ExtraExcludes: []string{"*.test.ts", "__tests__"},
	}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	gotBase := enum.seen["kv/base"]
	if len(gotBase) != 3 {
		t.Fatalf("expected 3 merged excludes, got %v", gotBase)
	}
	if gotBase[0] != "*.spec.ts" || gotBase[1] != "*.test.ts" || gotBase[2] != "__tests__" {
		t.Fatalf("unexpected exclude merge order/content: %v", gotBase)
	}
}

// --- Dirs ---

func TestBuild_DeduplicatesDirs(t *testing.T) {
	t.Parallel()

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":            {"port.ts", "types.ts"},
		"kv/adapters/memory": {"adapter.ts"},
	}}

	p, err := Build("kv", baseManifest(), baseTokens(), Options{}, enum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// port.ts and types.ts both land in the same dir — should only appear once.
	dirCount := map[string]int{}
	for _, d := range p.Dirs {
		dirCount[d.Path]++
	}
	for dir, count := range dirCount {
		if count > 1 {
			t.Fatalf("dir %q appears %d times, expected 1", dir, count)
		}
	}
}

// --- Error cases ---

func TestBuild_RejectsUnknownAdapter(t *testing.T) {
	t.Parallel()

	enum := &stubEnumerator{}

	_, err := Build("kv", baseManifest(), baseTokens(), Options{Adapter: "dynamodb"}, enum)
	if err == nil {
		t.Fatal("expected error for unknown adapter, got nil")
	}
}

func TestBuild_RejectsUnresolvedToken(t *testing.T) {
	t.Parallel()

	m := baseManifest()
	m.Copy = []registry.CopyOp{
		{From: "base", To: "{{unknownToken}}/kv"},
	}

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base": {"port.ts"},
	}}

	_, err := Build("kv", m, baseTokens(), Options{}, enum)
	if err == nil {
		t.Fatal("expected error for unresolved token, got nil")
	}
}

func TestBuild_RejectsTraversalInResolvedPath(t *testing.T) {
	t.Parallel()

	tokens := Tokens{
		TargetDir: "../../etc",
	}

	enum := &stubEnumerator{files: map[string][]string{
		"kv/base":            {"port.ts"},
		"kv/adapters/memory": {"adapter.ts"},
	}}

	_, err := Build("kv", baseManifest(), tokens, Options{}, enum)
	if err == nil {
		t.Fatal("expected error for traversal in resolved path, got nil")
	}
}
