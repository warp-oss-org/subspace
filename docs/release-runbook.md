# Release Runbook

Subspace CLI releases publish:

- prebuilt `subspace` CLI binaries from a protected source commit
- `checksums.txt`
- `release-metadata.json`

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
GOCACHE=/tmp/subspace-go-release ./scripts/build-release-binaries.sh /tmp/subspace-release-assets subspace-cli-vYYYY.MM.DD.N "$(git rev-parse HEAD)"
./scripts/write-release-metadata.sh /tmp/subspace-release-assets subspace-cli-vYYYY.MM.DD.N "$(git rev-parse HEAD)"
./scripts/write-release-checksums.sh /tmp/subspace-release-assets
```

## Cut a release

1. Merge the desired commit to `main`.
2. Copy the exact commit SHA from `main`.
3. Manually run the `subspace-cli-release` workflow.
4. Provide:
   - `release_version`, for example `subspace-cli-v2026.04.11.1`
   - `source_sha`, the exact 40-character commit SHA from `main`
5. Wait for:
   - input verification
   - Node validation
   - CLI/registry validation
   - candidate packaging
6. Approve the `subspace-cli-release` environment when prompted.
7. Confirm the GitHub Release contains:
   - platform CLI binaries
   - `checksums.txt`
   - `release-metadata.json`

## Verify release assets

`checksums.txt` contains SHA-256 hashes for all published assets. Verify the CLI binary before using it:

```bash
shasum -a 256 subspace-cli-darwin-arm64
```

Match the output to the corresponding line in `checksums.txt`.

## Consumer upgrade flow

Consumers should upgrade intentionally:

1. choose the new release tag
2. verify the published checksums or run `subspace update --to <tag>`
3. run `subspace info` / `subspace add` as needed
4. review and commit the resulting diff

There is no automatic “follow latest” behavior in the trust model.
