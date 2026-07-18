import { generateEventLabel } from '@/lib/labels'
import {
  DEFAULT_CARD_DURATION_MS,
  DEFAULT_RING_DURATION_MS,
  DEFAULT_ZOOM_HOLD_MS,
  DEFAULT_ZOOM_STRENGTH,
  preferLabelPositionAwayFromClick,
} from '@/lib/animations'
import type { CaptureClientClickPayload, ClickEvent } from '@/types'
import { createId } from '@/lib/utils'

export function clickEventFromEnhanced(
  payload: CaptureClientClickPayload,
  startTimeMs: number,
  options?: { showLabel?: boolean },
): ClickEvent {
  const label = generateEventLabel({
    ariaLabel: payload.ariaLabel,
    visibleText: payload.visibleText,
    title: payload.title,
    tagName: payload.tagName,
  })
  const showLabel = options?.showLabel !== false && label.length > 0

  return {
    id: createId('click'),
    type: 'click',
    x: payload.x,
    y: payload.y,
    startTimeMs,
    ringDurationMs: DEFAULT_RING_DURATION_MS,
    zoomEnabled: true,
    zoomStrength: DEFAULT_ZOOM_STRENGTH,
    zoomHoldDurationMs: DEFAULT_ZOOM_HOLD_MS,
    label,
    showLabel,
    labelPosition: preferLabelPositionAwayFromClick(payload.x, payload.y),
    source: 'enhanced',
    sourceMetadata: {
      visibleText: payload.visibleText,
      ariaLabel: payload.ariaLabel,
      title: payload.title,
      tagName: payload.tagName,
      boundingRect: payload.boundingRect,
      viewportWidth: payload.viewportWidth,
      viewportHeight: payload.viewportHeight,
    },
  }
}

export { DEFAULT_CARD_DURATION_MS }
