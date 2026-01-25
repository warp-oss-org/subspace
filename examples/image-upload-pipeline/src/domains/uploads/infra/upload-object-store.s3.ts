import type { ObjectRef, StorageBucket, StorageKey, StoragePort } from "@subspace/storage"
import type {
  PresignedUpload,
  PresignedUploadInput,
  PromoteUploadInput,
  PutFinalObjectInput,
  StagingObject,
  StagingObjectHead,
  UploadObjectRefInput,
  UploadPromotionResult,
} from "../model/upload.model"

export type UploadObjectStoreS3Options = {
  bucket: StorageBucket
  stagingPrefix: StorageKey
  finalPrefix: StorageKey
}

export type UploadObjectStoreS3Deps = {
  objectStorage: StoragePort
}

export class UploadObjectStoreS3 {
  public constructor(
    private readonly deps: UploadObjectStoreS3Deps,
    private readonly opts: UploadObjectStoreS3Options,
  ) {}

  async getPresignedUploadUrl(input: PresignedUploadInput): Promise<PresignedUpload> {
    const ref = this.createStagingRef({
      uploadId: input.uploadId,
      filename: input.filename,
    })

    const url = await this.deps.objectStorage.getPresignedUploadUrl(ref, {
      expiresInSeconds: input.expiresInSeconds,
      ...(input.contentType && { contentType: input.contentType }),
    })

    return { url, ref }
  }

  async headStagingObject(
    input: UploadObjectRefInput,
  ): Promise<StagingObjectHead | null> {
    const ref = this.createStagingRef(input)
    const metadata = await this.deps.objectStorage.head(ref)

    if (!metadata) return null

    return { ref, metadata }
  }

  async getStagingObject(input: UploadObjectRefInput): Promise<StagingObject | null> {
    const ref = this.createStagingRef(input)
    const result = await this.deps.objectStorage.get(ref)

    if (!result) return null

    return result
  }

  async promoteToFinal(input: PromoteUploadInput): Promise<UploadPromotionResult> {
    const staging = this.createStagingRef(input)
    const final = this.createFinalRef(input)

    const metadata = input.metadata

    await this.deps.objectStorage.copy(
      staging,
      final,
      ...(metadata ? [{ metadata }] : []),
    )

    await this.deps.objectStorage.delete(staging)

    return { staging, final }
  }

  async putFinalObject(input: PutFinalObjectInput): Promise<ObjectRef> {
    const ref = this.createFinalRef({
      uploadId: input.uploadId,
      filename: input.filename,
    })

    await this.deps.objectStorage.put(ref, input.data, {
      contentType: input.contentType,
    })

    return ref
  }

  private createStagingRef(input: UploadObjectRefInput): ObjectRef {
    return {
      bucket: this.opts.bucket,
      key: this.stagingKey(input),
    }
  }

  private createFinalRef(input: UploadObjectRefInput): ObjectRef {
    return {
      bucket: this.opts.bucket,
      key: this.finalKey(input),
    }
  }

  private stagingKey(input: UploadObjectRefInput): StorageKey {
    return `${this.opts.stagingPrefix}/${this.uploadObjectKey(input.uploadId, input.filename)}`
  }

  private finalKey(input: UploadObjectRefInput): StorageKey {
    return `${this.opts.finalPrefix}/${this.uploadObjectKey(input.uploadId, input.filename)}`
  }

  private uploadObjectKey(uploadId: string, filename: string): StorageKey {
    return `${uploadId}/${filename}`
  }
}
