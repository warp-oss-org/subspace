# Security Model

Subspace uses a source-copy registry model for internal consumers.

## What consumers trust

Consumers trust:

- a protected source commit on `main`
- a manually approved `subspace-cli-release` workflow run
- a released Subspace CLI binary plus published checksums
- the reviewed diff generated in their own repo

## What the CLI does not do

The CLI does not:

- execute registry-provided scripts or commands
- run package-manager install hooks
- auto-install runtime dependencies
- auto-update consumer repos after scaffolding

The embedded registry is treated as static data plus source files.

## Registry integrity

Remote registry consumption uses:

- HTTPS only
- a caller-provided archive SHA-256
- per-file SHA-256 validation from `registry.json`
- path validation that rejects traversal outside the registry root
- archive validation that rejects unsupported entries

## Consumer ownership

After `subspace add`, the copied code belongs to the consumer repo:

- the consumer reviews it
- the consumer commits it
- later compromise of Subspace infrastructure does not rewrite already-copied code

## Limits of the model

This model does not guarantee:

- zero possibility of a malicious release
- automatic detection of bad code that passed review
- protection from a compromised release approver account by itself

The risk reduction comes from combining:

- protected source changes
- required CI
- protected release tags
- manual release dispatch
- separate environment approval

## Non-goals

Current non-goals:

- automatic registry tracking of `latest`
- hidden post-scaffold dependency management
