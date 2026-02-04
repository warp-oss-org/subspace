import { PassThrough, Readable, type Readable as ReadableType } from "node:stream"
import { buffer as streamToBuffer } from "node:stream/consumers"
import sharp from "sharp"
import type {
  ImageProcessor,
  ImageProcessorInput,
  ImageVariant,
} from "../model/image.processing.model"

export type SharpImageProcessorOptions = {
  thumbnail: {
    width: number
    height: number
  }
  preview: {
    width: number
    height: number
  }
}

export class SharpImageProcessor implements ImageProcessor {
  constructor(private readonly opts: SharpImageProcessorOptions) {}

  async process(input: ImageProcessorInput): Promise<{ variants: ImageVariant[] }> {
    const bytes = await streamToBuffer(input.data)

    const isValidImage = await this.isValidImage(bytes)

    if (!isValidImage) {
      return {
        variants: [
          {
            variant: "original",
            contentType: input.contentType,
            data: Readable.from(bytes),
          },
          { variant: "thumbnail", contentType: "image/jpeg", data: Readable.from(bytes) },
          { variant: "preview", contentType: "image/jpeg", data: Readable.from(bytes) },
        ],
      }
    }

    return {
      variants: [
        {
          variant: "original",
          contentType: input.contentType,
          data: Readable.from(bytes),
        },
        {
          variant: "thumbnail",
          contentType: "image/jpeg",
          data: this.resizeBufferToJpegStream(bytes, this.opts.thumbnail),
        },
        {
          variant: "preview",
          contentType: "image/jpeg",
          data: this.resizeBufferToJpegStream(bytes, this.opts.preview),
        },
      ],
    }
  }

  private resizeBufferToJpegStream(
    bytes: Buffer,
    size: { width: number; height: number },
  ): ReadableType {
    const out = new PassThrough()

    // Give callers a chance to attach listeners before the transform starts.
    queueMicrotask(() => {
      const s = sharp(bytes)
        .rotate()
        .resize(size.width, size.height, { fit: "inside" })
        .jpeg()

      s.on("error", (err) => out.destroy(err))
      s.pipe(out)
    })

    return out
  }

  private async isValidImage(bytes: Buffer): Promise<boolean> {
    try {
      await sharp(bytes).metadata()
      return true
    } catch {
      return false
    }
  }
}
