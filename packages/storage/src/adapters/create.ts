import type { Clock } from "@subspace/clock"
import type { StoragePort } from "../ports/storage"
import { FileSystemStorage } from "./fs-storage"
import { MemoryStorage } from "./memory-storage"

export interface CreateFsStorageOptions {
  rootDir: string
}

export function createFsStorage(options: CreateFsStorageOptions): StoragePort {
  return new FileSystemStorage(options)
}

export interface CreateMemoryStorageOptions {
  clock: Clock
}

export function createMemoryStorage(options: CreateMemoryStorageOptions): StoragePort {
  return new MemoryStorage({ clock: options.clock })
}
