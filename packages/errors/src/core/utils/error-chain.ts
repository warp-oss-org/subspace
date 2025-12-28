function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

function getCause(v: unknown): unknown {
  return isRecord(v) && "cause" in v ? (v as { cause?: unknown }).cause : undefined
}

/**
 * Walk the error cause chain and return all values encountered.
 *
 * Safety:
 * - maxDepth guardrail (default 50)
 * - cycle detection via WeakSet
 *
 * @example
 * ```ts
 * catch (err) {
 *   for (const e of errorChain(err)) {
 *     console.log(e instanceof Error ? e.message : e)
 *   }
 * }
 * ```
 */
export function errorChain(err: unknown, maxDepth: number = 50): unknown[] {
  const chain: unknown[] = []
  const seen = new WeakSet<object>()

  let current: unknown = err

  while (current != null && chain.length < maxDepth) {
    if (typeof current === "object") {
      if (seen.has(current)) break
      seen.add(current)
    }

    chain.push(current)

    const next = getCause(current)

    if (next === undefined) break
    current = next
  }

  return chain
}
