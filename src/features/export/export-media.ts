import { resolveExportSize } from '@/lib/aspect'
import { computeFreezeTimeline } from '@/lib/animations'
import { selectSupportedMimeType } from '@/lib/capabilities'
import {
  createImageFrameSource,
  createVideoFrameSource,
  renderFrame,
} from '@/features/export/renderer'
import { CaptureError } from '@/features/capture/display-media'
import type { CaptureProject } from '@/types'

export interface ExportProgress {
  progress: number
  phase: 'preparing' | 'rendering' | 'finalizing' | 'done' | 'cancelled'
}

export interface ExportResult {
  blob: Blob
  mimeType: string
  width: number
  height: number
  durationMs: number
}

export interface ExportController {
  cancel: () => void
  promise: Promise<ExportResult>
}

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new CaptureError('SEEK_FAILED', 'Could not seek within the recording during export.'))
    }
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
  })
}

async function ensureVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return
  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(
        new CaptureError(
          'METADATA_FAILED',
          'Could not load the recording for export.',
        ),
      )
    }
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('loadeddata', onReady)
    video.addEventListener('error', onError)
  })
}

export function exportVideoWebM(
  project: CaptureProject,
  onProgress?: (progress: ExportProgress) => void,
): ExportController {
  let cancelled = false
  const cancel = () => {
    cancelled = true
  }

  const promise = (async (): Promise<ExportResult> => {
    if (project.media.kind !== 'video') {
      throw new CaptureError('INVALID_MEDIA', 'Video export requires a recorded demo.')
    }

    const mimeType = selectSupportedMimeType()
    if (!mimeType) {
      throw new CaptureError(
        'NO_WEBM_CODEC',
        'No WebM codec is available for export in this browser.',
      )
    }

    if (typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
      throw new CaptureError(
        'NO_CAPTURE_STREAM',
        'Canvas captureStream is not supported, so video export cannot run.',
      )
    }

    onProgress?.({ progress: 0, phase: 'preparing' })

    const video = document.createElement('video')
    video.src = project.media.objectUrl
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    const canvas = document.createElement('canvas')
    let recorder: MediaRecorder | null = null
    let canvasStream: MediaStream | null = null

    try {
      await ensureVideoReady(video)
      const sourceWidth = video.videoWidth || project.media.width
      const sourceHeight = video.videoHeight || project.media.height
      if (!sourceWidth || !sourceHeight) {
        throw new CaptureError(
          'ZERO_DIMENSIONS',
          'The recording has invalid dimensions and cannot be exported.',
        )
      }

      const size = resolveExportSize(
        { width: sourceWidth, height: sourceHeight },
        project.aspectRatio,
        project.exportSettings.resolution === 'original'
          ? 'original'
          : project.exportSettings.resolution,
        project.frameMode,
      )
      canvas.width = size.width
      canvas.height = size.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new CaptureError('CANVAS_FAILED', 'Unable to create an export canvas.')
      }

      const fps = project.exportSettings.fps
      const sourceDurationMs =
        project.media.durationMs ||
        (Number.isFinite(video.duration) ? video.duration * 1000 : 0)

      if (sourceDurationMs < 200) {
        throw new CaptureError(
          'RECORDING_TOO_SHORT',
          'The recording is too short to export.',
        )
      }

      const { outputDurationMs, mapOutputToSource } = computeFreezeTimeline(
        project.events,
        sourceDurationMs,
      )

      canvasStream = canvas.captureStream(fps)
      const chunks: BlobPart[] = []
      recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 8_000_000,
      })

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data)
      }

      const stopped = new Promise<Blob>((resolve, reject) => {
        recorder!.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType })
          if (!blob.size) {
            reject(
              new CaptureError(
                'EXPORT_EMPTY',
                'Export finished but produced an empty file.',
              ),
            )
            return
          }
          resolve(blob)
        }
        recorder!.onerror = () => {
          reject(new CaptureError('EXPORT_FAILED', 'Video export failed unexpectedly.'))
        }
      })

      recorder.start(200)
      onProgress?.({ progress: 0.02, phase: 'rendering' })

      const frameSource = createVideoFrameSource(video)
      const frameCount = Math.max(1, Math.ceil((outputDurationMs / 1000) * fps))
      const frameDuration = 1000 / fps

      for (let i = 0; i < frameCount; i++) {
        if (cancelled) {
          recorder.stop()
          for (const track of canvasStream.getTracks()) track.stop()
          video.removeAttribute('src')
          video.load()
          onProgress?.({ progress: i / frameCount, phase: 'cancelled' })
          throw new CaptureError('EXPORT_CANCELLED', 'Export was cancelled.')
        }

        const outputTimeMs = Math.min(outputDurationMs, i * frameDuration)
        const sourceTimeMs = mapOutputToSource(outputTimeMs)
        const seekTo = Math.min(video.duration || sourceDurationMs / 1000, sourceTimeMs / 1000)

        if (Math.abs(video.currentTime - seekTo) > 0.001) {
          video.currentTime = seekTo
          await waitForSeek(video)
        }

        renderFrame(ctx, frameSource, {
          timeMs: sourceTimeMs,
          outputWidth: size.width,
          outputHeight: size.height,
          aspectRatio: project.aspectRatio,
          frameMode: project.frameMode,
          crop: project.crop,
          events: project.events,
          reducedMotion: false,
          backgroundColor: project.exportSettings.backgroundColor,
          roundedFrame: project.exportSettings.roundedFrame,
          mediaKind: 'video',
          sourceWidth,
          sourceHeight,
        })

        onProgress?.({
          progress: 0.02 + (0.92 * (i + 1)) / frameCount,
          phase: 'rendering',
        })

        // Yield so UI can update
        if (i % 3 === 0) {
          await new Promise((r) => setTimeout(r, 0))
        }
      }

      onProgress?.({ progress: 0.96, phase: 'finalizing' })
      recorder.stop()
      const blob = await stopped

      for (const track of canvasStream.getTracks()) track.stop()
      onProgress?.({ progress: 1, phase: 'done' })

      return {
        blob,
        mimeType,
        width: size.width,
        height: size.height,
        durationMs: outputDurationMs,
      }
    } finally {
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // ignore
        }
      }
      if (canvasStream) {
        for (const track of canvasStream.getTracks()) track.stop()
      }
      video.removeAttribute('src')
      video.load()
    }
  })()

  return { cancel, promise }
}

export async function exportScreenshotPng(
  project: CaptureProject,
  image: HTMLImageElement,
): Promise<ExportResult> {
  const size = resolveExportSize(
    { width: image.naturalWidth || project.media.width, height: image.naturalHeight || project.media.height },
    project.aspectRatio,
    project.exportSettings.resolution === 'original'
      ? 'original'
      : project.exportSettings.resolution,
    project.frameMode,
  )

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new CaptureError('CANVAS_FAILED', 'Unable to create an export canvas.')
  }

  if (project.exportSettings.background === 'transparent') {
    ctx.clearRect(0, 0, size.width, size.height)
  }

  const source = createImageFrameSource(image)
  renderFrame(ctx, source, {
    timeMs: 0,
    outputWidth: size.width,
    outputHeight: size.height,
    aspectRatio: project.aspectRatio,
    frameMode: project.frameMode,
    crop: project.crop,
    events: project.events,
    reducedMotion: true,
    backgroundColor:
      project.exportSettings.background === 'transparent'
        ? 'rgba(0,0,0,0)'
        : project.exportSettings.backgroundColor,
    roundedFrame: project.exportSettings.roundedFrame,
    mediaKind: 'screenshot',
    sourceWidth: image.naturalWidth,
    sourceHeight: image.naturalHeight,
  })

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(
          new CaptureError(
            'PNG_FAILED',
            'PNG generation failed. Please try again.',
          ),
        )
        return
      }
      resolve(result)
    }, 'image/png')
  })

  return {
    blob,
    mimeType: 'image/png',
    width: size.width,
    height: size.height,
    durationMs: 0,
  }
}

export async function exportCurrentVideoFramePng(
  project: CaptureProject,
  video: HTMLVideoElement,
  timeMs: number,
): Promise<ExportResult> {
  const size = resolveExportSize(
    { width: video.videoWidth || project.media.width, height: video.videoHeight || project.media.height },
    project.aspectRatio,
    project.exportSettings.resolution === 'original'
      ? 'original'
      : project.exportSettings.resolution,
    project.frameMode,
  )

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new CaptureError('CANVAS_FAILED', 'Unable to create an export canvas.')
  }

  const target = Math.min(video.duration || 0, timeMs / 1000)
  if (Math.abs(video.currentTime - target) > 0.001) {
    video.currentTime = target
    await waitForSeek(video)
  }

  const source = createVideoFrameSource(video)
  renderFrame(ctx, source, {
    timeMs,
    outputWidth: size.width,
    outputHeight: size.height,
    aspectRatio: project.aspectRatio,
    frameMode: project.frameMode,
    crop: project.crop,
    events: project.events,
    reducedMotion: true,
    backgroundColor: project.exportSettings.backgroundColor,
    roundedFrame: project.exportSettings.roundedFrame,
    mediaKind: 'video',
    sourceWidth: video.videoWidth,
    sourceHeight: video.videoHeight,
  })

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(
          new CaptureError('PNG_FAILED', 'PNG generation failed. Please try again.'),
        )
        return
      }
      resolve(result)
    }, 'image/png')
  })

  return {
    blob,
    mimeType: 'image/png',
    width: size.width,
    height: size.height,
    durationMs: 0,
  }
}
