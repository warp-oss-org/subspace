import type { Milliseconds } from "@subspace/clock"

type MillisecondsTtl = { kind: "milliseconds"; milliseconds: Milliseconds }

export type KvTtl = MillisecondsTtl

export interface KvSetOptions {
  /**
   * Optional TTL for the entry.
   *
   * @remarks
   * Unlike cache TTL (which is a hint), KV TTL represents actual data expiration
   * semantics - e.g., session tokens, temporary locks.
   */
  readonly ttl?: KvTtl
}
