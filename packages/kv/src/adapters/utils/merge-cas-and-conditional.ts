import type { KeyValueStoreCas } from "../../ports/kv-cas"
import type { KeyValueStoreConditional } from "../../ports/kv-conditional"

export function mergeCasAndConditional<T>(
  cas: KeyValueStoreCas<T>,
  conditional: KeyValueStoreConditional<T>,
): KeyValueStoreCas<T> & KeyValueStoreConditional<T> {
  return {
    setIfExists: conditional.setIfExists.bind(conditional),
    setIfNotExists: conditional.setIfNotExists.bind(conditional),

    getVersioned: cas.getVersioned.bind(cas),
    setIfVersion: cas.setIfVersion.bind(cas),
    get: cas.get.bind(cas),
    set: cas.set.bind(cas),
    delete: cas.delete.bind(cas),
    has: cas.has.bind(cas),
    getMany: cas.getMany.bind(cas),
    setMany: cas.setMany.bind(cas),
    deleteMany: cas.deleteMany.bind(cas),
  }
}
