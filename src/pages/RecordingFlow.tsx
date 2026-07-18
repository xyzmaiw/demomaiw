import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, Square, Wifi, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  getVideoTrackSettings,
  onTrackEnded,
  requestDisplayMedia,
  stopMediaStream,
  CaptureError,
} from '@/features/capture/display-media'
import {
  createMediaRecorder,
  loadVideoMetadata,
  revokeObjectUrl,
  type MediaRecorderController,
} from '@/features/capture/recording'
import { createProject } from '@/features/editor/project-reducer'
import type {
  CaptureConnection,
  CaptureProject,
  ClickSourceMetadata,
  ProjectAspectRatio,
  RecordedMedia,
} from '@/types'
import { formatDuration } from '@/lib/utils'
import { getAspectLabel } from '@/lib/aspect'

export interface PendingEnhancedClick {
  x: number
  y: number
  label: string
  metadata?: ClickSourceMetadata
  timeMs: number
}

interface RecordingFlowProps {
  connection: CaptureConnection
  onCancel: () => void
  onComplete: (project: CaptureProject) => void
  onRecordingStart: () => void
  pendingEnhancedClicksRef: React.MutableRefObject<PendingEnhancedClick[]>
}

type Phase = 'picking' | 'preview' | 'countdown' | 'recording' | 'paused' | 'finalizing'

export function RecordingFlow({
  connection,
  onCancel,
  onComplete,
  onRecordingStart,
  pendingEnhancedClicksRef,
}: RecordingFlowProps) {
  const [phase, setPhase] = useState<Phase>('picking')
  const [aspectRatio, setAspectRatio] = useState<ProjectAspectRatio>('original')
  const [countdown, setCountdown] = useState(3)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorderController | null>(null)
  const startedAtRef = useRef(0)
  const pausedAccumRef = useRef(0)
  const pauseStartedRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const aspectRef = useRef(aspectRatio)
  const stopRecordingRef = useRef<(fromTrackEnd?: boolean) => Promise<void>>(async () => undefined)

  useEffect(() => {
    aspectRef.current = aspectRatio
  }, [aspectRatio])

  const cleanupStream = useCallback(() => {
    stopMediaStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopRecording = useCallback(
    async (fromTrackEnd = false) => {
      if (!recorderRef.current) {
        cleanupStream()
        if (!fromTrackEnd) onCancel()
        return
      }
      setPhase('finalizing')
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }

      try {
        const result = await recorderRef.current.stop()
        const settings = streamRef.current
          ? getVideoTrackSettings(streamRef.current)
          : { width: 0, height: 0, frameRate: 30 }
        cleanupStream()

        const objectUrl = URL.createObjectURL(result.blob)
        let width = settings.width
        let height = settings.height
        let durationMs = result.durationMs

        try {
          const meta = await loadVideoMetadata(objectUrl)
          width = meta.width || width
          height = meta.height || height
          if (meta.durationMs > 0) durationMs = meta.durationMs
        } catch (metaErr) {
          if (import.meta.env.DEV) console.error(metaErr)
          if (!width || !height) {
            revokeObjectUrl(objectUrl)
            throw metaErr
          }
        }

        const media: RecordedMedia = {
          kind: 'video',
          blob: result.blob,
          objectUrl,
          mimeType: result.mimeType,
          width,
          height,
          durationMs,
          createdAt: Date.now(),
        }

        const project = createProject(media)
        project.aspectRatio = aspectRef.current

        for (const pending of pendingEnhancedClicksRef.current) {
          project.events.push({
            id: crypto.randomUUID(),
            type: 'click',
            x: pending.x,
            y: pending.y,
            startTimeMs: pending.timeMs,
            ringDurationMs: 550,
            zoomEnabled: true,
            zoomStrength: 1.12,
            zoomHoldDurationMs: 280,
            label: pending.label,
            labelPosition: pending.y < 0.45 ? 'bottom-center' : 'top-center',
            source: 'enhanced',
            sourceMetadata: pending.metadata,
          })
        }
        project.events.sort((a, b) => a.startTimeMs - b.startTimeMs)
        pendingEnhancedClicksRef.current = []

        onComplete(project)
      } catch (err) {
        cleanupStream()
        const message =
          err instanceof CaptureError ? err.userMessage : 'Recording could not be saved.'
        if (import.meta.env.DEV) console.error(err)
        toast.error(message)
        setError(message)
        onCancel()
      }
    },
    [cleanupStream, onCancel, onComplete, pendingEnhancedClicksRef],
  )

  stopRecordingRef.current = stopRecording

  const startCapture = useCallback(async () => {
    setError(null)
    setPhase('picking')
    try {
      const stream = await requestDisplayMedia()
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setPhase('preview')

      onTrackEnded(stream, () => {
        toast.message('Capture source ended')
        void stopRecordingRef.current(true)
      })
    } catch (err) {
      const message =
        err instanceof CaptureError
          ? err.userMessage
          : 'Unable to start screen capture.'
      if (import.meta.env.DEV) console.error(err)
      setError(message)
      cleanupStream()
      if (!(err instanceof CaptureError && err.code === 'PERMISSION_DENIED')) {
        onCancel()
      }
    }
  }, [cleanupStream, onCancel])

  useEffect(() => {
    void startCapture()
    return () => {
      cleanupStream()
    }
    // intentionally once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const beginCountdown = () => {
    setCountdown(3)
    setPhase('countdown')
  }

  const actuallyStartRecording = useCallback(async () => {
    if (!streamRef.current) return
    try {
      pendingEnhancedClicksRef.current = []
      const recorder = createMediaRecorder(streamRef.current)
      recorderRef.current = recorder
      startedAtRef.current = performance.now()
      pausedAccumRef.current = 0
      pauseStartedRef.current = 0
      recorder.start()
      onRecordingStart()
      setPhase('recording')
      setElapsedMs(0)
      timerRef.current = window.setInterval(() => {
        const pauseExtra =
          pauseStartedRef.current > 0 ? performance.now() - pauseStartedRef.current : 0
        setElapsedMs(performance.now() - startedAtRef.current - pausedAccumRef.current - pauseExtra)
      }, 100)
    } catch (err) {
      const message =
        err instanceof CaptureError ? err.userMessage : 'Could not start recording.'
      if (import.meta.env.DEV) console.error(err)
      setError(message)
      toast.error(message)
    }
  }, [onRecordingStart, pendingEnhancedClicksRef])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      void actuallyStartRecording()
      return
    }
    const id = window.setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [phase, countdown, actuallyStartRecording])

  const pauseRecording = () => {
    recorderRef.current?.pause()
    pauseStartedRef.current = performance.now()
    setPhase('paused')
  }

  const resumeRecording = () => {
    if (pauseStartedRef.current) {
      pausedAccumRef.current += performance.now() - pauseStartedRef.current
      pauseStartedRef.current = 0
    }
    recorderRef.current?.resume()
    setPhase('recording')
  }

  const handleCancel = () => {
    cleanupStream()
    onCancel()
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Atmosphere intensity="capture" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/80">
              Capture
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Record a demo
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a tab, window, or screen. No microphone or system audio.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {connection.status === 'connected' ? (
              <Badge variant="success" className="gap-1">
                <Wifi className="size-3" />
                Enhanced connected
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-white/10 bg-white/[0.03]">
                <WifiOff className="size-3" />
                Standard mode
              </Badge>
            )}
          </div>
        </div>

        <StageFrame
          className="relative min-h-[52vh] flex-1 animate-scale-in"
          live={phase === 'preview' || phase === 'countdown'}
          recording={phase === 'recording'}
          label={phase === 'paused' ? 'PAUSED' : phase === 'picking' ? 'Waiting…' : undefined}
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-contain"
            muted
            playsInline
            autoPlay
          />
          {phase === 'countdown' && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
              <span
                key={countdown}
                className="font-display text-[7.5rem] font-semibold leading-none text-white animate-countdown-pop sm:text-[9rem]"
              >
                {countdown || 'Go'}
              </span>
            </div>
          )}
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
          {(phase === 'preview' || phase === 'countdown') && (
            <div className="space-y-2">
              <Label htmlFor="aspect">Aspect ratio</Label>
              <Select
                value={aspectRatio}
                onValueChange={(v) => setAspectRatio(v as ProjectAspectRatio)}
                disabled={phase === 'countdown'}
              >
                <SelectTrigger id="aspect" className="w-40 border-white/10 bg-black/30">
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
          )}

          {(phase === 'recording' || phase === 'paused') && (
            <div className="flex items-center gap-3">
              {phase === 'recording' && <span className="rec-dot" />}
              <div className="font-mono text-xl tabular-nums tracking-tight" aria-live="polite">
                {formatDuration(elapsedMs)}
                {phase === 'paused' ? (
                  <span className="ml-2 text-sm text-muted-foreground">paused</span>
                ) : null}
              </div>
            </div>
          )}

          <div className="ml-auto flex flex-wrap gap-2">
            {phase === 'preview' && (
              <>
                <Button variant="outline" className="border-white/10" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button size="lg" onClick={beginCountdown}>
                  Start recording
                </Button>
              </>
            )}
            {phase === 'countdown' && (
              <Button variant="outline" className="border-white/10" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            {phase === 'recording' && (
              <>
                <Button variant="secondary" onClick={pauseRecording}>
                  <Pause className="size-4" />
                  Pause
                </Button>
                <Button variant="destructive" onClick={() => void stopRecording()}>
                  <Square className="size-4" />
                  Stop
                </Button>
              </>
            )}
            {phase === 'paused' && (
              <>
                <Button variant="secondary" onClick={resumeRecording}>
                  <Play className="size-4" />
                  Resume
                </Button>
                <Button variant="destructive" onClick={() => void stopRecording()}>
                  <Square className="size-4" />
                  Stop
                </Button>
              </>
            )}
            {phase === 'finalizing' && <Button disabled>Saving recording…</Button>}
            {phase === 'picking' && <Button disabled>Waiting for capture source…</Button>}
          </div>
        </div>
      </div>
    </div>
  )
}
