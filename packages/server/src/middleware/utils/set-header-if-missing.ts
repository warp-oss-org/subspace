export function setHeaderIfMissing(
  headers: Headers,
  key: string,
  value: string | null,
): void {
  if (value == null) return
  if (headers.has(key)) return

  headers.set(key, value)
}
