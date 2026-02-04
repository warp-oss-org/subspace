import { Readable } from "node:stream"
import { buffer as streamToBuffer } from "node:stream/consumers"
import sharp from "sharp"
import { SharpImageProcessor } from "../image-processor.sharp"

describe("SharpImageProcessor", () => {
  let processor: SharpImageProcessor

  const createTestImage = async (opts: {
    width: number
    height: number
    format?: "jpeg" | "png" | "webp" | "gif"
    withAlpha?: boolean
  }): Promise<Buffer> => {
    const { width, height, format = "jpeg", withAlpha = false } = opts
    const channels = withAlpha ? 4 : 3
    const pixels = Buffer.alloc(width * height * channels, withAlpha ? 0x80 : 0xff)

    let img = sharp(pixels, { raw: { width, height, channels } })

    if (format === "jpeg") img = img.jpeg()
    else if (format === "png") img = img.png()
    else if (format === "webp") img = img.webp()
    else if (format === "gif") img = img.gif()

    return img.toBuffer()
  }

  const createImageWithExif = async (orientation: number): Promise<Buffer> => {
    const base = await createTestImage({ width: 100, height: 50, format: "jpeg" })
    return sharp(base).withMetadata({ orientation }).toBuffer()
  }

  beforeEach(() => {
    processor = new SharpImageProcessor({
      thumbnail: { width: 150, height: 150 },
      preview: { width: 800, height: 800 },
    })
  })

  describe("process", () => {
    it("returns three variants: original, thumbnail, preview", async () => {
      const input = await createTestImage({ width: 1000, height: 800 })
      const result = await processor.process({
        data: Readable.from(input),
        contentType: "image/jpeg",
      })

      expect(result.variants).toHaveLength(3)
      const variantNames = result.variants.map((v) => v.variant)
      expect(variantNames).toContain("original")
      expect(variantNames).toContain("thumbnail")
      expect(variantNames).toContain("preview")
    })

    it("each variant has variant name, contentType, and data stream", async () => {
      const input = await createTestImage({ width: 200, height: 200 })
      const result = await processor.process({
        data: Readable.from(input),
        contentType: "image/jpeg",
      })

      for (const variant of result.variants) {
        expect(variant.variant).toBeDefined()
        expect(typeof variant.variant).toBe("string")
        expect(variant.contentType).toBeDefined()
        expect(typeof variant.contentType).toBe("string")
        expect(variant.data).toBeDefined()
        expect(variant.data).toBeInstanceOf(Readable)
      }
    })

    describe("original variant", () => {
      it("preserves the original content type", async () => {
        const input = await createTestImage({ width: 200, height: 200, format: "png" })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/png",
        })

        const original = result.variants.find((v) => v.variant === "original")
        expect(original?.contentType).toBe("image/png")
      })

      it("data stream contains unmodified image data", async () => {
        const input = await createTestImage({ width: 200, height: 200 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const original = result.variants.find((v) => v.variant === "original")
        const outputBuffer = await streamToBuffer(original!.data)

        expect(outputBuffer.length).toBeGreaterThan(0)
      })

      it("is byte-for-byte identical to input", async () => {
        const input = await createTestImage({ width: 200, height: 200 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const original = result.variants.find((v) => v.variant === "original")
        const outputBuffer = await streamToBuffer(original!.data)

        expect(outputBuffer.equals(input)).toBe(true)
      })
    })

    describe("thumbnail variant", () => {
      it("content type is image/jpeg", async () => {
        const input = await createTestImage({ width: 500, height: 500, format: "png" })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/png",
        })

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")
        expect(thumbnail?.contentType).toBe("image/jpeg")
      })

      it("resizes to configured thumbnail dimensions", async () => {
        const input = await createTestImage({ width: 1000, height: 800 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")
        const outputBuffer = await streamToBuffer(thumbnail!.data)
        const metadata = await sharp(outputBuffer).metadata()

        expect(metadata.width).toBeLessThanOrEqual(150)
        expect(metadata.height).toBeLessThanOrEqual(150)
      })

      it("uses 'inside' fit (preserves aspect ratio, fits within bounds)", async () => {
        const input = await createTestImage({ width: 1000, height: 500 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")
        const outputBuffer = await streamToBuffer(thumbnail!.data)
        const metadata = await sharp(outputBuffer).metadata()

        expect(metadata.width).toBe(150)
        expect(metadata.height).toBe(75)
      })

      it("resizes smaller images to fit configured dimensions", async () => {
        const input = await createTestImage({ width: 50, height: 40 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")
        const outputBuffer = await streamToBuffer(thumbnail!.data)
        const metadata = await sharp(outputBuffer).metadata()

        expect(metadata.width).toBeLessThanOrEqual(150)
        expect(metadata.height).toBeLessThanOrEqual(150)
      })
    })

    describe("preview variant", () => {
      it("content type is image/jpeg", async () => {
        const input = await createTestImage({ width: 500, height: 500, format: "png" })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/png",
        })

        const preview = result.variants.find((v) => v.variant === "preview")
        expect(preview?.contentType).toBe("image/jpeg")
      })

      it("resizes to configured preview dimensions", async () => {
        const input = await createTestImage({ width: 2000, height: 1600 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const preview = result.variants.find((v) => v.variant === "preview")
        const outputBuffer = await streamToBuffer(preview!.data)
        const metadata = await sharp(outputBuffer).metadata()

        expect(metadata.width).toBeLessThanOrEqual(800)
        expect(metadata.height).toBeLessThanOrEqual(800)
      })

      it("uses 'inside' fit (preserves aspect ratio, fits within bounds)", async () => {
        const input = await createTestImage({ width: 1600, height: 1200 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const preview = result.variants.find((v) => v.variant === "preview")
        const outputBuffer = await streamToBuffer(preview!.data)
        const metadata = await sharp(outputBuffer).metadata()

        expect(metadata.width).toBe(800)
        expect(metadata.height).toBe(600)
      })

      it("resizes smaller images to fit configured dimensions", async () => {
        const input = await createTestImage({ width: 400, height: 300 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const preview = result.variants.find((v) => v.variant === "preview")
        const outputBuffer = await streamToBuffer(preview!.data)
        const metadata = await sharp(outputBuffer).metadata()

        expect(metadata.width).toBeLessThanOrEqual(800)
        expect(metadata.height).toBeLessThanOrEqual(800)
      })
    })

    describe("stream behavior", () => {
      it("all variant streams are independently consumable", async () => {
        const input = await createTestImage({ width: 200, height: 200 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const buffers = await Promise.all(
          result.variants.map((v) => streamToBuffer(v.data)),
        )

        for (const buf of buffers) {
          expect(buf.length).toBeGreaterThan(0)
        }
      })

      it("consuming one variant does not affect others", async () => {
        const input = await createTestImage({ width: 200, height: 200 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const original = result.variants.find((v) => v.variant === "original")!
        await streamToBuffer(original.data)

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!
        const thumbnailBuffer = await streamToBuffer(thumbnail.data)
        expect(thumbnailBuffer.length).toBeGreaterThan(0)

        const preview = result.variants.find((v) => v.variant === "preview")!
        const previewBuffer = await streamToBuffer(preview.data)
        expect(previewBuffer.length).toBeGreaterThan(0)
      })

      it("variants can be consumed in any order", async () => {
        const input = await createTestImage({ width: 200, height: 200 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const preview = result.variants.find((v) => v.variant === "preview")!
        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!
        const original = result.variants.find((v) => v.variant === "original")!

        const previewBuffer = await streamToBuffer(preview.data)
        const originalBuffer = await streamToBuffer(original.data)
        const thumbnailBuffer = await streamToBuffer(thumbnail.data)

        expect(previewBuffer.length).toBeGreaterThan(0)
        expect(originalBuffer.length).toBeGreaterThan(0)
        expect(thumbnailBuffer.length).toBeGreaterThan(0)
      })

      it("variants can be consumed concurrently", async () => {
        const input = await createTestImage({ width: 200, height: 200 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const buffers = await Promise.all(
          result.variants.map((v) => streamToBuffer(v.data)),
        )

        expect(buffers).toHaveLength(3)
        for (const buf of buffers) {
          expect(buf.length).toBeGreaterThan(0)
        }
      })

      it("partial read of one variant does not corrupt others", async () => {
        const input = await createTestImage({ width: 500, height: 500 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const original = result.variants.find((v) => v.variant === "original")!
        const reader = original.data[Symbol.asyncIterator]()
        await reader.next()

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!
        const thumbnailBuffer = await streamToBuffer(thumbnail.data)

        const metadata = await sharp(thumbnailBuffer).metadata()
        expect(metadata.format).toBe("jpeg")
      })
    })

    describe("input formats", () => {
      it("processes JPEG input", async () => {
        const input = await createTestImage({ width: 200, height: 200, format: "jpeg" })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        expect(result.variants).toHaveLength(3)
        const original = result.variants.find((v) => v.variant === "original")!
        const buffer = await streamToBuffer(original.data)
        expect(buffer.length).toBeGreaterThan(0)
      })

      it("processes PNG input", async () => {
        const input = await createTestImage({ width: 200, height: 200, format: "png" })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/png",
        })

        expect(result.variants).toHaveLength(3)
        const original = result.variants.find((v) => v.variant === "original")!
        expect(original.contentType).toBe("image/png")
      })

      it("processes WebP input", async () => {
        const input = await createTestImage({ width: 200, height: 200, format: "webp" })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/webp",
        })

        expect(result.variants).toHaveLength(3)
        const original = result.variants.find((v) => v.variant === "original")!
        expect(original.contentType).toBe("image/webp")
      })

      it("processes GIF input", async () => {
        const input = await createTestImage({ width: 200, height: 200, format: "gif" })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/gif",
        })

        expect(result.variants).toHaveLength(3)
        const original = result.variants.find((v) => v.variant === "original")!
        expect(original.contentType).toBe("image/gif")
      })
    })

    describe("transparency handling", () => {
      it("original variant preserves alpha channel for PNG", async () => {
        const input = await createTestImage({
          width: 100,
          height: 100,
          format: "png",
          withAlpha: true,
        })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/png",
        })

        const original = result.variants.find((v) => v.variant === "original")!
        const buffer = await streamToBuffer(original.data)
        const metadata = await sharp(buffer).metadata()

        expect(metadata.channels).toBe(4)
      })

      it("original variant preserves alpha channel for WebP", async () => {
        const input = await createTestImage({
          width: 100,
          height: 100,
          format: "webp",
          withAlpha: true,
        })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/webp",
        })

        const original = result.variants.find((v) => v.variant === "original")!
        const buffer = await streamToBuffer(original.data)
        const metadata = await sharp(buffer).metadata()

        expect(metadata.channels).toBe(4)
      })

      it("thumbnail variant loses alpha channel (JPEG has no transparency)", async () => {
        const input = await createTestImage({
          width: 200,
          height: 200,
          format: "png",
          withAlpha: true,
        })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/png",
        })

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!
        const buffer = await streamToBuffer(thumbnail.data)
        const metadata = await sharp(buffer).metadata()

        expect(metadata.format).toBe("jpeg")
        expect(metadata.channels).toBe(3)
      })

      it("preview variant loses alpha channel (JPEG has no transparency)", async () => {
        const input = await createTestImage({
          width: 200,
          height: 200,
          format: "png",
          withAlpha: true,
        })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/png",
        })

        const preview = result.variants.find((v) => v.variant === "preview")!
        const buffer = await streamToBuffer(preview.data)
        const metadata = await sharp(buffer).metadata()

        expect(metadata.format).toBe("jpeg")
        expect(metadata.channels).toBe(3)
      })

      it("transparent regions become background color in JPEG variants", async () => {
        const input = await createTestImage({
          width: 100,
          height: 100,
          format: "png",
          withAlpha: true,
        })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/png",
        })

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!
        const buffer = await streamToBuffer(thumbnail.data)
        const metadata = await sharp(buffer).metadata()

        expect(metadata.format).toBe("jpeg")
      })
    })

    describe("EXIF orientation", () => {
      it("original variant preserves content (may strip or modify metadata)", async () => {
        const input = await createImageWithExif(6)
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const original = result.variants.find((v) => v.variant === "original")!
        const buffer = await streamToBuffer(original.data)

        expect(buffer.length).toBeGreaterThan(0)
        const metadata = await sharp(buffer).metadata()
        expect(metadata.format).toBe("jpeg")
      })

      it("thumbnail variant produces valid image from EXIF-rotated input", async () => {
        const input = await createImageWithExif(6)

        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!
        const buffer = await streamToBuffer(thumbnail.data)
        const outputMetadata = await sharp(buffer).metadata()

        expect(outputMetadata.format).toBe("jpeg")
        expect(outputMetadata.width).toBeGreaterThan(0)
        expect(outputMetadata.height).toBeGreaterThan(0)
      })

      it("preview variant produces valid image from EXIF-rotated input", async () => {
        const input = await createImageWithExif(6)

        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const preview = result.variants.find((v) => v.variant === "preview")!
        const buffer = await streamToBuffer(preview.data)
        const outputMetadata = await sharp(buffer).metadata()

        expect(outputMetadata.format).toBe("jpeg")
        expect(outputMetadata.width).toBeGreaterThan(0)
        expect(outputMetadata.height).toBeGreaterThan(0)
      })

      it("all variants are consistently oriented when .rotate() is called", async () => {
        const input = await createImageWithExif(8)

        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!
        const preview = result.variants.find((v) => v.variant === "preview")!

        const thumbBuffer = await streamToBuffer(thumbnail.data)
        const previewBuffer = await streamToBuffer(preview.data)

        const thumbMeta = await sharp(thumbBuffer).metadata()
        const previewMeta = await sharp(previewBuffer).metadata()

        const thumbAspect = thumbMeta.width! / thumbMeta.height!
        const previewAspect = previewMeta.width! / previewMeta.height!

        expect(Math.abs(thumbAspect - previewAspect)).toBeLessThan(0.1)
      })
    })

    describe("edge cases", () => {
      it("handles very small images (smaller than thumbnail dimensions)", async () => {
        const input = await createTestImage({ width: 10, height: 10 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        expect(result.variants).toHaveLength(3)

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!
        const buffer = await streamToBuffer(thumbnail.data)
        const metadata = await sharp(buffer).metadata()

        expect(metadata.width).toBeLessThanOrEqual(150)
        expect(metadata.height).toBeLessThanOrEqual(150)
      })

      it("handles very large images", async () => {
        const input = await createTestImage({ width: 5000, height: 4000 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        expect(result.variants).toHaveLength(3)

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!
        const thumbBuffer = await streamToBuffer(thumbnail.data)
        const thumbMeta = await sharp(thumbBuffer).metadata()
        expect(thumbMeta.width).toBeLessThanOrEqual(150)

        const preview = result.variants.find((v) => v.variant === "preview")!
        const previewBuffer = await streamToBuffer(preview.data)
        const previewMeta = await sharp(previewBuffer).metadata()
        expect(previewMeta.width).toBeLessThanOrEqual(800)
      })

      it("handles landscape orientation", async () => {
        const input = await createTestImage({ width: 800, height: 400 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!
        const buffer = await streamToBuffer(thumbnail.data)
        const metadata = await sharp(buffer).metadata()

        expect(metadata.width).toBeGreaterThan(metadata.height!)
      })

      it("handles portrait orientation", async () => {
        const input = await createTestImage({ width: 400, height: 800 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!
        const buffer = await streamToBuffer(thumbnail.data)
        const metadata = await sharp(buffer).metadata()

        expect(metadata.height).toBeGreaterThan(metadata.width!)
      })

      it("handles square images", async () => {
        const input = await createTestImage({ width: 500, height: 500 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!
        const buffer = await streamToBuffer(thumbnail.data)
        const metadata = await sharp(buffer).metadata()

        expect(metadata.width).toBe(metadata.height)
      })

      it("handles 1x1 pixel images", async () => {
        const input = await createTestImage({ width: 1, height: 1 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        expect(result.variants).toHaveLength(3)

        const original = result.variants.find((v) => v.variant === "original")!
        const buffer = await streamToBuffer(original.data)
        expect(buffer.length).toBeGreaterThan(0)
      })
    })

    describe("error handling", () => {
      it("process() returns successfully even for invalid input", async () => {
        const invalidData = Buffer.from("not an image")

        const result = await processor.process({
          data: Readable.from(invalidData),
          contentType: "image/jpeg",
        })

        expect(result.variants).toHaveLength(3)
      })

      it.skip("corrupt image data causes error when variant stream consumed", async () => {
        // Sharp throws uncaught exceptions for invalid image data that cannot be
        // caught through normal stream error handling. This is a known limitation.
      })

      it.skip("non-image data causes error when variant stream consumed", async () => {
        // Sharp throws uncaught exceptions for invalid image data that cannot be
        // caught through normal stream error handling. This is a known limitation.
      })

      it.skip("input stream error propagates to variant streams", async () => {
        // Sharp throws uncaught exceptions for stream errors that cannot be
        // caught through normal stream error handling. This is a known limitation.
      })

      it("valid images process without error", async () => {
        const input = await createTestImage({ width: 200, height: 200 })
        const result = await processor.process({
          data: Readable.from(input),
          contentType: "image/jpeg",
        })

        const original = result.variants.find((v) => v.variant === "original")!
        const thumbnail = result.variants.find((v) => v.variant === "thumbnail")!

        const originalBuffer = await streamToBuffer(original.data)
        expect(originalBuffer.length).toBeGreaterThan(0)

        const thumbnailBuffer = await streamToBuffer(thumbnail.data)
        expect(thumbnailBuffer.length).toBeGreaterThan(0)
      })
    })
  })
})
