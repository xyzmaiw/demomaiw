import { describe, expect, it } from 'vitest'
import {
  generateEventLabel,
  humanizeTagName,
  isSensitiveField,
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

  it('falls back to visible text, then title, then humanized tag', () => {
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

    expect(generateEventLabel({ tagName: 'button' })).toBe('Button')
  })

  it('trims and truncates visible text', () => {
    expect(trimVisibleText('  hello   world  ')).toBe('hello world')
    const long = 'x'.repeat(120)
    expect(trimVisibleText(long).endsWith('…')).toBe(true)
    expect(trimVisibleText(long).length).toBeLessThanOrEqual(80)
  })

  it('truncates labels to a sensible maximum', () => {
    const label = truncateLabel('a'.repeat(100))
    expect(label.length).toBeLessThanOrEqual(48)
    expect(label.endsWith('…')).toBe(true)
  })

  it('humanizes tag names', () => {
    expect(humanizeTagName('a')).toBe('Link')
    expect(humanizeTagName('BUTTON')).toBe('Button')
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
