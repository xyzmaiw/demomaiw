import { describe, expect, it } from 'vitest'
import {
  buildCaptureLoaderSnippet,
  buildConsolePasteSnippet,
  sanitizeForJsString,
} from '@/features/enhanced-capture/console-snippet'
import { buildCaptureScriptSnippet } from '@/features/enhanced-capture/session'

describe('console paste snippet', () => {
  it('embeds session id and recorder origin', () => {
    const snippet = buildConsolePasteSnippet({
      sessionId: 'session_abcdefgh',
      recorderOrigin: 'http://localhost:5173',
    })
    expect(snippet).toContain('session_abcdefgh')
    expect(snippet).toContain('http://localhost:5173')
    expect(snippet).toContain('DEMOMAIW_CLICK_EVENT')
    expect(snippet).toContain('BroadcastChannel')
    expect(snippet).toContain('paste into the product page DevTools console')
  })

  it('does not reference form value collection', () => {
    const snippet = buildConsolePasteSnippet({
      sessionId: 'session_abcdefgh',
      recorderOrigin: 'https://example.com',
    })
    expect(snippet).not.toMatch(/\.value\b/)
    expect(snippet).not.toContain('localStorage')
    expect(snippet).not.toContain('sessionStorage')
    expect(snippet).not.toContain('document.cookie')
    expect(snippet).toContain('isTrusted')
  })

  it('escapes dangerous characters in embedded strings', () => {
    expect(sanitizeForJsString('a"b')).toContain('\\"')
    expect(sanitizeForJsString('a<b>')).toContain('\\u003c')
  })

  it('builds loader and package snippets', () => {
    const packaged = buildCaptureScriptSnippet({
      baseUrl: 'https://example.com/demomaiw',
      sessionId: 'session_abcdefgh',
      recorderOrigin: 'https://example.com',
    })
    expect(packaged.consolePaste).toContain('session_abcdefgh')
    expect(packaged.consoleLoader).toContain('capture-client.js')
    expect(buildCaptureLoaderSnippet({
      baseUrl: 'https://example.com/demomaiw',
      sessionId: 'session_abcdefgh',
      recorderOrigin: 'https://example.com',
    })).toContain('DEMOMAIW_CAPTURE')
  })
})
