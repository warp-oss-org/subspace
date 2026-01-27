import type { Readable } from "node:stream"
import type { Seconds } from "@subspace/clock"
import { type Brand, prefixed, uuidV4, withGenerator } from "@subspace/id"
import type { ObjectRef, StorageObject, StorageObjectMetadata } from "@subspace/storage"
import { z } from "zod/mini"

const PREFIX = "upload_"
const EXPECTED_LENGTH = PREFIX.length + 36

const uploadIdSchema = z.pipe(
  z.string().check(z.refine((v) => v.startsWith(PREFIX) && v.length === EXPECTED_LENGTH)),
  z.transform((v) => v as UploadId),
)

export type UploadId = Brand<string, "UploadId">
export const UploadId = withGenerator(
  {
    kind: "UploadId",
    parse: (s: string) => uploadIdSchema.parse(s),
    is: (value: unknown): value is UploadId => uploadIdSchema.safeParse(value).success,
  },
  {
    generate: () => prefixed<UploadId>(PREFIX, uuidV4).generate(),
  },
)

export type StorageLocation = {
  bucket: string
  key: string
}

export type UploadStatus =
  | "awaiting_upload"
  | "queued"
  | "processing"
  | "finalized"
  | "failed"

export type UploadBase = {
  id: UploadId
  staging: StorageLocation

  filename?: string
  contentType?: string
  expectedSizeBytes?: number

  createdAt: Date
  updatedAt: Date
}

export type UploadWithFilename = Omit<UploadBase, "filename"> & {
  filename: string
}

export type AwaitingUpload = UploadBase & {
  status: "awaiting_upload"
}

export type UploadQueued = UploadBase & {
  status: "queued"
  queuedAt: Date
}

export type UploadProcessing = UploadWithFilename & {
  status: "processing"
  queuedAt: Date
}

export type UploadFinalized = UploadBase & {
  status: "finalized"
  queuedAt: Date
  finalizedAt: Date
  final: StorageLocation
  actualSize: number
}

export type UploadFailed = UploadBase & {
  status: "failed"
  queuedAt?: Date
  failureReason: string
}

export type UploadRecord =
  | AwaitingUpload
  | UploadQueued
  | UploadProcessing
  | UploadFinalized
  | UploadFailed

export type UploadObjectRefInput = {
  uploadId: UploadId
  filename: string
}

export type StagingObjectHead = {
  ref: ObjectRef
  metadata: StorageObjectMetadata
}

export type CreateUploadInput = {
  id: UploadId
  staging: StorageLocation
  filename: string
  contentType?: string
  expectedSizeBytes?: number
}

export type CreateUploadResult = {
  kind: "created"
  uploadId: UploadId
  presigned: PresignedUpload
}

export type CompleteUploadQueued = {
  kind: "queued"
  uploadId: UploadId
}

export type CompleteUploadAlreadyQueued = {
  kind: "already_queued"
  uploadId: UploadId
}

export type CompleteUploadFinalized = {
  kind: "finalized"
  uploadId: UploadId
}

export type CompleteUploadFailed = {
  kind: "failed"
  reason: string
}

export type CompleteUploadNotFound = {
  kind: "not_found"
}

export type CompleteUploadResult =
  | CompleteUploadQueued
  | CompleteUploadAlreadyQueued
  | CompleteUploadFinalized
  | CompleteUploadFailed
  | CompleteUploadNotFound

export type PresignedUploadInput = UploadObjectRefInput & {
  contentType?: string
  expiresInSeconds: Seconds
}

export type PromoteUploadInput = UploadObjectRefInput & {
  metadata?: Record<string, string>
}

export type UploadPromotionResult = {
  staging: ObjectRef
  final: ObjectRef
}

type UploadTransitionInput = {
  uploadId: UploadId
}

export type MarkQueuedInput = UploadTransitionInput & {
  filename?: string
  contentType?: string
  expectedSize?: number
}

export type MarkProcessingInput = UploadTransitionInput & {
  filename: string
}

export type PromotedVariant = {
  variant: string
  bucket: string
  key: string
}

export type PutFinalObjectInput = {
  uploadId: UploadId
  filename: string
  data: Readable
  contentType: string
}

export type MarkFinalizedInput = UploadTransitionInput & {
  final: StorageLocation
  actualSize: number
  variants: PromotedVariant[]
}

export type MarkFailedInput = UploadTransitionInput & {
  reason: string
}

export type UploadStoreWritten = {
  readonly kind: "written"
}

export type UploadStoreAlready = {
  readonly kind: "already"
}

export type UploadStoreConflict = {
  readonly kind: "conflict"
}

export type UploadStoreNotFound = {
  readonly kind: "not_found"
}

export type UploadStoreInvalidTransition = {
  readonly kind: "invalid_transition"
  readonly expected: readonly string[]
  readonly actual: string
}

export type UploadStoreWriteResult =
  | UploadStoreWritten
  | UploadStoreAlready
  | UploadStoreConflict
  | UploadStoreNotFound
  | UploadStoreInvalidTransition

export type PresignedUpload = {
  url: URL
  ref: ObjectRef
}

export type StagingObject = StorageObject
