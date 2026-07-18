import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Atmosphere, StageFrame } from '@/components/Atmosphere'
import {
  CaptureError,
  onTrackEnded,
  requestDisplayMedia,
  stopMediaStream,
} from '@/features/capture/display-media'
import { captureFrameFromStream } from '@/features/screenshot/capture-frame'
import { createProject } from '@/features/editor/project-reducer'
import { getAspectLabel } from '@/lib/aspect'
import type { CaptureProject, ProjectAspectRatio, ScreenshotMedia } from '@/types'

interface ScreenshotFlowProps {
  onCancel: () => void
  onComplete: (project: CaptureProject) => void
}

export function ScreenshotFlow({ onCancel, onComplete }: ScreenshotFlowProps) {
  const [phase, setPhase] = useState<'picking' | 'preview' | 'capturing'>('picking')
  const [aspectRatio, setAspectRatio] = useState<ProjectAspectRatio>('original')
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const cleanup = useCallback(() => {
    stopMediaStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await requestDisplayMedia()
        if (cancelled) {
          stopMediaStream(stream)
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        setPhase('preview')
        onTrackEnded(stream, () => {
          toast.message('Capture source ended')
          cleanup()
          onCancel()
        })
      } catch (err) {
        const message =
          err instanceof CaptureError ? err.userMessage : 'Unable to start screen capture.'
        if (import.meta.env.DEV) console.error(err)
        setError(message)
        cleanup()
        if (!(err instanceof CaptureError && err.code === 'PERMISSION_DENIED')) {
          onCancel()
        }
      }
    })()
    return () => {
      cancelled = true
      cleanup()
    }
  }, [cleanup, onCancel])

  const takeScreenshot = async () => {
    if (!streamRef.current) return
    setPhase('capturing')
    try {
      const frame = await captureFrameFromStream(streamRef.current)
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null

      const media: ScreenshotMedia = {
        kind: 'screenshot',
        blob: frame.blob,
        objectUrl: frame.objectUrl,
        width: frame.width,
        height: frame.height,
        createdAt: Date.now(),
      }
      const project = createProject(media)
      project.aspectRatio = aspectRatio
      onComplete(project)
    } catch (err) {
      cleanup()
      const message =
        err instanceof CaptureError ? err.userMessage : 'Screenshot capture failed.'
      if (import.meta.env.DEV) console.error(err)
      toast.error(message)
      onCancel()
    }
  }

  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden">
      <Atmosphere intensity="capture" />

      <div className="relative mx-auto flex h-full w-full max-w-[1600px] min-h-0 flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2 animate-fade-in">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/80">
              Capture
            </p>
            <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              Take a screenshot
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Full source preview — nothing cropped. Grab a still at native resolution.
            </p>
          </div>
        </div>

        <StageFrame
          className="relative min-h-0 flex-1 animate-scale-in !rounded-lg sm:!rounded-xl"
          live={phase === 'preview'}
          vignette="none"
          label={phase === 'picking' ? 'Waiting…' : phase === 'capturing' ? 'Capturing…' : undefined}
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-contain bg-black"
            muted
            playsInline
            autoPlay
          />
          {phase === 'picking' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <p className="text-sm text-white/50">Waiting for capture source…</p>
            </div>
          )}
        </StageFrame>

        {error && (
          <p role="alert" className="mt-2 shrink-0 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-2 flex shrink-0 flex-wrap items-end gap-3 rounded-xl border border-white/[0.06] bg-panel/60 p-2.5 backdrop-blur-sm animate-fade-up sm:gap-4 sm:p-3">
          <div className="space-y-1.5">
            <Label htmlFor="ss-aspect">Aspect ratio</Label>
            <Select
              value={aspectRatio}
              onValueChange={(v) => setAspectRatio(v as ProjectAspectRatio)}
              disabled={phase !== 'preview'}
            >
              <SelectTrigger id="ss-aspect" className="w-44 border-white/10 bg-black/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['original', '16:9', '4:3', '1:1'] as const).map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>
                    {getAspectLabel(ratio)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              className="border-white/10"
              onClick={() => {
                cleanup()
                onCancel()
              }}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              disabled={phase !== 'preview'}
              onClick={() => void takeScreenshot()}
            >
              <Camera className="size-4" />
              {phase === 'capturing' ? 'Capturing…' : 'Take screenshot'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
