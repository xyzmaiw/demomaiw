import { describe, expect, it } from 'vitest'
import { computeFreezeTimeline } from '@/lib/animations'
import type { FreezeEvent } from '@/types'

describe('event timing', () => {
  it('maps output time through freeze markers', () => {
    const freeze: FreezeEvent = {
      id: 'f1',
      type: 'freeze',
      startTimeMs: 1000,
      durationMs: 500,
      experimental: true,
    }
    const { outputDurationMs, mapOutputToSource } = computeFreezeTimeline([freeze], 3000)
    expect(outputDurationMs).toBe(3500)
    expect(mapOutputToSource(500)).toBe(500)
    expect(mapOutputToSource(1200)).toBe(1000) // inside freeze hold
    expect(mapOutputToSource(1600)).toBe(1100)
  })
})
