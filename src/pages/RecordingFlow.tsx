import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  Pause,
  Play,
  Square,
  Terminal,
  Wifi,
  WifiOff,
  Zap,
  ZapOff,
} from 'lucide-react'
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
import { buildConsolePasteSnippet } from '@/features/enhanced-capture/console-snippet'
import { getAspectLabel } from '@/lib/aspect'
import {
  COUNTDOWN_SECONDS,
  resetTabIndicator,
  setTabIndicator,
} from '@/lib/tab-indicator'
import { formatDuration, withBase } from '@/lib/utils'
import type {
  CaptureConnection,
  CaptureProject,
  ClickSourceMetadata,
  ProjectAspectRatio,
  RecordedMedia,
} from '@/types'

export interface PendingEnhancedClick {
  x: number
  y: number
  label: string
  metadata?: ClickSourceMetadata
  timeMs: number
}

interface RecordingFlowProps {
  sessionId: string
  connection: CaptureConnection
  onCancel: () => void
  onComplete: (project: CaptureProject) => void
  onRecordingStart: () => void
  onEnsureListening: () => void
  pendingEnhancedClicksRef: React.MutableRefObject<PendingEnhancedClick[]>
}

type Phase =
  | 'setup'
  | 'picking'
  | 'countdown'
  | 'recording'
  | 'paused'
  | 'finalizing'

type CaptureMode = 'standard' | 'enhanced'

export function RecordingFlow({
  sessionId,
  connection,
  onCancel,
  onComplete,
  onRecordingStart,
  onEnsureListening,
  pendingEnhancedClicksRef,
}: RecordingFlowProps) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null)
  const [aspectRatio, setAspectRatio] = useState<ProjectAspectRatio>('original')
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pipSupported] = useState(
    () => typeof window !== 'undefined' && 'documentPictureInPicture' in window,
  )

  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorderController | null>(null)
  const startedAtRef = useRef(0)
  const pausedAccumRef = useRef(0)
  const pauseStartedRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const aspectRef = useRef(aspectRatio)
  const stopRecordingRef = useRef<(fromTrackEnd?: boolean) => Promise<void>>(async () => undefined)
  const pipWindowRef = useRef<Window | null>(null)
  const phaseRef = useRef(phase)
  const countdownRef = useRef(countdown)
  const elapsedRef = useRef(elapsedMs)

  useEffect(() => {
    aspectRef.current = aspectRatio
  }, [aspectRatio])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    countdownRef.current = countdown
  }, [countdown])

  useEffect(() => {
    elapsedRef.current = elapsedMs
  }, [elapsedMs])

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

  const closePip = useCallback(() => {
    try {
      pipWindowRef.current?.close()
    } catch {
      // ignore
    }
    pipWindowRef.current = null
  }, [])

  const stopRecording = useCallback(
    async (fromTrackEnd = false) => {
      closePip()
      if (!recorderRef.current) {
        cleanupStream()
        resetTabIndicator()
        if (!fromTrackEnd) onCancel()
        return
      }
      setPhase('finalizing')
      resetTabIndicator()
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
        closePip()
        resetTabIndicator()
        const message =
          err instanceof CaptureError ? err.userMessage : 'Recording could not be saved.'
        if (import.meta.env.DEV) console.error(err)
        toast.error(message)
        setError(message)
        onCancel()
      }
    },
    [cleanupStream, closePip, onCancel, onComplete, pendingEnhancedClicksRef],
  )

  stopRecordingRef.current = stopRecording

  const updatePipUi = useCallback(() => {
    const pip = pipWindowRef.current
    if (!pip || pip.closed) return
    const status = pip.document.getElementById('dm-status')
    const timer = pip.document.getElementById('dm-timer')
    const hint = pip.document.getElementById('dm-hint')
    const phaseNow = phaseRef.current
    if (status) {
      status.textContent =
        phaseNow === 'countdown'
          ? `Starting in ${countdownRef.current || 'Go'}`
          : phaseNow === 'recording'
            ? 'Recording'
            : phaseNow === 'paused'
              ? 'Paused'
              : phaseNow
    }
    if (timer) {
      timer.textContent =
        phaseNow === 'countdown'
          ? String(countdownRef.current || 'Go')
          : formatDuration(elapsedRef.current)
    }
    if (hint) {
      hint.textContent =
        phaseNow === 'countdown'
          ? 'Stay on the shared tab — recording starts automatically.'
          : 'Click through your product. Stop here or via the browser sharing bar.'
    }
  }, [])

  const openPipControls = useCallback(async () => {
    const docPip = (
      window as Window & {
        documentPictureInPicture?: {
          requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>
        }
      }
    ).documentPictureInPicture
    if (!docPip) return

    try {
      closePip()
      const pip = await docPip.requestWindow({ width: 340, height: 160 })
      pipWindowRef.current = pip
      pip.document.title = 'demomaiw'
      pip.document.body.innerHTML = `
        <style>
          :root { color-scheme: dark; }
          body {
            margin: 0; font-family: "IBM Plex Sans", system-ui, sans-serif;
            background: #0c0c10; color: #f4f4f5;
            display: flex; flex-direction: column; gap: 10px;
            padding: 14px; box-sizing: border-box; height: 100vh;
          }
          #dm-status { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #c4b5fd; }
          #dm-timer { font-family: ui-monospace, monospace; font-size: 28px; font-weight: 600; }
          #dm-hint { font-size: 12px; color: #a1a1aa; line-height: 1.35; flex: 1; }
          #dm-stop {
            appearance: none; border: 0; border-radius: 8px; padding: 10px 12px;
            background: #dc2626; color: white; font: inherit; font-weight: 600; cursor: pointer;
          }
        </style>
        <div id="dm-status">Starting…</div>
        <div id="dm-timer">3</div>
        <div id="dm-hint">Stay on the shared tab — recording starts automatically.</div>
        <button id="dm-stop" type="button">Stop recording</button>
      `
      pip.document.getElementById('dm-stop')?.addEventListener('click', () => {
        void stopRecordingRef.current(false)
      })
      pip.addEventListener('pagehide', () => {
        pipWindowRef.current = null
      })
      updatePipUi()
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Document PiP unavailable', err)
    }
  }, [closePip, updatePipUi])

  useEffect(() => {
    if (phase === 'countdown') {
      setTabIndicator({ mode: 'countdown', count: countdown })
      return
    }
    if (phase === 'recording') {
      setTabIndicator({
        mode: 'recording',
        elapsedLabel: formatDuration(elapsedMs),
      })
      return
    }
    if (phase === 'paused') {
      setTabIndicator({
        mode: 'paused',
        elapsedLabel: formatDuration(elapsedMs),
      })
      return
    }
    if (phase === 'setup' || phase === 'picking' || phase === 'finalizing') {
      if (phase === 'setup' || phase === 'finalizing') {
        resetTabIndicator()
      }
    }
  }, [phase, countdown, elapsedMs])

  useEffect(() => {
    updatePipUi()
  }, [phase, countdown, elapsedMs, updatePipUi])

  useEffect(() => {
    return () => {
      cleanupStream()
      closePip()
      resetTabIndicator()
    }
  }, [cleanupStream, closePip])

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
      updatePipUi()
    } catch (err) {
      const message =
        err instanceof CaptureError ? err.userMessage : 'Could not start recording.'
      if (import.meta.env.DEV) console.error(err)
      setError(message)
      toast.error(message)
      closePip()
      resetTabIndicator()
    }
  }, [closePip, onRecordingStart, pendingEnhancedClicksRef, updatePipUi])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      void actuallyStartRecording()
      return
    }
    const id = window.setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [phase, countdown, actuallyStartRecording])

  const beginAutoCountdown = useCallback(async () => {
    setCountdown(COUNTDOWN_SECONDS)
    setPhase('countdown')
    setTabIndicator({ mode: 'countdown', count: COUNTDOWN_SECONDS })
    await openPipControls()
    toast.message(`Recording starts in ${COUNTDOWN_SECONDS} seconds`, {
      description: 'Watch the demomaiw tab icon for the green countdown — stay on the shared tab.',
    })
  }, [openPipControls])

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

      onTrackEnded(stream, () => {
        toast.message('Capture source ended')
        void stopRecordingRef.current(true)
      })

      // Chrome often focuses the shared tab immediately — don't wait for a Start click.
      await beginAutoCountdown()
    } catch (err) {
      const message =
        err instanceof CaptureError
          ? err.userMessage
          : 'Unable to start screen capture.'
      if (import.meta.env.DEV) console.error(err)
      setError(message)
      cleanupStream()
      closePip()
      resetTabIndicator()
      if (err instanceof CaptureError && err.code === 'PERMISSION_DENIED') {
        setPhase('setup')
        return
      }
      onCancel()
    }
  }, [beginAutoCountdown, cleanupStream, closePip, onCancel])

  const chooseMode = (mode: CaptureMode) => {
    setCaptureMode(mode)
    if (mode === 'enhanced') {
      onEnsureListening()
    }
  }

  const copyConsoleSnippet = async () => {
    const snippet = buildConsolePasteSnippet({
      sessionId,
      recorderOrigin: window.location.origin,
    })
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      toast.success('Console snippet copied')
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  const openSample = () => {
    onEnsureListening()
    const url = `${window.location.origin}${withBase('/sample/')}?session=${encodeURIComponent(sessionId)}`
    window.open(url, 'demomaiw-sample')
  }

  const handleCancel = () => {
    cleanupStream()
    closePip()
    resetTabIndicator()
    onCancel()
  }

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

  if (phase === 'setup') {
    return (
      <div className="relative min-h-screen">
        <Atmosphere intensity="capture" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-10 animate-fade-up">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/80">
            Before you share
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Record a demo
          </h1>
          <p className="mt-2 text-muted-foreground text-balance">
            Chrome often jumps to the tab you share. demomaiw will auto-start a {COUNTDOWN_SECONDS}
            -second countdown after you pick a source — watch the green tab icon / title, stay on
            that tab, and interact. Stop from the browser sharing bar, floating control, or return
            here.
          </p>

          <div className="mt-8 space-y-3">
            <p className="text-sm font-medium">Click capture mode</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`action-tile group ${captureMode === 'standard' ? 'border-primary/50 bg-primary/10' : ''}`}
                onClick={() => chooseMode('standard')}
              >
                <span className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <ZapOff className="size-5" />
                </span>
                <span>
                  <span className="block font-display text-lg font-semibold">Standard</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Add clicks manually in review
                  </span>
                </span>
              </button>
              <button
                type="button"
                className={`action-tile group ${captureMode === 'enhanced' ? 'border-primary/50 bg-primary/10' : ''}`}
                onClick={() => chooseMode('enhanced')}
              >
                <span className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-primary/15 text-primary">
                  <Zap className="size-5" />
                </span>
                <span>
                  <span className="block font-display text-lg font-semibold">Enhanced</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Auto rings, zooms, step labels
                  </span>
                </span>
              </button>
            </div>
          </div>

          {captureMode === 'enhanced' && (
            <div className="mt-4 space-y-3 rounded-xl border border-primary/25 bg-panel/70 p-4 animate-fade-in">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    connection.status === 'connected'
                      ? 'success'
                      : connection.status === 'waiting'
                        ? 'warning'
                        : 'outline'
                  }
                >
                  {connection.status === 'connected'
                    ? 'Connection detected'
                    : 'Waiting for companion'}
                </Badge>
                <code className="rounded bg-panel-muted px-2 py-0.5 font-mono text-[11px]">
                  {sessionId}
                </code>
              </div>
              <p className="text-sm text-muted-foreground">
                Paste the console snippet into the product tab (open it from demomaiw if
                cross-origin), then share that tab.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void copyConsoleSnippet()}>
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy console script
                </Button>
                <Button size="sm" variant="secondary" onClick={openSample}>
                  <ExternalLink className="size-3.5" />
                  Open sample
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    toast.message('Enhanced is optional', {
                      description:
                        'You can still add markers manually in review if the companion is not connected.',
                    })
                  }}
                >
                  <Terminal className="size-3.5" />
                  Skip companion for now
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-2">
            <Label htmlFor="aspect-setup">Aspect ratio</Label>
            <Select
              value={aspectRatio}
              onValueChange={(v) => setAspectRatio(v as ProjectAspectRatio)}
            >
              <SelectTrigger id="aspect-setup" className="w-full max-w-xs border-white/10 bg-black/30">
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

          {pipSupported && (
            <p className="mt-4 text-xs text-muted-foreground">
              A floating control window will open when available, so you can stop recording even
              while focused on the shared tab.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-2">
            <Button variant="outline" className="border-white/10" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              size="lg"
              disabled={!captureMode}
              onClick={() => void startCapture()}
            >
              Share tab & auto-start
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden">
      <Atmosphere intensity="capture" />

      <div className="relative mx-auto flex h-full w-full max-w-[1600px] min-h-0 flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 animate-fade-in">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/80">
              Capture
            </p>
            <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              Record a demo
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {phase === 'picking'
                ? 'Pick a tab, window, or screen in the browser prompt…'
                : phase === 'countdown'
                  ? 'Countdown started — stay on the shared tab.'
                  : 'Full source preview — nothing cropped. No mic or system audio.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {captureMode === 'enhanced' || connection.status === 'connected' ? (
              <Badge
                variant={connection.status === 'connected' ? 'success' : 'outline'}
                className="gap-1"
              >
                <Wifi className="size-3" />
                {connection.status === 'connected' ? 'Enhanced connected' : 'Enhanced armed'}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-white/10 bg-white/[0.03]">
                <WifiOff className="size-3" />
                Standard mode
              </Badge>
            )}
          </div>
        </div>

        {(phase === 'countdown' || phase === 'picking') && (
          <div className="mb-2 shrink-0 rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm text-primary-foreground/90 animate-fade-in">
            {phase === 'picking'
              ? 'After you share, Chrome may switch tabs. A green countdown appears on the demomaiw tab icon — recording starts automatically.'
              : 'Green tab countdown → red REC icon. Interact on the shared tab. Stop via floating control or the browser’s Stop sharing button.'}
          </div>
        )}

        <StageFrame
          className="relative min-h-0 flex-1 animate-scale-in !rounded-lg sm:!rounded-xl"
          live={phase === 'countdown'}
          recording={phase === 'recording'}
          vignette="none"
          label={
            phase === 'paused'
              ? 'PAUSED'
              : phase === 'picking'
                ? 'Waiting for share…'
                : undefined
          }
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-contain bg-black"
            muted
            playsInline
            autoPlay
          />
          {phase === 'countdown' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-[2px]">
              <span
                key={countdown}
                className="font-display text-[7.5rem] font-semibold leading-none text-white animate-countdown-pop sm:text-[9rem]"
              >
                {countdown || 'Go'}
              </span>
              <p className="text-sm text-white/70">Auto-starting — stay on the shared tab</p>
            </div>
          )}
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
            {phase === 'picking' && (
              <Button variant="outline" className="border-white/10" onClick={handleCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
