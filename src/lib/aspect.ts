import type { FrameMode, ProjectAspectRatio, Rect, Size } from '@/types'
import { clamp } from '@/lib/utils'

export type { FrameMode }

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
      return 'Original (full page)'
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
 * Used by fill/cover framing — can cut top/bottom or sides.
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

/**
 * Smallest output size at the requested aspect that can contain the full source
 * at 1:1 (letterbox/pillarbox). Never crops.
 */
export function resolveFitOutputSize(source: Size, aspectRatio: ProjectAspectRatio): Size {
  const target = parseAspectRatio(aspectRatio)
  if (!target || source.width <= 0 || source.height <= 0) {
    return {
      width: Math.max(2, Math.round(source.width)),
      height: Math.max(2, Math.round(source.height)),
    }
  }

  const sourceAspect = source.width / source.height
  if (sourceAspect > target) {
    // Source is wider than target — letterbox top/bottom
    return {
      width: Math.max(2, Math.round(source.width)),
      height: Math.max(2, Math.round(source.width / target)),
    }
  }
  // Source is taller — pillarbox left/right
  return {
    width: Math.max(2, Math.round(source.height * target)),
    height: Math.max(2, Math.round(source.height)),
  }
}

export interface ContentLayout {
  /** Region of the source frame to sample */
  sourceRect: Rect
  /** Where that region is drawn inside the padded content box */
  destRect: Rect
}

/**
 * Layout source content into an output content box.
 * - fit: show entire source (letterbox) — default, nothing cut off
 * - fill: cover the box (center crop) — may cut top/bottom or sides
 */
export function calculateContentLayout(
  source: Size,
  content: Size,
  aspectRatio: ProjectAspectRatio,
  frameMode: FrameMode,
  focalX = 0.5,
  focalY = 0.5,
): ContentLayout {
  if (source.width <= 0 || source.height <= 0 || content.width <= 0 || content.height <= 0) {
    return {
      sourceRect: { x: 0, y: 0, width: 0, height: 0 },
      destRect: { x: 0, y: 0, width: 0, height: 0 },
    }
  }

  if (frameMode === 'fill' && aspectRatio !== 'original') {
    const sourceRect = calculateCenterCrop(source, aspectRatio, focalX, focalY)
    return {
      sourceRect,
      destRect: { x: 0, y: 0, width: content.width, height: content.height },
    }
  }

  // fit (and original): never crop the source
  const sourceRect = { x: 0, y: 0, width: source.width, height: source.height }
  const destRect = fitContain(source, content)
  return { sourceRect, destRect }
}

export function resolveExportSize(
  source: Size,
  aspectRatio: ProjectAspectRatio,
  resolution: 'original' | '1920x1080' | '1280x720' | '1080x1080',
  frameMode: FrameMode = 'fit',
): Size {
  if (resolution === 'original') {
    if (frameMode === 'fit') {
      return resolveFitOutputSize(source, aspectRatio)
    }
    const crop = calculateCenterCrop(source, aspectRatio)
    return {
      width: Math.max(2, Math.round(crop.width)),
      height: Math.max(2, Math.round(crop.height)),
    }
  }

  const [w, h] = resolution.split('x').map(Number) as [number, number]
  const targetAspect =
    parseAspectRatio(aspectRatio) ??
    (frameMode === 'fit'
      ? resolveFitOutputSize(source, aspectRatio).width /
        resolveFitOutputSize(source, aspectRatio).height
      : calculateCenterCrop(source, aspectRatio).width /
        calculateCenterCrop(source, aspectRatio).height)

  if (Math.abs(w / h - targetAspect) < 0.01) {
    return { width: w, height: h }
  }

  if (w / h > targetAspect) {
    return { width: Math.round(h * targetAspect), height: h }
  }
  return { width: w, height: Math.round(w / targetAspect) }
}

/** Preview/output box aspect for a project framing choice */
export function resolvePreviewAspect(
  source: Size,
  aspectRatio: ProjectAspectRatio,
  frameMode: FrameMode,
): number {
  if (aspectRatio === 'original' || !parseAspectRatio(aspectRatio)) {
    return source.width / Math.max(1, source.height)
  }
  if (frameMode === 'fit') {
    const size = resolveFitOutputSize(source, aspectRatio)
    return size.width / size.height
  }
  return parseAspectRatio(aspectRatio) ?? source.width / source.height
}
