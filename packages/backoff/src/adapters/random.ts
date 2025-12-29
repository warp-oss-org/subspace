import type { RandomSource } from "../ports/random-source"

export const systemRandom: RandomSource = {
  next(): number {
    return Math.random()
  },
}
