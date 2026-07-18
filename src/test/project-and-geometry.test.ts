import { describe, expect, it } from 'vitest'
import {
  calculateCenterCrop,
  calculateContentLayout,
  parseAspectRatio,
  resolveExportSize,
  resolveFitOutputSize,
  resolvePreviewAspect,
} from '@/lib/aspect'
import { selectSupportedMimeType } from '@/lib/capabilities'
import { calculateZoomTransform } from '@/features/export/renderer'
import {
  createManualClickEvent,
  createProject,
  createTextCardEvent,
  initialProjectState,
  projectReducer,
} from '@/features/editor/project-reducer'
import type { RecordedMedia } from '@/types'

function media(): RecordedMedia {
  return {
    kind: 'video',
    blob: new Blob(['x'], { type: 'video/webm' }),
    objectUrl: 'blob:test',
    mimeType: 'video/webm',
    width: 1920,
    height: 1080,
    durationMs: 5000,
    createdAt: Date.now(),
  }
}

describe('aspect and crop', () => {
  it('parses aspect ratios', () => {
    expect(parseAspectRatio('16:9')).toBeCloseTo(16 / 9)
    expect(parseAspectRatio('original')).toBeNull()
  })

  it('calculates center crop', () => {
    const crop = calculateCenterCrop({ width: 1920, height: 1080 }, '1:1')
    expect(crop.width).toBeCloseTo(1080)
    expect(crop.height).toBeCloseTo(1080)
    expect(crop.x).toBeCloseTo((1920 - 1080) / 2)
  })

  it('honors focal point within bounds', () => {
    const crop = calculateCenterCrop({ width: 1920, height: 1080 }, '1:1', 0, 0.5)
    expect(crop.x).toBe(0)
  })

  it('resolves export sizes', () => {
    const size = resolveExportSize({ width: 1920, height: 1080 }, '16:9', '1280x720')
    expect(size).toEqual({ width: 1280, height: 720 })
  })

  it('fit framing never crops a tall page into 16:9', () => {
    const source = { width: 1080, height: 1920 }
    const out = resolveFitOutputSize(source, '16:9')
    const layout = calculateContentLayout(source, out, '16:9', 'fit')
    expect(layout.sourceRect).toEqual({ x: 0, y: 0, width: 1080, height: 1920 })
    expect(layout.destRect.height).toBeCloseTo(1920)
    expect(layout.destRect.width).toBeCloseTo(1080)
    expect(resolveExportSize(source, '16:9', 'original', 'fit')).toEqual(out)
  })

  it('fill framing crops tall pages to cover 16:9', () => {
    const source = { width: 1080, height: 1920 }
    const layout = calculateContentLayout(source, { width: 1920, height: 1080 }, '16:9', 'fill')
    expect(layout.sourceRect.height).toBeLessThan(1920)
    expect(layout.sourceRect.width / layout.sourceRect.height).toBeCloseTo(16 / 9)
  })

  it('original aspect preview matches source', () => {
    const source = { width: 1440, height: 900 }
    expect(resolvePreviewAspect(source, 'original', 'fit')).toBeCloseTo(1440 / 900)
  })

  it('projects default to fit framing and full-page aspect', () => {
    const project = createProject(media())
    expect(project.aspectRatio).toBe('original')
    expect(project.frameMode).toBe('fit')
    expect(project.exportSettings.roundedFrame).toBe(false)
  })
})

describe('mime selection', () => {
  it('selects the first supported webm mime type', () => {
    const mime = selectSupportedMimeType((candidate) => candidate.includes('vp8'))
    expect(mime).toBe('video/webm;codecs=vp8')
  })

  it('returns null when nothing is supported', () => {
    expect(selectSupportedMimeType(() => false)).toBeNull()
  })
})

describe('zoom transform clamping', () => {
  it('clamps offsets so empty areas are not exposed', () => {
    const t = calculateZoomTransform(0, 0, 1.2, 100, 100)
    expect(t.offsetX).toBeLessThanOrEqual(0)
    expect(t.offsetY).toBeLessThanOrEqual(0)
    expect(t.offsetX).toBeGreaterThanOrEqual(100 - 100 * 1.2)
  })
})

describe('project reducer', () => {
  it('adds, edits, deletes, selects, and clears events', () => {
    let state = projectReducer(initialProjectState, {
      type: 'REPLACE_PROJECT',
      project: createProject(media()),
    })

    const click = createManualClickEvent(0.3, 0.4, 1200, 'Open')
    state = projectReducer(state, { type: 'ADD_EVENT', event: click })
    expect(state.project?.events).toHaveLength(1)
    expect(state.selectedEventId).toBe(click.id)

    const card = createTextCardEvent('Welcome', 0)
    state = projectReducer(state, { type: 'ADD_EVENT', event: card })
    expect(state.project?.events).toHaveLength(2)

    state = projectReducer(state, {
      type: 'UPDATE_EVENT',
      id: click.id,
      patch: { label: 'Opened' },
    })
    expect(
      state.project?.events.find((e) => e.id === click.id && e.type === 'click') &&
        (state.project?.events.find((e) => e.id === click.id) as { label: string }).label,
    ).toBe('Opened')

    state = projectReducer(state, { type: 'SELECT_EVENT', id: card.id })
    expect(state.selectedEventId).toBe(card.id)

    state = projectReducer(state, { type: 'DELETE_EVENT', id: card.id })
    expect(state.project?.events).toHaveLength(1)
    expect(state.selectedEventId).toBeNull()

    state = projectReducer(state, { type: 'CLEAR_PROJECT' })
    expect(state.project).toBeNull()
  })
})
