export interface Serializer<T> {
  serialize(value: T): Uint8Array
  deserialize(bytes: Uint8Array): T
}
