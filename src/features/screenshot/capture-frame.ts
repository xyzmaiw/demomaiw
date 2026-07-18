import { CaptureError, stopMediaStream } from '@/features/capture/display-media'

export async function captureFrameFromStream(
  stream: MediaStream,
): Promise<{ blob: Blob; width: number; height: number; objectUrl: string }> {
  const track = stream.getVideoTracks()[0]
  if (!track) {
    throw new CaptureError('NO_VIDEO_TRACK', 'No video track available for screenshot.')
  }

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream

  try {
    await video.play()
    // Wait for a painted frame
    await new Promise<void>((resolve) => {
      if (video.videoWidth > 0) {
        resolve()
        return
      }
      video.onloadeddata = () => resolve()
    })

    // Extra frame wait for stability
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) {
      throw new CaptureError(
        'FRAME_UNAVAILABLE',
        'Could not capture a frame from the selected source.',
      )
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new CaptureError('CANVAS_FAILED', 'Unable to create a drawing surface for the screenshot.')
    }
    ctx.drawImage(video, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(
            new CaptureError(
              'PNG_FAILED',
              'PNG generation failed. Please try capturing again.',
            ),
          )
          return
        }
        resolve(result)
      }, 'image/png')
    })

    const objectUrl = URL.createObjectURL(blob)
    return { blob, width, height, objectUrl }
  } finally {
    video.pause()
    video.srcObject = null
    stopMediaStream(stream)
  }
}

export async function loadImageElement(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(
        new CaptureError(
          'IMAGE_LOAD_FAILED',
          'Could not load the screenshot image.',
        ),
      )
    img.src = objectUrl
  })
}
