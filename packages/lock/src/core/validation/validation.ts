export function assertFiniteMs(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number, got: ${value}`)
  }
}

export function assertNonNegativeMs(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be non-negative, got: ${value}`)
  }
}

export function assertValidTimeMs(value: number, name: string): void {
  assertFiniteMs(value, name)
  assertNonNegativeMs(value, name)
}
