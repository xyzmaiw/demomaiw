const DEFAULT_TITLE = 'demomaiw'
const DEFAULT_FAVICON_HREF = './favicon.svg'

type TabIndicatorMode = 'idle' | 'countdown' | 'recording' | 'paused'

let originalTitle: string | null = null
let originalHref: string | null = null
let linkEl: HTMLLinkElement | null = null

function ensureFaviconLink(): HTMLLinkElement {
  if (linkEl && document.head.contains(linkEl)) return linkEl

  const existing =
    document.querySelector<HTMLLinkElement>("link[rel*='icon']") ??
    document.createElement('link')

  if (!existing.parentElement) {
    existing.rel = 'icon'
    existing.type = 'image/svg+xml'
    document.head.appendChild(existing)
  }

  linkEl = existing
  if (originalHref == null) {
    originalHref = existing.getAttribute('href') || DEFAULT_FAVICON_HREF
  }
  return existing
}

function rememberOriginals(): void {
  if (originalTitle == null) originalTitle = document.title || DEFAULT_TITLE
  ensureFaviconLink()
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function drawFaviconSvg(options: {
  mode: Exclude<TabIndicatorMode, 'idle'>
  count?: number
}): string {
  if (options.mode === 'countdown') {
    const n = options.count ?? 0
    const label = n > 0 ? String(n) : 'GO'
    const fontSize = label.length > 1 ? 28 : 36
    return svgDataUrl(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#16a34a"/>
  <circle cx="32" cy="32" r="30" fill="none" stroke="#bbf7d0" stroke-width="3"/>
  <text x="32" y="34" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui,Segoe UI,sans-serif" font-size="${fontSize}" font-weight="700" fill="#fff">${label}</text>
</svg>`)
  }

  if (options.mode === 'recording') {
    return svgDataUrl(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="2" y="2" width="60" height="60" rx="12" fill="#0c0c10" stroke="#3f3f46" stroke-width="2"/>
  <circle cx="32" cy="32" r="14" fill="#ef4444"/>
  <circle cx="32" cy="32" r="14" fill="none" stroke="#fecaca" stroke-width="2"/>
</svg>`)
  }

  // paused
  return svgDataUrl(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="2" y="2" width="60" height="60" rx="12" fill="#0c0c10" stroke="#3f3f46" stroke-width="2"/>
  <rect x="20" y="16" width="8" height="32" rx="2" fill="#fbbf24"/>
  <rect x="36" y="16" width="8" height="32" rx="2" fill="#fbbf24"/>
</svg>`)
}

function applyFavicon(href: string): void {
  const link = ensureFaviconLink()
  link.type = 'image/svg+xml'
  link.href = href
}

/**
 * Drive the demomaiw browser tab chrome (title + favicon) during capture.
 * Useful when Chrome focuses the shared tab — the demomaiw tab still shows status.
 */
export function setTabIndicator(options: {
  mode: TabIndicatorMode
  count?: number
  elapsedLabel?: string
}): void {
  rememberOriginals()

  if (options.mode === 'countdown') {
    const n = Math.max(0, options.count ?? 0)
    document.title = n > 0 ? `● ${n} — demomaiw` : '● Go — demomaiw'
    applyFavicon(drawFaviconSvg({ mode: 'countdown', count: n }))
    return
  }

  if (options.mode === 'recording') {
    document.title = options.elapsedLabel
      ? `● REC ${options.elapsedLabel} — demomaiw`
      : '● REC — demomaiw'
    applyFavicon(drawFaviconSvg({ mode: 'recording' }))
    return
  }

  if (options.mode === 'paused') {
    document.title = options.elapsedLabel
      ? `❚❚ PAUSED ${options.elapsedLabel} — demomaiw`
      : '❚❚ PAUSED — demomaiw'
    applyFavicon(drawFaviconSvg({ mode: 'paused' }))
    return
  }

  resetTabIndicator()
}

export function resetTabIndicator(): void {
  if (originalTitle != null) {
    document.title = originalTitle
  } else {
    document.title = DEFAULT_TITLE
  }

  const link = ensureFaviconLink()
  link.type = 'image/svg+xml'
  link.href = originalHref || DEFAULT_FAVICON_HREF
}

export const COUNTDOWN_SECONDS = 5
