import type { Readable } from "node:stream"

export type ImageVariantName = "original" | "thumbnail" | "preview"

export type ImageVariant = {
  variant: string
  data: Readable
  contentType: string
}

export type ProcessedImage = {
  variants: ImageVariant[]
}

export type ImageProcessorInput = {
  data: Readable
  contentType: string
}

export interface ImageProcessor {
  process(input: ImageProcessorInput): Promise<ProcessedImage>
}
