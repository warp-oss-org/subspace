import { vi } from "vitest"

vi.mock("hono/route", () => {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: this is a pure function from Hono that need's some runtime types to work properly
    routePath: (c: any) => {
      const v = c?.get?.("route")
      return typeof v === "string" && v.length > 0 ? v : ""
    },
  }
})
