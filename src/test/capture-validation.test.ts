import { describe, expect, it } from 'vitest'
import {
  isNormalizedCoordinate,
  isValidSessionId,
  normalizeCoordinate,
  validateCaptureMessage,
  validateNormalizedCoordinates,
  CAPTURE_PROTOCOL_VERSION,
} from '@/lib/capture-validation'

describe('capture validation', () => {
  it('validates session ids', () => {
    expect(isValidSessionId('session_abc12345')).toBe(true)
    expect(isValidSessionId('short')).toBe(false)
    expect(isValidSessionId('bad session id!!!')).toBe(false)
  })

  it('normalizes and validates coordinates', () => {
    expect(normalizeCoordinate(100, 50, 200, 100)).toEqual({ x: 0.5, y: 0.5 })
    expect(normalizeCoordinate(-10, 500, 100, 100)).toEqual({ x: 0, y: 1 })
    expect(isNormalizedCoordinate(0.25)).toBe(true)
    expect(isNormalizedCoordinate(1.2)).toBe(false)
    expect(validateNormalizedCoordinates(0.1, 0.9)).toEqual({ x: 0.1, y: 0.9 })
    expect(validateNormalizedCoordinates(-0.1, 0.5)).toBeNull()
  })

  it('accepts a valid click message and ignores unknown fields', () => {
    const message = validateCaptureMessage({
      type: 'DEMOMAIW_CLICK_EVENT',
      version: CAPTURE_PROTOCOL_VERSION,
      sessionId: 'session_abcdefgh',
      timestamp: 1200,
      x: 0.4,
      y: 0.6,
      visibleText: 'Invite',
      ariaLabel: 'Invite teammate',
      title: '',
      tagName: 'BUTTON',
      boundingRect: { x: 10, y: 20, width: 80, height: 32 },
      viewportWidth: 1280,
      viewportHeight: 720,
      evilHtml: '<script>alert(1)</script>',
      password: 'secret',
    })

    expect(message).toMatchObject({
      type: 'DEMOMAIW_CLICK_EVENT',
      sessionId: 'session_abcdefgh',
      x: 0.4,
      y: 0.6,
      tagName: 'button',
    })
    expect(message && 'evilHtml' in message).toBe(false)
  })

  it('rejects invalid click payloads', () => {
    expect(
      validateCaptureMessage({
        type: 'DEMOMAIW_CLICK_EVENT',
        version: CAPTURE_PROTOCOL_VERSION,
        sessionId: 'session_abcdefgh',
        timestamp: 1,
        x: 1.5,
        y: 0.2,
        visibleText: '',
        ariaLabel: '',
        title: '',
        tagName: 'button',
        boundingRect: { x: 0, y: 0, width: 1, height: 1 },
        viewportWidth: 100,
        viewportHeight: 100,
      }),
    ).toBeNull()

    expect(
      validateCaptureMessage({
        type: 'DEMOMAIW_HANDSHAKE',
        version: 999,
        sessionId: 'session_abcdefgh',
        role: 'client',
      }),
    ).toBeNull()
  })
})
