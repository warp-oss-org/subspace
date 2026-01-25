import { PassThrough, type Readable } from "node:stream"
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
    const base = sharp()

    input.data.pipe(base)

    const variants: ImageVariant[] = []

    variants.push({
      variant: "original",
      contentType: input.contentType,
      data: this.cloneStream(base),
    })

    variants.push({
      variant: "thumbnail",
      contentType: "image/jpeg",
      data: this.resizeStream(base, this.opts.thumbnail),
    })

    variants.push({
      variant: "preview",
      contentType: "image/jpeg",
      data: this.resizeStream(base, this.opts.preview),
    })

    return { variants }
  }

  private resizeStream(
    source: sharp.Sharp,
    size: { width: number; height: number },
  ): Readable {
    return source
      .clone()
      .resize(size.width, size.height, { fit: "inside" })
      .jpeg()
      .pipe(new PassThrough())
  }

  private cloneStream(source: sharp.Sharp): Readable {
    return source.clone().pipe(new PassThrough())
  }
}
