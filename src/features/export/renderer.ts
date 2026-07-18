import type {
  CardPosition,
  DemoEvent,
  ProjectAspectRatio,
  CropState,
  RenderFrameContext,
} from '@/types'
import { calculateCenterCrop } from '@/lib/aspect'
import {
  calculateCardPosition,
  getActiveOverlays,
} from '@/lib/animations'
import { clamp } from '@/lib/utils'

export interface FrameSource {
  draw: (ctx: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => void
  width: number
  height: number
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 4)
}

function drawTextCard(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: CardPosition,
  canvasWidth: number,
  canvasHeight: number,
  opacity = 1,
) {
  if (!text.trim() || opacity <= 0) return

  const paddingX = 14
  const paddingY = 10
  const maxCardWidth = Math.min(360, canvasWidth * 0.46)
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.font = `500 ${Math.max(13, Math.round(canvasWidth * 0.014))}px "IBM Plex Sans", sans-serif`

  const lines = wrapText(ctx, text, maxCardWidth - paddingX * 2)
  const lineHeight = Math.round(parseInt(ctx.font, 10) * 1.35)
  const textWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), 40)
  const cardWidth = Math.min(maxCardWidth, textWidth + paddingX * 2)
  const cardHeight = lines.length * lineHeight + paddingY * 2
  const { x, y } = calculateCardPosition(
    position,
    canvasWidth,
    canvasHeight,
    cardWidth,
    cardHeight,
    Math.max(16, canvasWidth * 0.02),
  )

  ctx.fillStyle = 'rgba(12, 12, 14, 0.88)'
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.35)'
  ctx.lineWidth = 1
  roundRectPath(ctx, x, y, cardWidth, cardHeight, 8)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#f4f4f5'
  lines.forEach((line, i) => {
    ctx.fillText(line, x + paddingX, y + paddingY + lineHeight * (i + 0.75))
  })
  ctx.restore()
}

function drawClickRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  opacity: number,
  baseRadius: number,
) {
  if (opacity <= 0) return
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.globalAlpha = opacity

  // Outer ring — dual stroke for light/dark content
  ctx.beginPath()
  ctx.arc(0, 0, baseRadius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, baseRadius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.95)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Center mark
  ctx.beginPath()
  ctx.arc(0, 0, Math.max(2, baseRadius * 0.12), 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, 0, Math.max(1.5, baseRadius * 0.08), 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(139, 92, 246, 1)'
  ctx.fill()

  ctx.restore()
}

/**
 * Clamp a zoom transform so the scaled frame does not expose empty areas.
 */
export function calculateZoomTransform(
  focusX: number,
  focusY: number,
  scale: number,
  width: number,
  height: number,
): { scale: number; offsetX: number; offsetY: number } {
  const s = Math.max(1, scale)
  if (s <= 1.001) {
    return { scale: 1, offsetX: 0, offsetY: 0 }
  }

  // Transform: translate to focus, scale, translate back — then clamp translation
  let offsetX = width / 2 - focusX * s
  let offsetY = height / 2 - focusY * s

  // Keep content covering the canvas
  const minOffsetX = width - width * s
  const minOffsetY = height - height * s
  offsetX = clamp(offsetX, minOffsetX, 0)
  offsetY = clamp(offsetY, minOffsetY, 0)

  return { scale: s, offsetX, offsetY }
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  source: FrameSource,
  frame: Omit<RenderFrameContext, 'sourceWidth' | 'sourceHeight'> & {
    sourceWidth?: number
    sourceHeight?: number
  },
): void {
  const {
    timeMs,
    outputWidth,
    outputHeight,
    aspectRatio,
    crop,
    events,
    reducedMotion,
    backgroundColor,
    roundedFrame,
    mediaKind,
  } = frame

  const sourceWidth = frame.sourceWidth ?? source.width
  const sourceHeight = frame.sourceHeight ?? source.height

  ctx.save()
  ctx.clearRect(0, 0, outputWidth, outputHeight)
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, outputWidth, outputHeight)

  const cropRect = calculateCenterCrop(
    { width: sourceWidth, height: sourceHeight },
    aspectRatio,
    crop.focalX,
    crop.focalY,
  )

  const pad = roundedFrame ? Math.max(8, Math.round(outputWidth * 0.012)) : 0
  const contentX = pad
  const contentY = pad
  const contentW = outputWidth - pad * 2
  const contentH = outputHeight - pad * 2

  if (roundedFrame) {
    roundRectPath(ctx, contentX, contentY, contentW, contentH, Math.min(16, pad * 1.5))
    ctx.clip()
  }

  const overlays = getActiveOverlays(events, timeMs, mediaKind, reducedMotion)
  const zoom = overlays.zoom

  ctx.save()
  ctx.translate(contentX, contentY)

  if (zoom.active) {
    const focusPxX = zoom.focusX * contentW
    const focusPxY = zoom.focusY * contentH
    const transform = calculateZoomTransform(
      focusPxX,
      focusPxY,
      zoom.scale,
      contentW,
      contentH,
    )
    ctx.translate(transform.offsetX, transform.offsetY)
    ctx.scale(transform.scale, transform.scale)
  }

  source.draw(
    ctx,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    contentW,
    contentH,
  )
  ctx.restore()

  // Overlays in content space (not zoomed with content for readability of rings at click pos)
  // Actually rings SHOULD be on the zoomed content at the click location.
  // Re-apply same zoom for overlay geometry in content coordinates.
  ctx.save()
  ctx.translate(contentX, contentY)

  const drawOverlaySpace = (drawFn: (scale: number) => void) => {
    if (zoom.active) {
      const focusPxX = zoom.focusX * contentW
      const focusPxY = zoom.focusY * contentH
      const transform = calculateZoomTransform(
        focusPxX,
        focusPxY,
        zoom.scale,
        contentW,
        contentH,
      )
      ctx.save()
      ctx.translate(transform.offsetX, transform.offsetY)
      ctx.scale(transform.scale, transform.scale)
      drawFn(transform.scale)
      ctx.restore()
    } else {
      drawFn(1)
    }
  }

  drawOverlaySpace(() => {
    const baseRadius = Math.max(14, Math.min(contentW, contentH) * 0.028)
    for (const { event, ring } of overlays.rings) {
      drawClickRing(
        ctx,
        event.x * contentW,
        event.y * contentH,
        ring.scale,
        ring.opacity,
        baseRadius,
      )
    }
  })

  // Text cards stay screen-fixed (not zoomed) for readability
  for (const card of overlays.textCards) {
    drawTextCard(ctx, card.text, card.position, contentW, contentH, 1)
  }
  for (const label of overlays.autoLabels) {
    drawTextCard(ctx, label.text, label.position, contentW, contentH, label.opacity)
  }

  ctx.restore()
  ctx.restore()
}

export function createVideoFrameSource(video: HTMLVideoElement): FrameSource {
  return {
    width: video.videoWidth,
    height: video.videoHeight,
    draw(ctx, sx, sy, sw, sh, dx, dy, dw, dh) {
      ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh)
    },
  }
}

export function createImageFrameSource(image: HTMLImageElement): FrameSource {
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    draw(ctx, sx, sy, sw, sh, dx, dy, dw, dh) {
      ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
    },
  }
}

export type { ProjectAspectRatio, CropState, DemoEvent, RenderFrameContext }
