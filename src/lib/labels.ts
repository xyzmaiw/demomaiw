const MAX_LABEL_LENGTH = 42
const MAX_VISIBLE_TEXT_LENGTH = 56

const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
]

/** Controls we may treat as click targets (never read typed values). */
export const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'summary',
  'label',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="option"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="combobox"]',
  '[role="listbox"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="range"]',
  'input[type="color"]',
  'input[type="file"]',
  '[contenteditable="false"][tabindex]:not([tabindex="-1"])',
  '[data-demomaiw-click]',
].join(', ')

const TEXT_INPUT_TYPES = new Set([
  'text',
  'password',
  'email',
  'search',
  'tel',
  'url',
  'number',
  'date',
  'datetime-local',
  'month',
  'week',
  'time',
  'hidden',
  '',
])

export function isSensitiveField(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'textarea') return true
  if (el.getAttribute('contenteditable') === 'true') return true
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase()
    // Allow clickable control inputs; block value-bearing text fields.
    if (
      type === 'button' ||
      type === 'submit' ||
      type === 'reset' ||
      type === 'checkbox' ||
      type === 'radio' ||
      type === 'range' ||
      type === 'color' ||
      type === 'file' ||
      type === 'image'
    ) {
      // still block password-ish naming
      const meta = `${el.getAttribute('name') ?? ''} ${el.getAttribute('id') ?? ''}`
      return SENSITIVE_PATTERNS.some((p) => p.test(meta))
    }
    return TEXT_INPUT_TYPES.has(type) || SENSITIVE_PATTERNS.some((p) => p.test(type))
  }
  if (tag === 'select') return false // clickable; we never read .value
  const name = `${el.getAttribute('name') ?? ''} ${el.getAttribute('id') ?? ''} ${el.getAttribute('autocomplete') ?? ''}`
  return SENSITIVE_PATTERNS.some((p) => p.test(name))
}

/** Insert spaces into camelCase / PascalCase / glued words. */
export function normalizeLabelText(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function trimVisibleText(text: string, max = MAX_VISIBLE_TEXT_LENGTH): string {
  const cleaned = normalizeLabelText(text.replace(/\s+/g, ' '))
  if (!cleaned) return ''
  // Prefer a short first phrase when the blob looks like a card dump
  const firstLine = cleaned.split(/[|\n•·]/)[0]?.trim() ?? cleaned
  const candidate = firstLine.length <= max ? firstLine : cleaned
  if (candidate.length <= max) return candidate
  return `${candidate.slice(0, max - 1).trimEnd()}…`
}

export function humanizeTagName(tagName: string): string {
  const tag = tagName.toLowerCase().replace(/^#/, '')
  const map: Record<string, string> = {
    button: 'Button',
    a: 'Link',
    summary: 'Disclosure',
    img: 'Image',
    svg: 'Icon',
    div: 'Element',
    span: 'Element',
    li: 'List item',
    nav: 'Navigation',
    label: 'Control',
    input: 'Control',
  }
  if (map[tag]) return map[tag]
  return tag.charAt(0).toUpperCase() + tag.slice(1)
}

export function truncateLabel(label: string, max = MAX_LABEL_LENGTH): string {
  const cleaned = normalizeLabelText(label)
  if (!cleaned) return ''
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1).trimEnd()}…`
}

export function isLowQualityLabel(label: string): boolean {
  const t = label.trim()
  if (!t) return true
  if (t.length < 2) return true
  // Reject giant glued blobs without spaces that look accidental
  if (t.length > 28 && !/\s/.test(t)) return true
  if (/^[{[<]/.test(t)) return true
  return false
}

export interface LabelSource {
  ariaLabel?: string | null
  visibleText?: string | null
  title?: string | null
  tagName?: string | null
}

/**
 * Generate a step label using priority:
 * 1. aria-label
 * 2. visible trimmed text
 * 3. title attribute
 * 4. humanized element tag name
 */
export function generateEventLabel(source: LabelSource): string {
  const aria = truncateLabel(source.ariaLabel ?? '')
  if (aria && !SENSITIVE_PATTERNS.some((p) => p.test(aria)) && !isLowQualityLabel(aria)) {
    return aria
  }

  const visible = truncateLabel(trimVisibleText(source.visibleText ?? ''))
  if (
    visible &&
    !SENSITIVE_PATTERNS.some((p) => p.test(visible)) &&
    !isLowQualityLabel(visible)
  ) {
    return visible
  }

  const title = truncateLabel(source.title ?? '')
  if (title && !SENSITIVE_PATTERNS.some((p) => p.test(title)) && !isLowQualityLabel(title)) {
    return title
  }

  return humanizeTagName(source.tagName ?? 'element')
}

/**
 * Collect visible text with spaces between element boundaries
 * (avoids "WavesLayered" style glue from nested nodes).
 */
export function extractSafeVisibleText(el: Element): string {
  if (isSensitiveField(el)) return ''
  if (el.closest('textarea, [contenteditable="true"]')) return ''
  // Prefer aria-label on the element itself for extraction callers
  const aria = el.getAttribute('aria-label')
  if (aria) return trimVisibleText(aria)

  const parts: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.replace(/\s+/g, ' ').trim()
      if (t) parts.push(t)
      return
    }
    if (!(node instanceof Element)) return
    if (isSensitiveField(node)) return
    if (node.getAttribute('aria-hidden') === 'true') return
    for (const child of Array.from(node.childNodes)) walk(child)
  }
  walk(el)
  return trimVisibleText(parts.join(' '))
}

export function findInteractiveTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null

  const interactive = target.closest(INTERACTIVE_SELECTOR)
  if (interactive && !isSensitiveField(interactive)) return interactive

  // Color swatches / custom controls often lack roles — climb for a labeled ancestor.
  const labeled = target.closest('[aria-label], [title], button, a, label')
  if (labeled instanceof Element && !isSensitiveField(labeled)) return labeled

  if (isSensitiveField(target)) return null

  // Last resort: clickable-looking host (tabindex >= 0)
  const tabbable = target.closest('[tabindex]:not([tabindex="-1"])')
  if (tabbable instanceof Element && !isSensitiveField(tabbable)) return tabbable

  return target
}

export { MAX_LABEL_LENGTH, MAX_VISIBLE_TEXT_LENGTH }
