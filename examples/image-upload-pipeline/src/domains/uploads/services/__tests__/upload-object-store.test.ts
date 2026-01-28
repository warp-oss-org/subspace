describe("UploadObjectStore", () => {
  describe("getPresignedUploadUrl", () => {
    it.todo("returns a presigned URL for uploading")
    it.todo("returns the staging object ref")
    it.todo("uses the configured bucket")
    it.todo("constructs key with staging prefix, uploadId, and filename")
    it.todo("passes expiresInSeconds to storage")
    it.todo("passes contentType when provided")
    it.todo("omits contentType when not provided")
  })

  describe("headStagingObject", () => {
    it.todo("returns metadata and ref when object exists")
    it.todo("returns null when object does not exist")
    it.todo("constructs key with staging prefix, uploadId, and filename")
  })

  describe("getStagingObject", () => {
    it.todo("returns object data when it exists")
    it.todo("returns null when object does not exist")
    it.todo("constructs key with staging prefix, uploadId, and filename")
  })

  describe("promoteToFinal", () => {
    it.todo("copies object from staging to final location")
    it.todo("deletes the staging object after copy")
    it.todo("returns both staging and final refs")
    it.todo("passes metadata to copy when provided")
    it.todo("omits metadata when not provided")
    it.todo("uses staging prefix for source key")
    it.todo("uses final prefix for destination key")
    it.todo("preserves uploadId and filename in final key")

    describe("failure scenarios", () => {
      it.todo("propagates copy errors")
      it.todo("does not delete staging if copy fails")
      it.todo("succeeds even if delete fails after successful copy")
      it.todo(
        "staging object may remain after successful promotion (cleanup handled elsewhere)",
      )
    })
  })

  describe("putFinalObject", () => {
    it.todo("writes object directly to final location")
    it.todo("returns the final object ref")
    it.todo("uses final prefix in key")
    it.todo("passes contentType to storage")
    it.todo("passes data to storage")
  })

  describe("key structure", () => {
    it.todo("staging key follows pattern: {stagingPrefix}/{uploadId}/{filename}")
    it.todo("final key follows pattern: {finalPrefix}/{uploadId}/{filename}")
    it.todo("handles filenames with special characters")
    it.todo("handles filenames with path separators")
  })
})
