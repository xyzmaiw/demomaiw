import { useEffect, useRef } from 'react'
import {
  createImageFrameSource,
  createVideoFrameSource,
  renderFrame,
} from '@/features/export/renderer'
import type { CaptureProject } from '@/types'
import { cn } from '@/lib/utils'

interface PreviewCanvasProps {
  project: CaptureProject
  timeMs: number
  reducedMotion: boolean
  videoRef?: React.RefObject<HTMLVideoElement | null>
  imageRef?: React.RefObject<HTMLImageElement | null>
  className?: string
  onCanvasClick?: (x: number, y: number) => void
  interactive?: boolean
}

export function PreviewCanvas({
  project,
  timeMs,
  reducedMotion,
  videoRef,
  imageRef,
  className,
  onCanvasClick,
  interactive = true,
}: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const media = project.media
      const sourceWidth = media.width
      const sourceHeight = media.height
      if (!sourceWidth || !sourceHeight) return

      const rect = container.getBoundingClientRect()
      const maxW = Math.max(320, rect.width)
      const maxH = Math.max(240, rect.height)
      const aspect = sourceWidth / sourceHeight
      let outW = maxW
      let outH = outW / aspect
      if (outH > maxH) {
        outH = maxH
        outW = outH * aspect
      }

      // Apply project aspect for output framing preview
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(outW * dpr)
      canvas.height = Math.round(outH * dpr)
      canvas.style.width = `${Math.round(outW)}px`
      canvas.style.height = `${Math.round(outH)}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (media.kind === 'video' && videoRef?.current && videoRef.current.readyState >= 2) {
        const source = createVideoFrameSource(videoRef.current)
        renderFrame(ctx, source, {
          timeMs,
          outputWidth: outW,
          outputHeight: outH,
          aspectRatio: project.aspectRatio,
          crop: project.crop,
          events: project.events,
          reducedMotion,
          backgroundColor: project.exportSettings.backgroundColor,
          roundedFrame: project.exportSettings.roundedFrame,
          mediaKind: 'video',
          sourceWidth: videoRef.current.videoWidth || sourceWidth,
          sourceHeight: videoRef.current.videoHeight || sourceHeight,
        })
      } else if (media.kind === 'screenshot' && imageRef?.current?.complete) {
        const source = createImageFrameSource(imageRef.current)
        renderFrame(ctx, source, {
          timeMs: 0,
          outputWidth: outW,
          outputHeight: outH,
          aspectRatio: project.aspectRatio,
          crop: project.crop,
          events: project.events,
          reducedMotion: true,
          backgroundColor: project.exportSettings.backgroundColor,
          roundedFrame: project.exportSettings.roundedFrame,
          mediaKind: 'screenshot',
          sourceWidth: imageRef.current.naturalWidth || sourceWidth,
          sourceHeight: imageRef.current.naturalHeight || sourceHeight,
        })
      }
    }

    const loop = () => {
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    const observer = new ResizeObserver(() => draw())
    observer.observe(container)

    return () => {
      cancelAnimationFrame(rafRef.current)
      observer.disconnect()
    }
  }, [project, timeMs, reducedMotion, videoRef, imageRef])

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !onCanvasClick) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    if (x < 0 || x > 1 || y < 0 || y > 1) return
    onCanvasClick(x, y)
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex h-full min-h-[280px] w-full items-center justify-center editor-checker rounded-lg border border-border',
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className={cn('max-h-full max-w-full', interactive && 'cursor-crosshair')}
        onClick={handleClick}
        role="img"
        aria-label="Demo preview canvas. Click to add a click marker when paused."
      />
    </div>
  )
}
