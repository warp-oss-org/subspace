describe("SharpImageProcessor", () => {
  describe("process", () => {
    it.todo("returns three variants: original, thumbnail, preview")
    it.todo("each variant has variant name, contentType, and data stream")

    describe("original variant", () => {
      it.todo("preserves the original content type")
      it.todo("data stream contains unmodified image data")
      it.todo("is byte-for-byte identical to input")
    })

    describe("thumbnail variant", () => {
      it.todo("content type is image/jpeg")
      it.todo("resizes to configured thumbnail dimensions")
      it.todo("uses 'inside' fit (preserves aspect ratio, fits within bounds)")
      it.todo("does not upscale smaller images beyond original size")
    })

    describe("preview variant", () => {
      it.todo("content type is image/jpeg")
      it.todo("resizes to configured preview dimensions")
      it.todo("uses 'inside' fit (preserves aspect ratio, fits within bounds)")
      it.todo("does not upscale smaller images beyond original size")
    })

    describe("stream behavior", () => {
      it.todo("all variant streams are independently consumable")
      it.todo("consuming one variant does not affect others")
      it.todo("variants can be consumed in any order")
      it.todo("variants can be consumed concurrently")
      it.todo("partial read of one variant does not corrupt others")
    })

    describe("input formats", () => {
      it.todo("processes JPEG input")
      it.todo("processes PNG input")
      it.todo("processes WebP input")
      it.todo("processes GIF input")
    })

    describe("transparency handling", () => {
      it.todo("original variant preserves alpha channel for PNG")
      it.todo("original variant preserves alpha channel for WebP")
      it.todo("thumbnail variant loses alpha channel (JPEG has no transparency)")
      it.todo("preview variant loses alpha channel (JPEG has no transparency)")
      it.todo("transparent regions become white/black background in JPEG variants")
    })

    describe("EXIF orientation", () => {
      it.todo("original variant preserves EXIF metadata (no auto-rotation)")
      it.todo(
        "thumbnail variant applies EXIF rotation (image appears correctly oriented)",
      )
      it.todo("preview variant applies EXIF rotation (image appears correctly oriented)")
      it.todo("all variants are consistently oriented when .rotate() is called")
    })

    describe("edge cases", () => {
      it.todo("handles very small images (smaller than thumbnail dimensions)")
      it.todo("handles very large images")
      it.todo("handles landscape orientation")
      it.todo("handles portrait orientation")
      it.todo("handles square images")
      it.todo("handles 1x1 pixel images")
    })

    describe("error handling", () => {
      it.todo("process() returns successfully even for invalid input")
      it.todo("corrupt image data emits error on variant stream when consumed")
      it.todo("non-image data emits error on variant stream when consumed")
      it.todo("input stream error propagates to variant streams")
      it.todo("error on one variant stream does not affect other variants")
    })
  })
})
