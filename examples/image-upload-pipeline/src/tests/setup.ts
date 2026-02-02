import { createTestHarness, type TestHarness } from "./test-harness"

export function withHarness(
  fn: (harness: TestHarness) => Promise<void>,
): () => Promise<void> {
  return async () => {
    const harness = await createTestHarness()
    await harness.lifecycle.start()

    try {
      await fn(harness)
    } finally {
      await harness.lifecycle.stop()
    }
  }
}
