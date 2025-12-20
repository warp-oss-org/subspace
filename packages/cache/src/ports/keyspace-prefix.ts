/**
 * A prefix that scopes an adapter instance to a partition of a shared keyspace
 * (e.g. a Redis cluster).
 *
 * @remarks
 * This prefix represents **ownership of a keyspace partition** by a specific
 * subsystem or responsibility (cache, sessions, rate limiting, etc.), not
 * a single global prefix for an entire application.
 *
 * Multiple adapters within the same application may target the same Redis
 * cluster while using different prefixes to avoid collisions and ensure
 * isolation:
 *
 * - `app:prod:cache:`
 * - `app:prod:sessions:`
 * - `app:prod:ratelimit:`
 *
 * Adapters must treat this value as an opaque string and simply prepend it to
 */
export type KeyspacePrefix = string
