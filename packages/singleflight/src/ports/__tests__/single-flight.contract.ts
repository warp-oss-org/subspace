import type { Singleflight } from "../single-flight"

export function describeSingleFlightContract(
  name: string,
  factory: () => Singleflight<unknown>,
) {
  describe(`${name} contract`, () => {
    let singleflight: Singleflight<unknown>

    beforeEach(() => {
      singleflight = factory()
    })

    describe("run", () => {
      it("leader executes fn exactly once", async () => {
        let callCount = 0
        const fn = async () => {
          callCount++
          return "result"
        }

        await Promise.all([
          singleflight.run("key", fn),
          singleflight.run("key", fn),
          singleflight.run("key", fn),
        ])

        expect(callCount).toBe(1)
      })

      it("leader has isLeader: true, source: leader", async () => {
        const result = await singleflight.run("key", async () => "value")

        expect(result.isLeader).toBe(true)
        expect(result.source).toBe("leader")
      })

      it("followers receive same value as leader", async () => {
        const obj = { id: 1 }
        const fn = async () => obj

        const [a, b, c] = await Promise.all([
          singleflight.run("key", fn),
          singleflight.run("key", fn),
          singleflight.run("key", fn),
        ])

        expect(a.value).toBe(obj)
        expect(b.value).toBe(obj)
        expect(c.value).toBe(obj)
      })

      it("followers receive same error as leader (shared fate)", async () => {
        const error = new Error("failure")
        const fn = async () => {
          throw error
        }

        const results = await Promise.allSettled([
          singleflight.run("key", fn),
          singleflight.run("key", fn),
          singleflight.run("key", fn),
        ])

        for (const result of results) {
          expect(result.status).toBe("rejected")
          if (result.status === "rejected") {
            expect(result.reason).toBe(error)
          }
        }
      })

      it("followers have isLeader: false, source: inflight", async () => {
        let resolve: (value: string) => void
        const fn = () =>
          new Promise<string>((r) => {
            resolve = r
          })

        const promises = [
          singleflight.run("key", fn),
          singleflight.run("key", fn),
          singleflight.run("key", fn),
        ]

        resolve!("value")
        const results = await Promise.all(promises)

        const followers = results.filter((r) => !r.isLeader)
        expect(followers.length).toBe(2)
        for (const follower of followers) {
          expect(follower.source).toBe("inflight")
        }
      })

      it("all callers get same sharedWith count", async () => {
        let resolve: (value: string) => void
        const fn = () =>
          new Promise<string>((r) => {
            resolve = r
          })

        const promises = [
          singleflight.run("key", fn),
          singleflight.run("key", fn),
          singleflight.run("key", fn),
        ]

        resolve!("value")
        const results = await Promise.all(promises)

        for (const result of results) {
          expect(result.sharedWith).toBe(2)
        }
      })
    })

    describe("tryRun", () => {
      it("returns undefined when flight in progress", async () => {
        let resolve: (value: string) => void
        const fn = () =>
          new Promise<string>((r) => {
            resolve = r
          })

        const first = singleflight.run("key", fn)
        const second = singleflight.tryRun("key", fn)

        expect(second).toBeUndefined()

        resolve!("value")
        await first
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

      it("is idempotent for nonexistent keys", () => {
        expect(() => singleflight.forget("nonexistent")).not.toThrow()
      })
    })

    describe("size", () => {
      it("reflects in-flight count", async () => {
        let resolve1: (value: string) => void
        let resolve2: (value: string) => void
        const fn1 = () =>
          new Promise<string>((r) => {
            resolve1 = r
          })
        const fn2 = () =>
          new Promise<string>((r) => {
            resolve2 = r
          })

        expect(singleflight.size).toBe(0)

        const p1 = singleflight.run("key1", fn1)
        expect(singleflight.size).toBe(1)

        const p2 = singleflight.run("key2", fn2)
        expect(singleflight.size).toBe(2)

        resolve1!("value")
        await p1
        expect(singleflight.size).toBe(1)

        resolve2!("value")
        await p2
        expect(singleflight.size).toBe(0)
      })

      it("returns to 0 after settlement", async () => {
        await singleflight.run("key", async () => "value")
        expect(singleflight.size).toBe(0)
      })
    })
  })
}
