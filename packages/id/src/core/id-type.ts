/**
 * Contract for validating and parsing branded IDs at runtime boundaries.
 *
 * IdType defines how to recognize and parse a specific ID type when data
 * crosses boundaries (DB rows, JSON payloads, user input). Each domain ID
 * (UserId, OrderId, etc.) implements this interface.
 *
 * @example
 * ```typescript
 * type UserId = Brand<string, 'UserId'>
 *
 * const isUserId = (v: unknown): v is UserId =>
 *   typeof v === 'string' && v.startsWith('usr_')
 *
 * const UserId: IdType<UserId> = {
 *   kind: 'UserId',
 *   is: isUserId,
 *   parse: (v) => {
 *     if (!isUserId(v)) throw new Error('Invalid UserId')
 *     return v
 *   }
 * }
 * ```
 */
export interface IdType<T> {
  /** Identifier name for error messages and debugging */
  readonly kind: string

  /**
   * Parse and validate unknown input, returning a branded ID.
   * @throws Implementation-defined error if validation fails
   */
  parse(value: unknown): T

  /** Type guard for non-throwing validation */
  is(value: unknown): value is T
}
