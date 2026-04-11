# Release Runbook

Subspace releases publish two things:

- a pinned source registry archive
- prebuilt `subspace` CLI binaries from the same protected source commit

Releases are manual. Pushing to `main` does not publish automatically.

## Propose changes

For package, manifest, CLI, or workflow changes:

- open a PR against `main`
- satisfy the required CI checks
- get the required reviews
- merge to `main`

Manifest and release-pipeline changes should receive the higher-scrutiny review path described in repo security settings.

## Validate a release candidate locally

```bash
pnpm lint
pnpm typecheck
pnpm -r run build
pnpm subspace:registry:build
pnpm subspace:registry:validate
cd tooling/subspace-cli && go test ./...
```

Optional local release-asset build:

```bash
cd tooling/subspace-cli
GOCACHE=/tmp/subspace-go-release ./scripts/build-release-binaries.sh /tmp/subspace-release-assets
./scripts/create-registry-archive.sh registry /tmp/subspace-release-assets registry-vYYYY.MM.DD.N "$(git rev-parse HEAD)"
./scripts/write-release-checksums.sh /tmp/subspace-release-assets
```

## Cut a release

1. Merge the desired commit to `main`.
2. Copy the exact commit SHA from `main`.
3. Manually run the `registry-release` workflow.
4. Provide:
   - `release_version`, for example `registry-v2026.04.10.1`
   - `source_sha`, the exact 40-character commit SHA from `main`
5. Wait for:
   - input verification
   - Node validation
   - CLI/registry validation
   - candidate packaging
6. Approve the `registry-release` environment when prompted.
7. Confirm the GitHub Release contains:
   - `subspace-registry-<release>.tar.gz`
   - `checksums.txt`
   - `release-metadata.json`
   - platform CLI binaries

## Verify release assets

`checksums.txt` contains SHA-256 hashes for all published assets. Verify the registry archive or CLI binary before using it:

```bash
shasum -a 256 subspace-registry-registry-v2026.04.10.1.tar.gz
shasum -a 256 subspace-cli-darwin-arm64
```

Match the output to the corresponding line in `checksums.txt`.

## Consumer upgrade flow

Consumers should upgrade intentionally:

1. choose the new release tag
2. verify the archive checksum
3. point the CLI at the new pinned release
4. run `subspace info` / `subspace add` as needed
5. review and commit the resulting diff

There is no automatic “follow latest” behavior in the trust model.

## Deferred

- explicit `subspace registry update` UX
- `--registry <url-or-path>` flags on `list`, `info`, and `add`

Today, registry source selection is controlled with `SUBSPACE_REGISTRY_DIR`, `SUBSPACE_REGISTRY_URL`, and `SUBSPACE_REGISTRY_SHA256`.
