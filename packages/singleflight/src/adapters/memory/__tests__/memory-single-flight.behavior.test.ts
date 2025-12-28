import { MemorySingleflight } from "../memory-single-flight"

describe("MemorySingleflight behavior", () => {
  let singleflight: MemorySingleflight<unknown>

  beforeEach(() => {
    singleflight = new MemorySingleflight()
  })

  describe("tryRun", () => {
    it("returns undefined when flight in progress", () => {
      let resolve: (value: string) => void
      const fn = () =>
        new Promise<string>((r) => {
          resolve = r
        })

      singleflight.run("key", fn)
      const second = singleflight.tryRun("key", fn)

      expect(second).toBeUndefined()

      resolve!("value")
    })

    it("starts new flight when no flight in progress", async () => {
      const result = await singleflight.tryRun("key", async () => "value")

      expect(result).toBeDefined()
      expect(result!.isLeader).toBe(true)
      expect(result!.value).toBe("value")
    })
  })

  describe("forget", () => {
    it("allows next caller to start fresh flight", async () => {
      let callCount = 0
      let resolve1: (value: string) => void
      let resolve2: (value: string) => void

      const first = singleflight.run(
        "key",
        () =>
          new Promise<string>((r) => {
            callCount++
            resolve1 = r
          }),
      )

      singleflight.forget("key")

      const second = singleflight.run(
        "key",
        () =>
          new Promise<string>((r) => {
            callCount++
            resolve2 = r
          }),
      )

      expect(callCount).toBe(2)

      resolve1!("value1")
      resolve2!("value2")

      await Promise.all([first, second])
    })

    it("existing waiters still receive result", async () => {
      let resolve: (value: string) => void
      const fn = () =>
        new Promise<string>((r) => {
          resolve = r
        })

      const first = singleflight.run("key", fn)
      const second = singleflight.run("key", fn)

      singleflight.forget("key")
      resolve!("value")

      const [a, b] = await Promise.all([first, second])

      expect(a.value).toBe("value")
      expect(b.value).toBe("value")
    })

    it("result not cached after forgotten flight completes", async () => {
      let callCount = 0
      let resolve1: (value: string) => void

      const first = singleflight.run(
        "key",
        () =>
          new Promise<string>((r) => {
            callCount++
            resolve1 = r
          }),
      )

      singleflight.forget("key")
      resolve1!("value1")
      await first

      const second = await singleflight.run("key", async () => {
        callCount++
        return "value2"
      })

      expect(callCount).toBe(2)
      expect(second.isLeader).toBe(true)
    })
  })
})
