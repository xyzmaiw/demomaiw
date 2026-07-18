const WEBM_MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const

export function selectSupportedMimeType(
  isTypeSupported: (mime: string) => boolean = (mime) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime),
): string | null {
  for (const mime of WEBM_MIME_CANDIDATES) {
    try {
      if (isTypeSupported(mime)) return mime
    } catch {
      // ignore
    }
  }
  return null
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

  return {
    getDisplayMedia,
    mediaRecorder,
    canvasCaptureStream,
    broadcastChannel,
    webmVp9: isTypeSupported('video/webm;codecs=vp9'),
    webmVp8: isTypeSupported('video/webm;codecs=vp8'),
    webm: isTypeSupported('video/webm'),
    preferredMimeType: selectSupportedMimeType(isTypeSupported),
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
    gaps.push('No WebM codec is available for recording or export.')
  }
  return gaps
}
