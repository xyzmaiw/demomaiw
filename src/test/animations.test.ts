import { describe, expect, it } from 'vitest'
import {
  calculateCardPosition,
  getActiveOverlays,
  getClickRingProgress,
  getZoomProgress,
  selectActiveZoom,
  DEFAULT_RING_DURATION_MS,
  DEFAULT_ZOOM_STRENGTH,
} from '@/lib/animations'
import type { ClickEvent, TextCardEvent } from '@/types'

function click(partial: Partial<ClickEvent> & Pick<ClickEvent, 'id' | 'startTimeMs'>): ClickEvent {
  return {
    type: 'click',
    x: 0.5,
    y: 0.5,
    ringDurationMs: DEFAULT_RING_DURATION_MS,
    zoomEnabled: true,
    zoomStrength: DEFAULT_ZOOM_STRENGTH,
    zoomHoldDurationMs: 280,
    label: 'Click',
    labelPosition: 'bottom-center',
    source: 'manual',
    ...partial,
  }
}

describe('animations and overlays', () => {
  it('computes click-ring animation progress', () => {
    const event = click({ id: 'c1', startTimeMs: 1000 })
    expect(getClickRingProgress(event, 900).active).toBe(false)
    const mid = getClickRingProgress(event, 1000 + DEFAULT_RING_DURATION_MS / 2)
    expect(mid.active).toBe(true)
    expect(mid.opacity).toBeGreaterThan(0)
    expect(mid.scale).toBeGreaterThan(0.5)
    expect(getClickRingProgress(event, 1000 + DEFAULT_RING_DURATION_MS + 1).active).toBe(false)
  })

  it('supports reduced-motion ring rendering', () => {
    const event = click({ id: 'c1', startTimeMs: 0 })
    const state = getClickRingProgress(event, 100, true)
    expect(state.active).toBe(true)
    expect(state.scale).toBe(1)
  })

  it('computes zoom animation progress', () => {
    const event = click({ id: 'c1', startTimeMs: 0, zoomStrength: 1.2 })
    const peak = getZoomProgress(event, 300)
    expect(peak.active).toBe(true)
    expect(peak.scale).toBeGreaterThan(1)
    expect(getZoomProgress(event, 5000).active).toBe(false)
  })

  it('selects the latest active zoom when overlaps occur', () => {
    const events = [
      click({ id: 'a', startTimeMs: 0, x: 0.2, y: 0.2 }),
      click({ id: 'b', startTimeMs: 100, x: 0.8, y: 0.8 }),
    ]
    const zoom = selectActiveZoom(events, 200)
    expect(zoom.eventId).toBe('b')
    expect(zoom.focusX).toBe(0.8)
  })

  it('selects active overlays at a timestamp', () => {
    const card: TextCardEvent = {
      id: 't1',
      type: 'text-card',
      text: 'Hello',
      startTimeMs: 500,
      durationMs: 1000,
      position: 'top-left',
    }
    const events = [click({ id: 'c1', startTimeMs: 500, label: 'Save' }), card]
    const overlays = getActiveOverlays(events, 600, 'video')
    expect(overlays.textCards).toHaveLength(1)
    expect(overlays.rings.some((r) => r.event.id === 'c1')).toBe(true)
  })

  it('calculates card positions inside safe bounds', () => {
    const pos = calculateCardPosition('bottom-right', 800, 450, 160, 48, 24)
    expect(pos.x).toBe(800 - 160 - 24)
    expect(pos.y).toBe(450 - 48 - 24)

    const center = calculateCardPosition('top-center', 800, 450, 160, 48, 24)
    expect(center.x).toBeCloseTo((800 - 160) / 2)
    expect(center.y).toBe(24)
  })
})
