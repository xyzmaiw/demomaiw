import { describe, expect, it } from 'vitest'
import {
  generateEventLabel,
  humanizeTagName,
  isGenericLabel,
  isSensitiveField,
  shortenStepLabel,
  trimVisibleText,
  truncateLabel,
} from '@/lib/labels'

describe('labels', () => {
  it('prioritizes aria-label over visible text, title, and tag', () => {
    expect(
      generateEventLabel({
        ariaLabel: 'Save project',
        visibleText: 'Save',
        title: 'Persist',
        tagName: 'button',
      }),
    ).toBe('Save project')
  })

  it('falls back to visible text, then title, then meaningful tag', () => {
    expect(
      generateEventLabel({
        visibleText: 'Open reports',
        title: 'Reports',
        tagName: 'a',
      }),
    ).toBe('Open reports')

    expect(
      generateEventLabel({
        title: 'Documentation',
        tagName: 'a',
      }),
    ).toBe('Documentation')

    expect(generateEventLabel({ tagName: 'button' })).toBe('')
    expect(generateEventLabel({ tagName: 'div' })).toBe('')
  })

  it('shortens long nav dumps into a few words', () => {
    expect(shortenStepLabel('Blob Shape Smooth organic hero shapes')).toBe(
      'Blob Shape Smooth organic hero',
    )
    expect(
      generateEventLabel({
        visibleText: 'Blob Shape Smooth organic hero shapes for marketing pages',
      }),
    ).toBe('Blob Shape Smooth organic hero')
  })

  it('trims and truncates visible text', () => {
    expect(trimVisibleText('  hello   world  ')).toBe('hello world')
    const long = 'word '.repeat(40)
    expect(trimVisibleText(long).length).toBeLessThanOrEqual(48)
  })

  it('truncates labels to a sensible maximum', () => {
    const label = truncateLabel('Alpha Bravo Charlie Delta Echo Foxtrot Golf')
    expect(label.split(/\s+/).length).toBeLessThanOrEqual(6)
    expect(label.length).toBeLessThanOrEqual(36)
  })

  it('humanizes tag names and treats Element as empty', () => {
    expect(humanizeTagName('a')).toBe('Link')
    expect(humanizeTagName('BUTTON')).toBe('Button')
    expect(humanizeTagName('div')).toBe('')
    expect(isGenericLabel('Element')).toBe(true)
  })

  it('treats inputs and password-like fields as sensitive', () => {
    const input = document.createElement('input')
    expect(isSensitiveField(input)).toBe(true)

    const password = document.createElement('input')
    password.type = 'password'
    expect(isSensitiveField(password)).toBe(true)

    const button = document.createElement('button')
    expect(isSensitiveField(button)).toBe(false)
  })
})
