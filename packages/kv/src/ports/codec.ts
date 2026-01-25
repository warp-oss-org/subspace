/**
 * Codec defines a bidirectional transformation between a typed value `T`
 * and a byte representation.
 *
 * @remarks
 * Codecs sit at the boundary between typed KV store usage (`KeyValueStore<T>`) and
 * byte-oriented KV store adapters (e.g. Redis, Memcached).
 *
 * Codecs should be pure, deterministic transforms. Adapters must treat codec
 * output as opaque bytes and must not import or depend on codecs directly.
 *
 * @example
 * A simple JSON-based codec:
 * ```ts
 * const jsonCodec: Codec<User> = {
 *   encode(value) {
 *     return new TextEncoder().encode(JSON.stringify(value))
 *   },
 *   decode(bytes) {
 *     return JSON.parse(new TextDecoder().decode(bytes))
 *   },
 * }
 * ```
 *
 * @remarks
 * Plain JSON codecs do not preserve rich JavaScript types such as `Date`,
 * `Map`, `Set`, `BigInt`, or class instances. If this matters, define a
 * domain-specific codec that explicitly encodes and decodes those fields.
 *
 * Codecs are typically defined:
 * - alongside the domain type being stored in the KV store
 * - or at application composition time when wiring KV stores
 */
export interface Codec<T> {
  /**
   * Encode a value into a byte representation suitable for storage in a
   * byte-oriented KV store backend.
   */
  encode(value: T): Uint8Array

  /**
   * Decode a previously encoded byte representation back into a value.
   */
  decode(bytes: Uint8Array): T
}
