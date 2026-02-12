# Concepts

Subspace is designed as a set of composable primitives instead of a framework.

## Design principles

- Small scope per package
- Explicit guarantees and failure behavior
- Adapter-driven integrations
- Minimal cross-package coupling

## Package model

Each package should make three things obvious:

- What problem it solves
- What guarantees it provides
- Which adapters and runtime dependencies it needs

## Example model

Examples are integration references. They should show:

- How multiple primitives compose in a real service
- Environment and infrastructure setup
- Operational flow from request to side effects

## Documentation boundaries

- Global docs (`docs/`): cross-cutting guidance and indexes
- Package docs (`packages/*/README.md`): package-specific contracts and usage
- Example docs (`examples/*/README.md`): runnable end-to-end walkthroughs
