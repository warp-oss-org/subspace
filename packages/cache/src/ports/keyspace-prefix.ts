/**
 * A prefix that scopes an adapter instance to a partition of a shared keyspace
 * (e.g. a Redis cluster).
 *
 * @remarks
 * Combines two levels of scoping:
 *
 * 1. **Infrastructure prefix** - environment/app isolation (e.g. `myapp:prod`)
 * 2. **Domain namespace** - subsystem isolation (e.g. `uploads:metadata`)
 *
 * Together they form the full keyspace prefix: `myapp:prod:uploads:metadata`
 *
 * Multiple adapters within the same application may target the same Redis
 * cluster while using different prefixes to avoid collisions and ensure
 * isolation:
 *
 * - `myapp:prod:uploads:metadata`
 * - `myapp:prod:uploads:jobs`
 * - `myapp:prod:sessions`
 * - `myapp:prod:cache`
 *
 * The prefix should **not** include a trailing delimiter. Adapters add the
 * delimiter when building keys:
 *
 * ```typescript
 * private key(id: string) {
 *   return `${this.prefix}:${id}`
 * }
 * ```
 */
export type KeyspacePrefix = string
