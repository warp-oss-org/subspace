import type { AttemptContext } from "./attempt-context"

/** Function to retry */
export type RetryFn<T> = (ctx: AttemptContext) => Promise<T>
