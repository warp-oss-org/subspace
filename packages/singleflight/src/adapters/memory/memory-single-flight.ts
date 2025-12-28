import type { FlightResult, InFlightKey, Singleflight } from "../../ports/single-flight"

interface InFlight<T> {
  promise: Promise<T>
  followerCount: number
  forgotten: boolean
}

export class MemorySingleflight<T = unknown> implements Singleflight<T> {
  private flights = new Map<string, InFlight<unknown>>()

  async run<R = T>(key: string, fn: () => Promise<R>): Promise<FlightResult<R>> {
    const existing = this.flights.get(key) as InFlight<R> | undefined

    if (existing) {
      existing.followerCount++
      const value = await existing.promise

      return {
        value,
        isLeader: false,
        sharedWith: existing.followerCount,
        source: "inflight",
      }
    }

    const flight: InFlight<R> = {
      promise: fn(),
      followerCount: 0,
      forgotten: false,
    }

    this.flights.set(key, flight as InFlight<unknown>)

    try {
      const value = await flight.promise
      return {
        value,
        isLeader: true,
        sharedWith: flight.followerCount,
        source: "leader",
      }
    } finally {
      if (!flight.forgotten) {
        this.flights.delete(key)
      }
    }
  }

  tryRun<R = T>(
    key: InFlightKey,
    fn: () => Promise<R>,
  ): Promise<FlightResult<R>> | undefined {
    if (this.flights.has(key)) return undefined

    return this.run(key, fn)
  }

  forget(key: InFlightKey): void {
    const flight = this.flights.get(key)

    if (flight) {
      flight.forgotten = true
      this.flights.delete(key)
    }
  }

  get size(): number {
    return this.flights.size
  }
}
