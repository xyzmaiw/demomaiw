import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  COUNTDOWN_SECONDS,
  resetTabIndicator,
  setTabIndicator,
} from '@/lib/tab-indicator'

describe('tab indicator', () => {
  beforeEach(() => {
    document.title = 'demomaiw'
    let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      link.href = './favicon.svg'
      document.head.appendChild(link)
    } else {
      link.href = './favicon.svg'
    }
  })

  afterEach(() => {
    resetTabIndicator()
  })

  it('uses a 5 second countdown constant', () => {
    expect(COUNTDOWN_SECONDS).toBe(5)
  })

  it('sets a countdown title and green-style favicon data url', () => {
    setTabIndicator({ mode: 'countdown', count: 5 })
    expect(document.title).toContain('5')
    expect(document.title).toContain('demomaiw')
    const link = document.querySelector<HTMLLinkElement>("link[rel*='icon']")
    expect(link?.getAttribute('href') ?? '').toContain('data:image/svg+xml')
    expect(decodeURIComponent(link?.getAttribute('href') ?? '')).toContain('#16a34a')
  })

  it('sets a recording title with a red favicon', () => {
    setTabIndicator({ mode: 'recording', elapsedLabel: '00:01.0' })
    expect(document.title).toContain('REC')
    expect(document.title).toContain('00:01.0')
    const link = document.querySelector<HTMLLinkElement>("link[rel*='icon']")
    expect(decodeURIComponent(link?.getAttribute('href') ?? '')).toContain('#ef4444')
  })

  it('restores the original title', () => {
    document.title = 'demomaiw'
    setTabIndicator({ mode: 'countdown', count: 3 })
    resetTabIndicator()
    expect(document.title).toBe('demomaiw')
  })
})
