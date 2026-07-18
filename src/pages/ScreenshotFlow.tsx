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
    <div className="relative flex min-h-screen flex-col">
      <Atmosphere intensity="capture" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-5 sm:px-6">
        <div className="mb-4 animate-fade-in">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/80">
            Capture
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Take a screenshot
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preview the source, then grab a still at full resolution.
          </p>
        </div>

        <StageFrame
          className="relative min-h-[52vh] flex-1 animate-scale-in"
          live={phase === 'preview'}
          label={phase === 'picking' ? 'Waiting…' : phase === 'capturing' ? 'Capturing…' : undefined}
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-contain"
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
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border border-white/[0.06] bg-panel/60 p-3 backdrop-blur-sm animate-fade-up">
          <div className="space-y-2">
            <Label htmlFor="ss-aspect">Aspect ratio</Label>
            <Select
              value={aspectRatio}
              onValueChange={(v) => setAspectRatio(v as ProjectAspectRatio)}
              disabled={phase !== 'preview'}
            >
              <SelectTrigger id="ss-aspect" className="w-40 border-white/10 bg-black/30">
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
