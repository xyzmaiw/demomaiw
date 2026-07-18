import type { CaptureClientMessage } from '@/types'

export const CAPTURE_PROTOCOL_VERSION = 1
export const CAPTURE_CHANNEL_NAME = 'demomaiw-capture'
export const MESSAGE_TYPES = [
  'DEMOMAIW_HANDSHAKE',
  'DEMOMAIW_READY',
  'DEMOMAIW_CLICK_EVENT',
  'DEMOMAIW_DISCONNECT',
] as const

const MAX_STRING = 200

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clampString(value: unknown, max = MAX_STRING): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, max)
}

export function isValidSessionId(sessionId: unknown): sessionId is string {
  return typeof sessionId === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(sessionId)
}

export function isNormalizedCoordinate(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1
}

export function normalizeCoordinate(clientX: number, clientY: number, viewportWidth: number, viewportHeight: number): { x: number; y: number } {
  const w = Math.max(1, viewportWidth)
  const h = Math.max(1, viewportHeight)
  return {
    x: Math.min(1, Math.max(0, clientX / w)),
    y: Math.min(1, Math.max(0, clientY / h)),
  }
}

export function validateNormalizedCoordinates(x: unknown, y: unknown): { x: number; y: number } | null {
  if (!isNormalizedCoordinate(x) || !isNormalizedCoordinate(y)) return null
  return { x, y }
}

function validateBoundingRect(value: unknown): {
  x: number
  y: number
  width: number
  height: number
} | null {
  if (!isPlainObject(value)) return null
  if (
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.width) ||
    !isFiniteNumber(value.height)
  ) {
    return null
  }
  if (value.width < 0 || value.height < 0) return null
  return {
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
  }
}

/**
 * Treat companion messages as untrusted input.
 * Ignore unknown fields; reject invalid coordinates and session ids.
 */
export function validateCaptureMessage(data: unknown): CaptureClientMessage | null {
  if (!isPlainObject(data)) return null

  const type = data.type
  if (typeof type !== 'string' || !(MESSAGE_TYPES as readonly string[]).includes(type)) {
    return null
  }

  if (data.version !== CAPTURE_PROTOCOL_VERSION) return null
  if (!isValidSessionId(data.sessionId)) return null

  if (type === 'DEMOMAIW_HANDSHAKE') {
    if (data.role !== 'client' && data.role !== 'recorder') return null
    return {
      type,
      version: CAPTURE_PROTOCOL_VERSION,
      sessionId: data.sessionId,
      role: data.role,
    }
  }

  if (type === 'DEMOMAIW_READY' || type === 'DEMOMAIW_DISCONNECT') {
    return {
      type,
      version: CAPTURE_PROTOCOL_VERSION,
      sessionId: data.sessionId,
    }
  }

  // CLICK EVENT
  const coords = validateNormalizedCoordinates(data.x, data.y)
  if (!coords) return null
  if (!isFiniteNumber(data.timestamp) || data.timestamp < 0) return null
  if (!isFiniteNumber(data.viewportWidth) || data.viewportWidth <= 0) return null
  if (!isFiniteNumber(data.viewportHeight) || data.viewportHeight <= 0) return null

  const boundingRect = validateBoundingRect(data.boundingRect)
  if (!boundingRect) return null

  return {
    type: 'DEMOMAIW_CLICK_EVENT',
    version: CAPTURE_PROTOCOL_VERSION,
    sessionId: data.sessionId,
    timestamp: data.timestamp,
    x: coords.x,
    y: coords.y,
    visibleText: clampString(data.visibleText),
    ariaLabel: clampString(data.ariaLabel),
    title: clampString(data.title),
    tagName: clampString(data.tagName, 40).toLowerCase(),
    boundingRect,
    viewportWidth: data.viewportWidth,
    viewportHeight: data.viewportHeight,
  }
}
