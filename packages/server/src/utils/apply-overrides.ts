export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> | T[P] : T[P]
}

/**
 * Applies structural overrides to an object tree.
 *
 * Semantics:
 * - Plain objects (object literals) are deep-merged.
 * - Everything else (class instances, arrays, Dates, Maps, functions, etc.)
 *   is treated as atomic and replaced.
 */
export function applyOverrides<T extends object>(
  base: T,
  overrides: DeepPartial<T> = {},
): T {
  if (!overrides) return base
  return deepMerge(base, overrides)
}

function deepMerge<T extends object>(base: T, overrides: DeepPartial<T>): T {
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }

  for (const key in overrides) {
    const overrideVal = (overrides as Record<string, unknown>)[key]
    if (overrideVal === undefined) continue

    const baseVal = (base as Record<string, unknown>)[key]

    if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as DeepPartial<Record<string, unknown>>,
      )
    } else {
      result[key] = overrideVal
    }
  }

  return result as T
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false
  if (Array.isArray(value)) return false

  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
