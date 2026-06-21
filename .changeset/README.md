# Changesets

Add a changeset for every user-visible change to a published `@subspace/*`
package. Documentation, CI, and tooling-only changes do not require one.

```bash
pnpm changeset
```

Packages are versioned independently. The automated version PR targets `dev`;
publishing occurs separately from an exact commit promoted to `main`.
