package registry

import (
	"os"
	"reflect"
	"testing"
	"testing/fstest"
)

// validManifestYAML is a minimal valid manifest for testing.
const validManifestYAML = `
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
`

// --- ListPrimitives ---

func TestListPrimitives_ReturnsSorted(t *testing.T) {
	t.Parallel()

	mapFS := fstest.MapFS{
		"email":               {Mode: os.ModeDir},
		"email/manifest.yaml": {Data: []byte(validManifestYAML)},
		"cache":               {Mode: os.ModeDir},
		"cache/manifest.yaml": {Data: []byte(validManifestYAML)},
		"kv":                  {Mode: os.ModeDir},
		"kv/manifest.yaml":    {Data: []byte(validManifestYAML)},
	}
	r := &fsRegistry{src: "test", fs: mapFS}

	prims, err := r.ListPrimitives()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prims) != 3 {
		t.Fatalf("expected 3 primitives, got %d: %v", len(prims), prims)
	}
	if prims[0] != "cache" || prims[1] != "email" || prims[2] != "kv" {
		t.Fatalf("expected sorted [cache email kv], got %v", prims)
	}
}

func TestListPrimitives_SkipsNonPrimitiveDirs(t *testing.T) {
	t.Parallel()

	mapFS := fstest.MapFS{
		"kv":                  {Mode: os.ModeDir},
		"kv/manifest.yaml":    {Data: []byte(validManifestYAML)},
		"cache":               {Mode: os.ModeDir},
		"email":               {Mode: os.ModeDir},
		"email/manifest.yaml": {Data: []byte("not: valid")},
		".git":                {Mode: os.ModeDir},
		"NOTES":               {Mode: os.ModeDir},
		"readme.txt":          {Data: []byte("not a dir")},
	}
	r := &fsRegistry{src: "test", fs: mapFS}

	prims, err := r.ListPrimitives()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prims) != 1 || prims[0] != "kv" {
		t.Fatalf("expected [kv], got %v", prims)
	}
}

func TestListPrimitives_EmptyRegistry(t *testing.T) {
	t.Parallel()

	r := &fsRegistry{src: "test", fs: fstest.MapFS{}}

	prims, err := r.ListPrimitives()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prims) != 0 {
		t.Fatalf("expected empty list, got %v", prims)
	}
}

// --- LoadManifest ---

func TestLoadManifest_Valid(t *testing.T) {
	t.Parallel()

	mapFS := fstest.MapFS{
		"kv":               {Mode: os.ModeDir},
		"kv/manifest.yaml": {Data: []byte(validManifestYAML)},
	}
	r := &fsRegistry{src: "test", fs: mapFS}

	m, err := r.LoadManifest("kv")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if m.Name != "kv" {
		t.Fatalf("expected name 'kv', got %q", m.Name)
	}
	if m.DefaultAdapter != "memory" {
		t.Fatalf("expected defaultAdapter 'memory', got %q", m.DefaultAdapter)
	}
}

func TestLoadManifest_RejectsInvalidPrimitiveName(t *testing.T) {
	t.Parallel()

	r := &fsRegistry{src: "test", fs: fstest.MapFS{}}

	tests := []string{"../evil", "UPPER", "", ".hidden", "a/b"}
	for _, name := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			_, err := r.LoadManifest(name)
			if err == nil {
				t.Fatalf("expected error for primitive name %q, got nil", name)
			}
		})
	}
}

func TestLoadManifest_RejectsMissingManifest(t *testing.T) {
	t.Parallel()

	mapFS := fstest.MapFS{
		"kv": {Mode: os.ModeDir},
	}
	r := &fsRegistry{src: "test", fs: mapFS}

	_, err := r.LoadManifest("kv")
	if err == nil {
		t.Fatal("expected error for missing manifest, got nil")
	}
}

func TestLoadManifest_RejectsInvalidManifest(t *testing.T) {
	t.Parallel()

	mapFS := fstest.MapFS{
		"kv":               {Mode: os.ModeDir},
		"kv/manifest.yaml": {Data: []byte("{{not yaml")},
	}
	r := &fsRegistry{src: "test", fs: mapFS}

	_, err := r.LoadManifest("kv")
	if err == nil {
		t.Fatal("expected error for invalid manifest, got nil")
	}
}

// --- ReadPrimitiveFile ---

func TestReadPrimitiveFile_Valid(t *testing.T) {
	t.Parallel()

	mapFS := fstest.MapFS{
		"kv":           {Mode: os.ModeDir},
		"kv/README.md": {Data: []byte("# KV Primitive")},
	}
	r := &fsRegistry{src: "test", fs: mapFS}

	b, err := r.ReadPrimitiveFile("kv", "README.md")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(b) != "# KV Primitive" {
		t.Fatalf("unexpected content: %q", string(b))
	}
}

func TestReadPrimitiveFile_NestedPath(t *testing.T) {
	t.Parallel()

	mapFS := fstest.MapFS{
		"kv":                           {Mode: os.ModeDir},
		"kv/adapters/redis/adapter.ts": {Data: []byte("export class RedisAdapter {}")},
	}
	r := &fsRegistry{src: "test", fs: mapFS}

	b, err := r.ReadPrimitiveFile("kv", "adapters/redis/adapter.ts")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(b) != "export class RedisAdapter {}" {
		t.Fatalf("unexpected content: %q", string(b))
	}
}

func TestReadPrimitiveFile_RejectsTraversal(t *testing.T) {
	t.Parallel()

	mapFS := fstest.MapFS{
		"kv":           {Mode: os.ModeDir},
		"kv/README.md": {Data: []byte("ok")},
		"secret.txt":   {Data: []byte("should not read")},
	}
	r := &fsRegistry{src: "test", fs: mapFS}

	tests := []string{"../secret.txt", "../../etc/passwd", "", ".", ".."}
	for _, rel := range tests {
		t.Run(rel, func(t *testing.T) {
			t.Parallel()
			_, err := r.ReadPrimitiveFile("kv", rel)
			if err == nil {
				t.Fatalf("expected error for rel path %q, got nil", rel)
			}
		})
	}
}

func TestReadPrimitiveFile_RejectsInvalidPrimitiveName(t *testing.T) {
	t.Parallel()

	r := &fsRegistry{src: "test", fs: fstest.MapFS{}}

	_, err := r.ReadPrimitiveFile("../evil", "README.md")
	if err == nil {
		t.Fatal("expected error for invalid primitive name, got nil")
	}
}

func TestReadPrimitiveFile_RejectsMissingFile(t *testing.T) {
	t.Parallel()

	mapFS := fstest.MapFS{
		"kv": {Mode: os.ModeDir},
	}
	r := &fsRegistry{src: "test", fs: mapFS}

	_, err := r.ReadPrimitiveFile("kv", "nope.txt")
	if err == nil {
		t.Fatal("expected error for missing file, got nil")
	}
}

func TestOpen_EmbeddedFallback(t *testing.T) {
	t.Parallel()

	// No env var set — should use the provided embedded FS.
	mapFS := fstest.MapFS{
		"kv":               {Mode: os.ModeDir},
		"kv/manifest.yaml": {Data: []byte(validManifestYAML)},
	}

	r, err := Open(mapFS)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	if r.Source() != "embedded" {
		t.Fatalf("expected embedded source, got %q", r.Source())
	}

	m, err := r.LoadManifest("kv")
	if err != nil {
		t.Fatalf("LoadManifest: %v", err)
	}
	if m.Name != "kv" {
		t.Fatalf("expected name 'kv', got %q", m.Name)
	}
}

// --- Primitive name validation ---

func TestValidatePrimitiveName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		wantErr bool
	}{
		{"kv", false},
		{"my-cache", false},
		{"email_v2", false},
		{"a1", false},
		{"", true},
		{"UPPER", true},
		{"../evil", true},
		{".hidden", true},
		{"a/b", true},
		{"-leading", true},
		{"_leading", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			err := validatePrimitiveName(tt.name)
			if tt.wantErr && err == nil {
				t.Fatal("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestListPrimitiveFiles_ExcludeBehavior(t *testing.T) {
	t.Parallel()

	mapFS := fstest.MapFS{
		"kv":                                   {Mode: os.ModeDir},
		"kv/manifest.yaml":                     {Data: []byte(validManifestYAML)},
		"kv/src":                               {Mode: os.ModeDir},
		"kv/src/index.ts":                      {Data: []byte("export {}")},
		"kv/src/service.test.ts":               {Data: []byte("test")},
		"kv/src/nested":                        {Mode: os.ModeDir},
		"kv/src/nested/thing.ts":               {Data: []byte("ok")},
		"kv/src/nested/__tests__":              {Mode: os.ModeDir},
		"kv/src/nested/__tests__/deep.test.ts": {Data: []byte("test")},
		"kv/src/adapters":                      {Mode: os.ModeDir},
		"kv/src/adapters/redis.ts":             {Data: []byte("ok")},
		"kv/src/adapters/__tests__":            {Mode: os.ModeDir},
		"kv/src/adapters/__tests__/adapter.contract.ts":  {Data: []byte("test")},
		"kv/src/adapters/__test__":                       {Mode: os.ModeDir},
		"kv/src/adapters/__test__/adapter.behavior.test": {Data: []byte("test")},
	}

	r := &fsRegistry{src: "test", fs: mapFS}
	files, err := r.ListPrimitiveFiles("kv", "src", []string{"*.test.ts", "__tests__", "__test__"})
	if err != nil {
		t.Fatalf("ListPrimitiveFiles: %v", err)
	}

	want := []string{
		"adapters/redis.ts",
		"index.ts",
		"nested/thing.ts",
	}
	if !reflect.DeepEqual(files, want) {
		t.Fatalf("unexpected filtered files:\ngot:  %v\nwant: %v", files, want)
	}
}

func TestListPrimitiveFiles_DeterministicSorting(t *testing.T) {
	t.Parallel()

	mapFS := fstest.MapFS{
		"kv":               {Mode: os.ModeDir},
		"kv/manifest.yaml": {Data: []byte(validManifestYAML)},
		"kv/src":           {Mode: os.ModeDir},
		"kv/src/z.ts":      {Data: []byte("z")},
		"kv/src/a.ts":      {Data: []byte("a")},
		"kv/src/m.ts":      {Data: []byte("m")},
	}
	r := &fsRegistry{src: "test", fs: mapFS}

	files, err := r.ListPrimitiveFiles("kv", "src", nil)
	if err != nil {
		t.Fatalf("ListPrimitiveFiles: %v", err)
	}

	want := []string{"a.ts", "m.ts", "z.ts"}
	if !reflect.DeepEqual(files, want) {
		t.Fatalf("unexpected sort order: got %v want %v", files, want)
	}
}

func TestListPrimitiveFiles_FileSource(t *testing.T) {
	t.Parallel()

	mapFS := fstest.MapFS{
		"storage":                            {Mode: os.ModeDir},
		"storage/manifest.yaml":              {Data: []byte(validManifestYAML)},
		"storage/src":                        {Mode: os.ModeDir},
		"storage/src/adapters":               {Mode: os.ModeDir},
		"storage/src/adapters/fs-storage.ts": {Data: []byte("export {}")},
	}
	r := &fsRegistry{src: "test", fs: mapFS}

	files, err := r.ListPrimitiveFiles("storage", "src/adapters/fs-storage.ts", nil)
	if err != nil {
		t.Fatalf("ListPrimitiveFiles: %v", err)
	}

	want := []string{"."}
	if !reflect.DeepEqual(files, want) {
		t.Fatalf("unexpected file source result: got %v want %v", files, want)
	}
}
