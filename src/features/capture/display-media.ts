import { detectBrowserCapabilities, describeCapabilityGaps } from '@/lib/capabilities'

export class CaptureError extends Error {
  code: string
  userMessage: string

  constructor(code: string, userMessage: string, technical?: string) {
    super(technical ?? userMessage)
    this.name = 'CaptureError'
    this.code = code
    this.userMessage = userMessage
  }
}

export function assertCaptureSupported(): void {
  const caps = detectBrowserCapabilities()
  const gaps = describeCapabilityGaps(caps)
  if (!caps.getDisplayMedia) {
    throw new CaptureError(
      'UNSUPPORTED_DISPLAY_MEDIA',
      'Screen capture is not available in this browser. Try Chrome or Edge on desktop.',
      gaps.join(' '),
    )
  }
}

/** Prefer sharp UI capture — browsers may ignore some of these. */
function buildDisplayVideoConstraints(): MediaTrackConstraints & Record<string, unknown> {
  return {
    displaySurface: 'browser',
    width: { ideal: 1920, max: 3840 },
    height: { ideal: 1080, max: 2160 },
    frameRate: { ideal: 30, max: 60 },
  }
}

function sharpenCaptureTrack(track: MediaStreamTrack): void {
  try {
    // Prefer edge/text detail over motion smoothness (screen demos).
    if ('contentHint' in track) {
      ;(track as MediaStreamTrack & { contentHint: string }).contentHint = 'detail'
    }
  } catch {
    // ignore
  }

  // Nudge toward higher resolution when the browser allowed a soft default.
  void track
    .applyConstraints({
      width: { ideal: 1920, max: 3840 },
      height: { ideal: 1080, max: 2160 },
      frameRate: { ideal: 30, max: 60 },
    })
    .catch(() => undefined)
}

export async function requestDisplayMedia(options?: {
  preferCurrentTab?: boolean
}): Promise<MediaStream> {
  assertCaptureSupported()

  try {
    const constraints = {
      video: buildDisplayVideoConstraints(),
      audio: false,
      ...(options?.preferCurrentTab ? { preferCurrentTab: true } : {}),
    } as DisplayMediaStreamOptions

    const stream = await navigator.mediaDevices.getDisplayMedia(constraints)
    const videoTrack = stream.getVideoTracks()[0]
    if (!videoTrack) {
      stopMediaStream(stream)
      throw new CaptureError(
        'NO_VIDEO_TRACK',
        'No video track was returned from the capture source.',
      )
    }
    sharpenCaptureTrack(videoTrack)
    return stream
  } catch (error) {
    if (error instanceof CaptureError) throw error
    const name = error instanceof DOMException ? error.name : ''
    if (name === 'NotAllowedError') {
      throw new CaptureError(
        'PERMISSION_DENIED',
        'Capture was cancelled or permission was denied. Choose a tab, window, or screen to continue.',
        String(error),
      )
    }
    if (name === 'NotFoundError') {
      throw new CaptureError(
        'NO_SOURCE',
        'No capture source was selected.',
        String(error),
      )
    }
    throw new CaptureError(
      'CAPTURE_FAILED',
      'Unable to start screen capture. Please try again.',
      String(error),
    )
  }
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      // ignore
    }
  }
}

export function getVideoTrackSettings(stream: MediaStream): {
  width: number
  height: number
  frameRate: number
} {
  const track = stream.getVideoTracks()[0]
  const settings = track?.getSettings() ?? {}
  return {
    width: settings.width ?? 0,
    height: settings.height ?? 0,
    frameRate: settings.frameRate ?? 30,
  }
}

export function onTrackEnded(stream: MediaStream, callback: () => void): () => void {
  const track = stream.getVideoTracks()[0]
  if (!track) return () => undefined
  const handler = () => callback()
  track.addEventListener('ended', handler)
  return () => track.removeEventListener('ended', handler)
}
