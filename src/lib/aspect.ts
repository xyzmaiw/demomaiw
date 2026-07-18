import type { ProjectAspectRatio, Rect, Size } from '@/types'
import { clamp } from '@/lib/utils'

export function parseAspectRatio(ratio: ProjectAspectRatio): number | null {
  switch (ratio) {
    case '16:9':
      return 16 / 9
    case '4:3':
      return 4 / 3
    case '1:1':
      return 1
    case 'original':
      return null
  }
}

export function getAspectLabel(ratio: ProjectAspectRatio): string {
  switch (ratio) {
    case 'original':
      return 'Original'
    case '16:9':
      return '16:9'
    case '4:3':
      return '4:3'
    case '1:1':
      return '1:1'
  }
}

/**
 * Center-crop (with optional focal point) from source into target aspect ratio.
 */
export function calculateCenterCrop(
  source: Size,
  aspectRatio: ProjectAspectRatio,
  focalX = 0.5,
  focalY = 0.5,
): Rect {
  const targetAspect = parseAspectRatio(aspectRatio)
  if (!targetAspect || source.width <= 0 || source.height <= 0) {
    return { x: 0, y: 0, width: source.width, height: source.height }
  }

  const sourceAspect = source.width / source.height
  let cropWidth: number
  let cropHeight: number

  if (sourceAspect > targetAspect) {
    cropHeight = source.height
    cropWidth = source.height * targetAspect
  } else {
    cropWidth = source.width
    cropHeight = source.width / targetAspect
  }

  const maxX = Math.max(0, source.width - cropWidth)
  const maxY = Math.max(0, source.height - cropHeight)
  const x = clamp(focalX * source.width - cropWidth / 2, 0, maxX)
  const y = clamp(focalY * source.height - cropHeight / 2, 0, maxY)

  return { x, y, width: cropWidth, height: cropHeight }
}

export function fitContain(source: Size, container: Size): Rect {
  if (source.width <= 0 || source.height <= 0 || container.width <= 0 || container.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  const scale = Math.min(container.width / source.width, container.height / source.height)
  const width = source.width * scale
  const height = source.height * scale
  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
  }
}

export function resolveExportSize(
  source: Size,
  aspectRatio: ProjectAspectRatio,
  resolution: 'original' | '1920x1080' | '1280x720' | '1080x1080',
): Size {
  const crop = calculateCenterCrop(source, aspectRatio)
  if (resolution === 'original') {
    return {
      width: Math.max(2, Math.round(crop.width)),
      height: Math.max(2, Math.round(crop.height)),
    }
  }

  const [w, h] = resolution.split('x').map(Number) as [number, number]
  const targetAspect = parseAspectRatio(aspectRatio) ?? crop.width / crop.height

  if (Math.abs(w / h - targetAspect) < 0.01) {
    return { width: w, height: h }
  }

  // Fit requested box to aspect
  if (w / h > targetAspect) {
    return { width: Math.round(h * targetAspect), height: h }
  }
  return { width: w, height: Math.round(w / targetAspect) }
}
