## Subspace Primitive Structure — Final Convention

### Package layout

```
packages/
  cache/
    manifest.yaml
    README.md
    src/
      ports/
        bytes-cache.ts
        cache-entry.ts
        cache-key.ts
        ...
        index.ts
      core/
        codec/
          codec-data-cache.ts
        eviction/
          eviction-map.ts
          fifo-memory-map.ts
          lru-memory-map.ts
        through/
          read-through.ts
          write-through.ts
        time/
          clock.ts
      adapters/
        memory/
          adapter.ts
        redis/
          adapter.ts
      tests/
        contract/
          cache.contract.test.ts
        behavior/
          memory.behavior.test.ts
          redis.behavior.test.ts
```

Every primitive follows this shape. No `dist/`, no `node_modules/`, no `package.json`. These aren't npm packages — they're scaffold templates. Consumers own the code after `subspace add`.

### Manifest

**packages/cache/manifest.yaml**:

```yaml
name: cache
description: Multi-layer cache with codecs, eviction, and read/write-through
language: typescript
defaultAdapter: memory

copy:
  - from: src/ports
    to: "{{targetDir}}/cache/ports"
  - from: src/core
    to: "{{targetDir}}/cache/core"

tests:
  copy:
    - from: src/tests/contract
      to: "{{testsDir}}/cache/contract"
    - from: src/tests/behavior
      to: "{{testsDir}}/cache/behavior"

deps:
  - zod

adapters:
  memory:
    description: In-memory with LRU/FIFO eviction
    copy:
      - from: src/adapters/memory
        to: "{{targetDir}}/cache/adapters/memory"
  redis:
    description: Redis-backed
    copy:
      - from: src/adapters/redis
        to: "{{targetDir}}/cache/adapters/redis"
    deps:
      - ioredis
```

### What `subspace add cache --adapter redis` produces

```
src/infra/subspace/
  cache/
    ports/
      bytes-cache.ts
      cache-entry.ts
      ...
      index.ts
    core/
      codec/
        codec-data-cache.ts
      eviction/
        eviction-map.ts
        fifo-memory-map.ts
        lru-memory-map.ts
      through/
        read-through.ts
        write-through.ts
      adapters/
        redis/
          adapter.ts
    README.md

src/infra/subspace-tests/
  cache/
    contract/
      cache.contract.test.ts
    behavior/
      redis.behavior.test.ts
```

### CLI commands

```
subspace init                          # creates subspace.config.yaml
subspace list                          # shows available primitives (no config needed)
subspace info cache                    # shows adapters, deps, README (no config needed)
subspace add cache                     # scaffolds with default adapter (memory)
subspace add cache --adapter redis     # scaffolds with redis adapter
subspace add cache --dry-run           # prints plan without writing
subspace add cache --overwrite         # overwrites existing files
```

### Config

**subspace.config.yaml** (created by `init`):

```yaml
targetDir: src/infra/subspace
testsDir: src/infra/subspace-tests
language: typescript
packageManager: pnpm
```

### Build and distribution

`registry/` is generated release output and is intentionally git-ignored. Build or test commands must generate it before `go build`/`go test`; `go:embed` explicitly requires `registry/registry.json` so missing registry output fails the build instead of embedding a placeholder.

```bash
# Build deterministic source registry from repo packages
go run ./cmd/subspace-registry build --source ../../packages --out registry

# Validate generated registry hashes, paths, manifests, and dry-run plans
go run ./cmd/subspace-registry validate --dir registry

# Build distributable binary
go build -o /tmp/subspace-cli .
```

The registry builder copies manifest-backed [packages/*/](../../packages/) into [tooling/subspace-cli/registry/](./registry/) with `registry.json`, per-primitive manifests, source files, SHA-256 hashes, the source git SHA, and the registry schema version. The embed bundles generated `registry/` into release binaries.

CLI distribution:

- GitHub Releases are the primary install path for `subspace`.
- Release assets include the pinned CLI registry archive plus prebuilt CLI binaries for:
  - `darwin-amd64`
  - `darwin-arm64`
  - `linux-amd64`
  - `linux-arm64`
  - `windows-amd64`
- `go install github.com/warp-oss-org/subspace/tooling/subspace-cli@<tag>` remains a fallback for users who prefer building from source.
- The project does not publish the CLI to npm, so `npx` / `pnpm dlx` are intentionally not part of the trust model.

Registry source selection:

- Embedded registry is used by default.
- `SUBSPACE_REGISTRY_DIR=/path/to/registry` uses a local package or generated registry directory.
- `SUBSPACE_REGISTRY_URL=https://.../registry.tar.gz` plus `SUBSPACE_REGISTRY_SHA256=<archive-sha256>` uses a pinned remote registry archive.
- `SUBSPACE_REGISTRY_CA_FILE=/path/to/ca.pem` can add a private CA for internal HTTPS registry testing.

Remote registries are static tar archives only. The CLI verifies the declared archive SHA-256 before extraction, validates `registry.json` file hashes after extraction, rejects path traversal and unsupported archive entries, and never executes registry-provided scripts or commands.

### What ships with every primitive

- **Ports** — contract interfaces, always copied
- **Core** — implementation logic, always copied
- **Adapter** — one per `add` invocation, consumer picks
- **Contract tests** — verify port semantics, always copied
- **Behavior tests** — verify adapter logic, always copied
- **README** — copied into the primitive directory
- **Deps** — printed as install command, never auto-installed
- **Dev deps** — deferred; v1 manifests do not model test-only dependencies yet

### What does NOT ship

- Integration tests
- Internal unit tests (`__test__`/`__tests__` dirs)
- Build artifacts, config files, lockfiles
- Any runtime dependency on Subspace
