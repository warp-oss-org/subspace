export type InFlightKey = string

/**
 * Where the result originated from
 * - "leader": This caller executed the function
 * - "inflight": This caller waited on an in-flight call started by another
 */
export type FlightSource = "leader" | "inflight"

/**
 * Result of a singleflight call
 */
export interface FlightResult<T> {
  /** The resolved value */
  value: T

  /** Whether this caller executed the function */
  isLeader: boolean

  /** Number of other callers that shared this result (excluding leader) */
  sharedWith: number

  /** Where this result came from */
  source: FlightSource
}

/**
 * A group represents a namespace for deduplicating concurrent work.
 *
 * Multiple calls to `do()` with the same key while a call is in-flight
 * will share the same promise and receive identical results (shared fate).
 *
 * @example
 * ```ts
 * const group = createSingleflightGroup<User>();
 *
 * // These three concurrent calls result in ONE fetch
 * const [a, b, c] = await Promise.all([
 *   group.do("user:123", () => fetchUser(123)),
 *   group.do("user:123", () => fetchUser(123)),
 *   group.do("user:123", () => fetchUser(123)),
 * ]);
 *
 * a.isLeader  // true
 * b.isLeader  // false
 * a.value === b.value === c.value  // same instance
 * ```
 */
export interface Singleflight<T = unknown> {
  /**
   * Execute fn() for key, deduplicating concurrent calls.
   *
   * If a call is already in-flight for this key, the returned promise
   * will resolve/reject with the same outcome (shared fate).
   *
   * Error behavior:
   * - All waiters receive the same Error instance (shared fate)
   * - Next call after failure starts fresh
   */
  run<R = T>(key: InFlightKey, fn: () => Promise<R>): Promise<FlightResult<R>>

  /**
   * Like run(), but returns undefined immediately if a call is in-flight.
   *
   * Useful for "if someone's already fetching, bail" semantics.
   */
  tryRun<R = T>(
    key: InFlightKey,
    fn: () => Promise<R>,
  ): Promise<FlightResult<R>> | undefined

  /**
   * Forget a key, allowing the next call to execute fresh.
   *
   * If in-flight: current waiters still get their result, next caller starts new flight.
   */
  forget(key: InFlightKey): void

  readonly size: number
}
