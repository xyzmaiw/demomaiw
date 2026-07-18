import { selectSupportedMimeType } from '@/lib/capabilities'
import { CaptureError, stopMediaStream } from '@/features/capture/display-media'

export interface RecordingResult {
  blob: Blob
  mimeType: string
  durationMs: number
}

export interface MediaRecorderController {
  start: () => void
  pause: () => void
  resume: () => void
  stop: () => Promise<RecordingResult>
  getState: () => RecordingState
}

export type RecordingState = 'inactive' | 'recording' | 'paused'

export function createMediaRecorder(stream: MediaStream): MediaRecorderController {
  const mimeType = selectSupportedMimeType()
  if (!mimeType) {
    throw new CaptureError(
      'NO_WEBM_CODEC',
      'This browser does not support WebM recording. Try Chrome or Edge.',
    )
  }

  if (typeof MediaRecorder === 'undefined') {
    throw new CaptureError(
      'NO_MEDIA_RECORDER',
      'MediaRecorder is not supported in this browser.',
    )
  }

  const chunks: BlobPart[] = []
  let startedAt = 0
  let accumulatedMs = 0
  let pauseStartedAt = 0

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  })

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data)
    }
  }

  return {
    start() {
      chunks.length = 0
      accumulatedMs = 0
      pauseStartedAt = 0
      startedAt = performance.now()
      recorder.start(250)
    },
    pause() {
      if (recorder.state === 'recording') {
        recorder.pause()
        pauseStartedAt = performance.now()
      }
    },
    resume() {
      if (recorder.state === 'paused') {
        if (pauseStartedAt) {
          accumulatedMs += performance.now() - pauseStartedAt
          pauseStartedAt = 0
        }
        recorder.resume()
      }
    },
    stop() {
      return new Promise<RecordingResult>((resolve, reject) => {
        const finish = () => {
          const endedAt = performance.now()
          let durationMs = endedAt - startedAt - accumulatedMs
          if (pauseStartedAt) {
            durationMs -= endedAt - pauseStartedAt
          }
          const blob = new Blob(chunks, { type: mimeType })
          if (blob.size === 0) {
            reject(
              new CaptureError(
                'EMPTY_RECORDING',
                'The recording did not contain any usable video data. Try recording a bit longer.',
              ),
            )
            return
          }
          if (durationMs < 200) {
            reject(
              new CaptureError(
                'RECORDING_TOO_SHORT',
                'The recording was too short. Capture at least a moment of activity.',
              ),
            )
            return
          }
          resolve({ blob, mimeType, durationMs })
        }

        if (recorder.state === 'inactive') {
          finish()
          return
        }

        recorder.addEventListener('stop', finish, { once: true })
        recorder.addEventListener(
          'error',
          () => {
            reject(
              new CaptureError(
                'RECORDER_ERROR',
                'Recording failed unexpectedly. Please try again.',
              ),
            )
          },
          { once: true },
        )
        recorder.stop()
      })
    },
    getState() {
      return recorder.state as RecordingState
    },
  }
}

export async function loadVideoMetadata(
  objectUrl: string,
): Promise<{ width: number; height: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
    }

    video.onloadedmetadata = () => {
      const width = video.videoWidth
      const height = video.videoHeight
      const durationMs = Number.isFinite(video.duration) ? video.duration * 1000 : 0
      if (!width || !height) {
        cleanup()
        reject(
          new CaptureError(
            'ZERO_DIMENSIONS',
            'The recording has invalid dimensions and cannot be opened.',
          ),
        )
        return
      }
      resolve({ width, height, durationMs })
      cleanup()
    }

    video.onerror = () => {
      cleanup()
      reject(
        new CaptureError(
          'METADATA_FAILED',
          'Could not read the recording metadata. The file may be corrupted.',
        ),
      )
    }

    video.src = objectUrl
  })
}

export function revokeObjectUrl(url: string | null | undefined): void {
  if (!url) return
  try {
    URL.revokeObjectURL(url)
  } catch {
    // ignore
  }
}

export { stopMediaStream }
