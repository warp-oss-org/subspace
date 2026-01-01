import type { Milliseconds } from "@subspace/clock"
import type { ReadinessCheck, ResolvedHealthConfig } from "../config"
import type { Application } from "../server"

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const

export function registerHealthRoutes(
  app: Application,
  config: ResolvedHealthConfig,
  isReady: () => boolean,
): void {
  if (!config.enabled) return

  app.get(config.livenessPath, (c) => c.json({ ok: true }, { headers: NO_CACHE_HEADERS }))

  app.get(config.readinessPath, async (c) => {
    if (!isReady()) {
      return c.json(
        { ok: false, reason: "starting" },
        { status: 503, headers: NO_CACHE_HEADERS },
      )
    }

    for (const check of config.readinessChecks) {
      const timeout = check.timeoutMs ?? config.checkTimeoutMs
      const res = await runCheckWithTimeout(check, timeout)

      if (!res.ok) {
        return c.json(
          { ok: false, reason: res.reason },
          { status: 503, headers: NO_CACHE_HEADERS },
        )
      }
    }

    return c.json({ ok: true }, { headers: NO_CACHE_HEADERS })
  })
}

async function runCheckWithTimeout(
  check: ReadinessCheck,
  timeoutMs: Milliseconds,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const result = await check.fn(controller.signal)

    if (controller.signal.aborted) {
      return { ok: false, reason: `${check.name}:timeout` }
    }

    return result ? { ok: true } : { ok: false, reason: check.name }
  } catch {
    if (controller.signal.aborted) {
      return { ok: false, reason: `${check.name}:timeout` }
    }

    return { ok: false, reason: `${check.name}:error` }
  } finally {
    clearTimeout(timer)
  }
}
