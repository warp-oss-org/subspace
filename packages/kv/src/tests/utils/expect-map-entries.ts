export function expectMapEntries<K, V>(
  actual: Map<K, V>,
  expected: readonly (readonly [K, V])[],
) {
  expect(Array.from(actual.entries())).toStrictEqual(expected)
}
