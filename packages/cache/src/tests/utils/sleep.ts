export const SLOW_TEST_TAG = "(@slow)"

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
