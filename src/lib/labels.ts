const MAX_LABEL_LENGTH = 48
const MAX_VISIBLE_TEXT_LENGTH = 80

const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
]

const INTERACTIVE_SELECTOR =
  'button, a, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="option"], summary, input[type="button"], input[type="submit"], input[type="reset"]'

export function isSensitiveField(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.getAttribute('contenteditable') === 'true') return true
  const type = el.getAttribute('type')?.toLowerCase()
  if (type === 'password' || type === 'hidden') return true
  const name = `${el.getAttribute('name') ?? ''} ${el.getAttribute('id') ?? ''} ${el.getAttribute('autocomplete') ?? ''}`
  return SENSITIVE_PATTERNS.some((p) => p.test(name))
}

export function trimVisibleText(text: string, max = MAX_VISIBLE_TEXT_LENGTH): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1).trimEnd()}…`
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
  }
  if (map[tag]) return map[tag]
  return tag.charAt(0).toUpperCase() + tag.slice(1)
}

export function truncateLabel(label: string, max = MAX_LABEL_LENGTH): string {
  const cleaned = label.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1).trimEnd()}…`
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
  if (aria && !SENSITIVE_PATTERNS.some((p) => p.test(aria))) return aria

  const visible = truncateLabel(trimVisibleText(source.visibleText ?? ''))
  if (visible && !SENSITIVE_PATTERNS.some((p) => p.test(visible))) return visible

  const title = truncateLabel(source.title ?? '')
  if (title && !SENSITIVE_PATTERNS.some((p) => p.test(title))) return title

  return humanizeTagName(source.tagName ?? 'element')
}

export function extractSafeVisibleText(el: Element): string {
  if (isSensitiveField(el)) return ''
  if (el.closest('input, textarea, [contenteditable="true"]')) return ''
  const text = el.textContent ?? ''
  return trimVisibleText(text)
}

export function findInteractiveTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null
  const interactive = target.closest(INTERACTIVE_SELECTOR)
  if (interactive && !isSensitiveField(interactive)) return interactive
  if (isSensitiveField(target)) return null
  return target
}

export { MAX_LABEL_LENGTH, MAX_VISIBLE_TEXT_LENGTH, INTERACTIVE_SELECTOR }
