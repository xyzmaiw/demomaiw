import type { CardPosition, ClickEvent, DemoEvent, TextCardEvent } from '@/types'
import { isGenericLabel } from '@/lib/labels'
import { easeInOutCubic, easeOutCubic } from '@/lib/easing'
import { clamp } from '@/lib/utils'

export const DEFAULT_RING_DURATION_MS = 1200
export const DEFAULT_ZOOM_STRENGTH = 1.12
export const DEFAULT_ZOOM_HOLD_MS = 420
export const DEFAULT_ZOOM_IN_MS = 260
export const DEFAULT_ZOOM_OUT_MS = 380
export const DEFAULT_CARD_DURATION_MS = 2200
export const DEFAULT_CARD_DELAY_MS = 120

export interface RingAnimationState {
  progress: number
  opacity: number
  scale: number
  active: boolean
}

export interface ZoomAnimationState {
  scale: number
  focusX: number
  focusY: number
  active: boolean
  eventId: string | null
}

export function getClickRingProgress(
  event: ClickEvent,
  timeMs: number,
  reducedMotion = false,
): RingAnimationState {
  const elapsed = timeMs - event.startTimeMs
  if (elapsed < 0 || elapsed > event.ringDurationMs) {
    return { progress: 0, opacity: 0, scale: 1, active: false }
  }

  const progress = clamp(elapsed / event.ringDurationMs, 0, 1)

  if (reducedMotion) {
    return {
      progress,
      opacity: 0.7 * (1 - progress * 0.55),
      scale: 1,
      active: true,
    }
  }

  // Hold solid longer, then ease out — rings should read clearly on screen.
  const holdEnd = 0.42
  const fadeProgress = progress <= holdEnd ? 0 : (progress - holdEnd) / (1 - holdEnd)
  const easedFade = easeOutCubic(fadeProgress)
  const grow = easeOutCubic(Math.min(1, progress / 0.55))

  return {
    progress,
    opacity: 1 - easedFade * 0.95,
    scale: 0.72 + grow * 0.55,
    active: true,
  }
}

export function getZoomProgress(
  event: ClickEvent,
  timeMs: number,
  reducedMotion = false,
): ZoomAnimationState {
  if (!event.zoomEnabled) {
    return { scale: 1, focusX: event.x, focusY: event.y, active: false, eventId: null }
  }

  const zoomIn = DEFAULT_ZOOM_IN_MS
  const hold = event.zoomHoldDurationMs
  const zoomOut = DEFAULT_ZOOM_OUT_MS
  const total = zoomIn + hold + zoomOut
  const elapsed = timeMs - event.startTimeMs

  if (elapsed < 0 || elapsed > total) {
    return { scale: 1, focusX: event.x, focusY: event.y, active: false, eventId: null }
  }

  if (reducedMotion) {
    return {
      scale: 1 + (event.zoomStrength - 1) * 0.35,
      focusX: event.x,
      focusY: event.y,
      active: true,
      eventId: event.id,
    }
  }

  let scale = 1
  if (elapsed <= zoomIn) {
    const t = easeInOutCubic(elapsed / zoomIn)
    scale = 1 + (event.zoomStrength - 1) * t
  } else if (elapsed <= zoomIn + hold) {
    scale = event.zoomStrength
  } else {
    const t = easeInOutCubic((elapsed - zoomIn - hold) / zoomOut)
    scale = event.zoomStrength + (1 - event.zoomStrength) * t
  }

  return {
    scale,
    focusX: event.x,
    focusY: event.y,
    active: scale > 1.001,
    eventId: event.id,
  }
}

export function isTextCardActive(event: TextCardEvent, timeMs: number, mediaKind: 'video' | 'screenshot'): boolean {
  if (mediaKind === 'screenshot') return true
  return timeMs >= event.startTimeMs && timeMs <= event.startTimeMs + event.durationMs
}

export function getActiveClickEvents(events: DemoEvent[], timeMs: number): ClickEvent[] {
  return events.filter((e): e is ClickEvent => {
    if (e.type !== 'click') return false
    const zoomTotal = DEFAULT_ZOOM_IN_MS + e.zoomHoldDurationMs + DEFAULT_ZOOM_OUT_MS
    const windowMs = Math.max(e.ringDurationMs, zoomTotal, DEFAULT_CARD_DURATION_MS + DEFAULT_CARD_DELAY_MS)
    return timeMs >= e.startTimeMs && timeMs <= e.startTimeMs + windowMs
  })
}

/**
 * Deterministic zoom selection: prefer the latest-started active zoom event.
 */
export function selectActiveZoom(
  events: DemoEvent[],
  timeMs: number,
  reducedMotion = false,
): ZoomAnimationState {
  const clicks = events
    .filter((e): e is ClickEvent => e.type === 'click' && e.zoomEnabled)
    .map((e) => ({ event: e, state: getZoomProgress(e, timeMs, reducedMotion) }))
    .filter((item) => item.state.active)
    .sort((a, b) => b.event.startTimeMs - a.event.startTimeMs)

  if (clicks.length === 0) {
    return { scale: 1, focusX: 0.5, focusY: 0.5, active: false, eventId: null }
  }
  return clicks[0].state
}

export function getActiveOverlays(
  events: DemoEvent[],
  timeMs: number,
  mediaKind: 'video' | 'screenshot',
  reducedMotion = false,
) {
  const clicks = events.filter((e): e is ClickEvent => e.type === 'click')
  const cards = events.filter((e): e is TextCardEvent => e.type === 'text-card')

  const activeRings = clicks
    .map((event) => ({ event, ring: getClickRingProgress(event, timeMs, reducedMotion) }))
    .filter((item) => item.ring.active || mediaKind === 'screenshot')

  // For screenshots, show all click rings as static markers
  const screenshotRings =
    mediaKind === 'screenshot'
      ? clicks.map((event) => ({
          event,
          ring: { progress: 0.35, opacity: 0.85, scale: 1, active: true },
        }))
      : activeRings

  const activeCards = cards.filter((event) => isTextCardActive(event, timeMs, mediaKind))

  // Auto step labels from clicks (compact chips — skip empty/generic/"Element")
  const labelVisible = (c: ClickEvent) =>
    c.showLabel !== false &&
    c.label.trim().length > 0 &&
    !isGenericLabel(c.label)

  const autoLabels =
    mediaKind === 'screenshot'
      ? clicks.filter(labelVisible).map((c) => ({
          id: `${c.id}-label`,
          text: c.label,
          position: c.labelPosition,
          opacity: 1,
        }))
      : clicks
          .filter(labelVisible)
          .map((c) => {
            const start = c.startTimeMs + DEFAULT_CARD_DELAY_MS
            const end = start + DEFAULT_CARD_DURATION_MS
            if (timeMs < start || timeMs > end) return null
            const local = (timeMs - start) / DEFAULT_CARD_DURATION_MS
            const opacity = local < 0.12 ? local / 0.12 : local > 0.85 ? (1 - local) / 0.15 : 1
            return {
              id: `${c.id}-label`,
              text: c.label,
              position: c.labelPosition,
              opacity: clamp(opacity, 0, 1),
            }
          })
          .filter((v): v is NonNullable<typeof v> => v !== null)

  return {
    rings: mediaKind === 'screenshot' ? screenshotRings : activeRings,
    zoom: selectActiveZoom(events, timeMs, reducedMotion),
    textCards: activeCards,
    autoLabels,
  }
}

export function calculateCardPosition(
  position: CardPosition,
  canvasWidth: number,
  canvasHeight: number,
  cardWidth: number,
  cardHeight: number,
  padding = 24,
): { x: number; y: number } {
  const maxX = Math.max(padding, canvasWidth - cardWidth - padding)
  const maxY = Math.max(padding, canvasHeight - cardHeight - padding)

  switch (position) {
    case 'top-left':
      return { x: padding, y: padding }
    case 'top-center':
      return { x: clamp((canvasWidth - cardWidth) / 2, padding, maxX), y: padding }
    case 'top-right':
      return { x: maxX, y: padding }
    case 'bottom-left':
      return { x: padding, y: maxY }
    case 'bottom-center':
      return { x: clamp((canvasWidth - cardWidth) / 2, padding, maxX), y: maxY }
    case 'bottom-right':
      return { x: maxX, y: maxY }
  }
}

/**
 * Prefer a card corner away from the click when practical.
 */
export function preferLabelPositionAwayFromClick(x: number, y: number): CardPosition {
  const vertical = y < 0.45 ? 'bottom' : 'top'
  const horizontal = x < 0.33 ? 'right' : x > 0.66 ? 'left' : 'center'
  return `${vertical}-${horizontal}` as CardPosition
}

export function getTimelineMarkerPercent(timeMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0
  return clamp((timeMs / durationMs) * 100, 0, 100)
}

export function computeFreezeTimeline(
  events: DemoEvent[],
  sourceDurationMs: number,
): { outputDurationMs: number; mapOutputToSource: (outputMs: number) => number } {
  const freezes = events
    .filter((e) => e.type === 'freeze')
    .sort((a, b) => a.startTimeMs - b.startTimeMs)

  const totalFreeze = freezes.reduce((sum, f) => sum + f.durationMs, 0)
  const outputDurationMs = sourceDurationMs + totalFreeze

  const mapOutputToSource = (outputMs: number): number => {
    let remaining = outputMs
    let sourceCursor = 0
    for (const freeze of freezes) {
      const gap = freeze.startTimeMs - sourceCursor
      if (remaining <= gap) return sourceCursor + remaining
      remaining -= gap
      sourceCursor = freeze.startTimeMs
      if (remaining <= freeze.durationMs) return freeze.startTimeMs
      remaining -= freeze.durationMs
    }
    return Math.min(sourceDurationMs, sourceCursor + remaining)
  }

  return { outputDurationMs, mapOutputToSource }
}
