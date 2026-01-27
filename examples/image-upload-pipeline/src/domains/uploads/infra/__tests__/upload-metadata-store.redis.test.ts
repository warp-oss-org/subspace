describe("UploadMetadataStoreRedis", () => {
  describe("get", () => {
    it.todo("returns null when upload does not exist")
    it.todo("returns the upload when it exists")
  })

  describe("create", () => {
    it.todo("persists a new upload that can be retrieved")
    it.todo("returns 'written' on success")
    it.todo("returns 'already' when upload with same id exists")
    it.todo("does not overwrite existing upload")
  })

  describe("markQueued", () => {
    describe("valid transitions", () => {
      it.todo("transitions from awaiting_upload to queued")
      it.todo("sets queuedAt timestamp")
      it.todo("sets updatedAt timestamp")
      it.todo("updates filename when provided")
      it.todo("updates contentType when provided")
      it.todo("updates expectedSize when provided")
      it.todo("preserves existing fields not being updated")
    })

    describe("idempotency", () => {
      it.todo("returns 'already' when status is already queued")
    })

    describe("invalid transitions", () => {
      it.todo("returns 'not_found' when upload does not exist")
      it.todo("returns 'invalid_transition' from processing")
      it.todo("returns 'invalid_transition' from finalized")
      it.todo("returns 'invalid_transition' from failed")
    })

    describe("concurrency", () => {
      it.todo("returns 'conflict' when version has changed")
    })
  })

  describe("markProcessing", () => {
    describe("valid transitions", () => {
      it.todo("transitions from queued to processing")
      it.todo("sets filename")
      it.todo("sets updatedAt timestamp")
      it.todo("preserves existing fields")
    })

    describe("idempotency", () => {
      it.todo("returns 'already' when status is processing with same filename")
      it.todo("returns 'invalid_transition' when processing with different filename")
    })

    describe("invalid transitions", () => {
      it.todo("returns 'not_found' when upload does not exist")
      it.todo("returns 'invalid_transition' from awaiting_upload")
      it.todo("returns 'invalid_transition' from finalized")
      it.todo("returns 'invalid_transition' from failed")
    })

    describe("concurrency", () => {
      it.todo("returns 'conflict' when version has changed")
    })
  })

  describe("markFinalized", () => {
    describe("valid transitions", () => {
      it.todo("transitions from processing to finalized")
      it.todo("sets final location (bucket and key)")
      it.todo("sets actualSize")
      it.todo("sets finalizedAt timestamp")
      it.todo("sets updatedAt timestamp")
      it.todo("preserves existing fields")
    })

    describe("idempotency", () => {
      it.todo("returns 'already' when finalized with same location and size")
      it.todo("returns 'invalid_transition' when finalized with different location")
      it.todo("returns 'invalid_transition' when finalized with different size")
    })

    describe("invalid transitions", () => {
      it.todo("returns 'not_found' when upload does not exist")
      it.todo("returns 'invalid_transition' from awaiting_upload")
      it.todo("returns 'invalid_transition' from queued")
      it.todo("returns 'invalid_transition' from failed")
    })

    describe("concurrency", () => {
      it.todo("returns 'conflict' when version has changed")
    })
  })

  describe("markFailed", () => {
    describe("valid transitions", () => {
      it.todo("transitions from queued to failed")
      it.todo("transitions from processing to failed")
      it.todo("sets failureReason")
      it.todo("sets updatedAt timestamp")
      it.todo("preserves existing fields")
    })

    describe("idempotency", () => {
      it.todo("returns 'already' when failed with same reason")
      it.todo("returns 'invalid_transition' when failed with different reason")
    })

    describe("invalid transitions", () => {
      it.todo("returns 'not_found' when upload does not exist")
      it.todo("returns 'invalid_transition' from awaiting_upload")
      it.todo("returns 'invalid_transition' from finalized")
    })

    describe("concurrency", () => {
      it.todo("returns 'conflict' when version has changed")
    })
  })

  describe("state machine", () => {
    it.todo("awaiting_upload -> queued -> processing -> finalized is valid path")
    it.todo("awaiting_upload -> queued -> processing -> failed is valid path")
    it.todo("awaiting_upload -> queued -> failed is valid path (early failure)")
    it.todo("cannot transition backwards in the state machine")
    it.todo("finalized is a terminal state")
    it.todo("failed is a terminal state")
  })
})
