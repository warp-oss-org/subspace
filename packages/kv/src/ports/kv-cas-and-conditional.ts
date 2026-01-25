import type { KeyValueStoreCas } from "./kv-cas"
import type { KeyValueStoreConditional } from "./kv-conditional"

export interface KeyValueStoreCasAndConditional<T>
  extends KeyValueStoreCas<T>,
    KeyValueStoreConditional<T> {}
