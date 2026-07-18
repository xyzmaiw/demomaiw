/** Video-only mime types — demomaiw never captures audio. Do not request opus/aac. */

export const WEBM_MIME_CANDIDATES = [
  'video/webm;codecs=av01',
  'video/webm;codecs=av1',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const

export const MP4_MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1.4D401E',
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=avc1',
  'video/mp4',
] as const

/**
 * Capture prefers hardware-friendly codecs first — AV1 looks great but encodes slowly
 * and makes live recording feel laggy on many machines.
 */
export const CAPTURE_MIME_CANDIDATES = [
  ...MP4_MIME_CANDIDATES,
  'video/webm;codecs=vp9',
  'video/webm;codecs=av01',
  'video/webm;codecs=av1',
  'video/webm;codecs=vp8',
  'video/webm',
] as const

/**
 * Quality-first ladder (legacy / explicit WebM preference).
 * AV1/VP9 for efficiency, then H.264/MP4, then VP8.
 */
export const QUALITY_MIME_CANDIDATES = [
  ...WEBM_MIME_CANDIDATES.slice(0, 3), // av01, av1, vp9
  ...MP4_MIME_CANDIDATES,
  ...WEBM_MIME_CANDIDATES.slice(3), // vp8, webm
] as const

/**
 * Compatibility-first: MP4/H.264 when available (often hardware-accelerated + shareable),
 * then best WebM. Used when export format is Auto.
 */
export const AUTO_EXPORT_MIME_CANDIDATES = [
  ...MP4_MIME_CANDIDATES,
  ...WEBM_MIME_CANDIDATES,
] as const

export type VideoContainerPreference = 'auto' | 'mp4' | 'webm'

export type DefaultIsTypeSupported = (mime: string) => boolean

export function defaultIsTypeSupported(mime: string): boolean {
  return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)
}

export function selectSupportedMimeType(
  isTypeSupported: DefaultIsTypeSupported = defaultIsTypeSupported,
  preference: VideoContainerPreference = 'auto',
): string | null {
  const candidates =
    preference === 'mp4'
      ? MP4_MIME_CANDIDATES
      : preference === 'webm'
        ? WEBM_MIME_CANDIDATES
        : AUTO_EXPORT_MIME_CANDIDATES

  for (const mime of candidates) {
    try {
      if (isTypeSupported(mime)) return mime
    } catch {
      // ignore
    }
  }

  return null
}

/** Best capture codec — prefer fast/hardware encode to avoid laggy recordings. */
export function selectCaptureMimeType(
  isTypeSupported: DefaultIsTypeSupported = defaultIsTypeSupported,
): string | null {
  for (const mime of CAPTURE_MIME_CANDIDATES) {
    try {
      if (isTypeSupported(mime)) return mime
    } catch {
      // ignore
    }
  }
  return null
}

export function containerFromMimeType(mimeType: string): 'mp4' | 'webm' {
  return mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm'
}

export function extensionForMimeType(mimeType: string): 'mp4' | 'webm' {
  return containerFromMimeType(mimeType)
}

export function describeCodec(mimeType: string): string {
  const lower = mimeType.toLowerCase()
  if (lower.includes('av01') || lower.includes('av1')) return 'AV1'
  if (lower.includes('vp9')) return 'VP9'
  if (lower.includes('vp8')) return 'VP8'
  if (lower.includes('avc1') || lower.includes('h264') || lower.includes('avc')) return 'H.264'
  if (lower.includes('mp4')) return 'MP4'
  if (lower.includes('webm')) return 'WebM'
  return mimeType
}

export function formatLabelForMimeType(mimeType: string): string {
  const container = containerFromMimeType(mimeType).toUpperCase()
  const codec = describeCodec(mimeType)
  if (codec === container || codec === 'MP4' || codec === 'WebM') return container
  return `${container} (${codec})`
}

export type BitratePurpose = 'capture' | 'export'

/**
 * Screen UI needs higher bitrates than camera footage — text and edges fall apart
 * quickly below ~0.1 bpp at 30fps. Prefer sharp demos over small files.
 */
export function suggestVideoBitsPerSecond(
  width: number,
  height: number,
  purpose: BitratePurpose = 'capture',
): number {
  const pixels = Math.max(1, width * height)
  // ~bits per pixel per second targets (screen content)
  const bpp = purpose === 'export' ? 0.12 : 0.1
  const fps = 30
  const estimated = Math.round(pixels * bpp * fps)
  const min =
    pixels >= 1920 * 1080 ? 12_000_000 : pixels >= 1280 * 720 ? 8_000_000 : 5_000_000
  const max = purpose === 'export' ? 28_000_000 : 24_000_000
  return Math.min(max, Math.max(min, estimated))
}

export function detectBrowserCapabilities() {
  const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices
  const getDisplayMedia =
    hasMediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function'
  const mediaRecorder = typeof MediaRecorder !== 'undefined'
  const canvasCaptureStream =
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  const broadcastChannel = typeof BroadcastChannel !== 'undefined'

  const isTypeSupported = (mime: string) =>
    mediaRecorder && MediaRecorder.isTypeSupported(mime)

  const preferredMimeType = selectCaptureMimeType(isTypeSupported)
  const preferredExportMimeType = selectSupportedMimeType(isTypeSupported, 'auto')

  return {
    getDisplayMedia,
    mediaRecorder,
    canvasCaptureStream,
    broadcastChannel,
    webmAv1:
      isTypeSupported('video/webm;codecs=av01') || isTypeSupported('video/webm;codecs=av1'),
    webmVp9: isTypeSupported('video/webm;codecs=vp9'),
    webmVp8: isTypeSupported('video/webm;codecs=vp8'),
    webm: isTypeSupported('video/webm'),
    mp4Avc:
      isTypeSupported('video/mp4;codecs=avc1') ||
      isTypeSupported('video/mp4;codecs=avc1.42E01E') ||
      isTypeSupported('video/mp4'),
    mp4: isTypeSupported('video/mp4'),
    preferredMimeType,
    preferredExportMimeType,
  }
}

export type DetectedCapabilities = ReturnType<typeof detectBrowserCapabilities>

export function describeCapabilityGaps(caps: DetectedCapabilities): string[] {
  const gaps: string[] = []
  if (!caps.getDisplayMedia) {
    gaps.push('Screen capture is not supported in this browser.')
  }
  if (!caps.mediaRecorder) {
    gaps.push('MediaRecorder is not supported, so recording and video export will not work.')
  }
  if (!caps.canvasCaptureStream) {
    gaps.push('Canvas captureStream is not supported, so polished video export will not work.')
  }
  if (!caps.preferredMimeType) {
    gaps.push('No video codec is available for recording or export (need WebM or MP4).')
  }
  return gaps
}
