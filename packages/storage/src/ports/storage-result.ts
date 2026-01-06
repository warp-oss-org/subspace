import type { StorageObjectMetadata } from "./storage-object"

export interface ListResult {
  /** Objects matching the list query */
  objects: StorageObjectMetadata[]

  /** Common prefixes when using delimiter (i.e., "folders") */
  prefixes?: string[]

  /** Opaque token for next page. Undefined when no more results. */
  cursor?: string
}
