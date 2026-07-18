import type {
  CardPosition,
  DemoEvent,
  ProjectAspectRatio,
  CropState,
  RenderFrameContext,
} from '@/types'
import { calculateContentLayout } from '@/lib/aspect'
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
  maxLines = 2,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
      if (lines.length >= maxLines) break
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  if (words.length && lines.length === maxLines) {
    const last = lines[maxLines - 1]!
    if (!last.endsWith('…') && words.join(' ') !== lines.join(' ')) {
      lines[maxLines - 1] = `${last.replace(/…$/, '').trimEnd()}…`
    }
  }
  return lines
}

/** Compact step chip — never a full-screen slab. */
function drawTextCard(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: CardPosition,
  canvasWidth: number,
  canvasHeight: number,
  opacity = 1,
) {
  if (!text.trim() || opacity <= 0) return

  const fontSize = Math.max(12, Math.min(18, Math.round(Math.min(canvasWidth, canvasHeight) * 0.018)))
  const paddingX = Math.round(fontSize * 0.85)
  const paddingY = Math.round(fontSize * 0.55)
  const maxCardWidth = Math.min(280, Math.round(canvasWidth * 0.42))

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.font = `500 ${fontSize}px "IBM Plex Sans", system-ui, sans-serif`

  const lines = wrapText(ctx, text.trim(), maxCardWidth - paddingX * 2, 2)
  if (lines.length === 0) {
    ctx.restore()
    return
  }

  const lineHeight = Math.round(fontSize * 1.3)
  const textWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), 24)
  const cardWidth = Math.min(maxCardWidth, Math.ceil(textWidth + paddingX * 2))
  const cardHeight = lines.length * lineHeight + paddingY * 2
  const { x, y } = calculateCardPosition(
    position,
    canvasWidth,
    canvasHeight,
    cardWidth,
    cardHeight,
    Math.max(14, Math.round(Math.min(canvasWidth, canvasHeight) * 0.025)),
  )

  ctx.fillStyle = 'rgba(10, 10, 12, 0.82)'
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.4)'
  ctx.lineWidth = 1
  roundRectPath(ctx, x, y, cardWidth, cardHeight, Math.min(10, cardHeight / 2))
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#f4f4f5'
  lines.forEach((line, i) => {
    ctx.fillText(line, x + paddingX, y + paddingY + lineHeight * (i + 0.72))
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
    frameMode = 'fit',
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

  // Minimal padding — avoid eating the page edges
  const pad = roundedFrame ? Math.max(4, Math.round(outputWidth * 0.006)) : 0
  const contentX = pad
  const contentY = pad
  const contentW = outputWidth - pad * 2
  const contentH = outputHeight - pad * 2

  if (roundedFrame) {
    roundRectPath(ctx, contentX, contentY, contentW, contentH, Math.min(10, pad * 1.2))
    ctx.clip()
  }

  const layout = calculateContentLayout(
    { width: sourceWidth, height: sourceHeight },
    { width: contentW, height: contentH },
    aspectRatio,
    frameMode,
    crop.focalX,
    crop.focalY,
  )

  const overlays = getActiveOverlays(events, timeMs, mediaKind, reducedMotion)
  const zoom = overlays.zoom

  ctx.save()
  ctx.translate(contentX, contentY)

  // Clip to content box so letterboxing stays clean
  ctx.beginPath()
  ctx.rect(0, 0, contentW, contentH)
  ctx.clip()

  const { sourceRect, destRect } = layout

  const applyZoom = (drawFn: () => void) => {
    if (!zoom.active) {
      drawFn()
      return
    }
    // Zoom around the click within the destination content rect
    const focusPxX = destRect.x + zoom.focusX * destRect.width
    const focusPxY = destRect.y + zoom.focusY * destRect.height
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
    drawFn()
    ctx.restore()
  }

  applyZoom(() => {
    source.draw(
      ctx,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      destRect.x,
      destRect.y,
      destRect.width,
      destRect.height,
    )
  })

  applyZoom(() => {
    const baseRadius = Math.max(16, Math.min(destRect.width, destRect.height) * 0.032)
    for (const { event, ring } of overlays.rings) {
      drawClickRing(
        ctx,
        destRect.x + event.x * destRect.width,
        destRect.y + event.y * destRect.height,
        ring.scale,
        ring.opacity,
        baseRadius,
      )
    }
  })

  // Text cards stay screen-fixed in the content box for readability
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
