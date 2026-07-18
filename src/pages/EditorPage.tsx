import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  ArrowLeft,
  Download,
  Pause,
  Play,
  Plus,
  Snowflake,
  Trash2,
  Type,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Atmosphere } from '@/components/Atmosphere'
import { PreviewCanvas } from '@/features/editor/PreviewCanvas'
import { TimelineBar } from '@/features/editor/TimelineBar'
import {
  createFreezeEvent,
  createManualClickEvent,
  createTextCardEvent,
  projectReducer,
} from '@/features/editor/project-reducer'
import {
  exportCurrentVideoFramePng,
  exportScreenshotPng,
  exportVideoWebM,
  type ExportController,
} from '@/features/export/export-media'
import { CaptureError } from '@/features/capture/display-media'
import { revokeObjectUrl } from '@/features/capture/recording'
import { loadImageElement } from '@/features/screenshot/capture-frame'
import { getAspectLabel } from '@/lib/aspect'
import { downloadBlob, formatFileSize, formatDuration, todayStamp } from '@/lib/utils'
import type {
  CaptureProject,
  CardPosition,
  ClickEvent,
  DemoEvent,
  ProjectAspectRatio,
  TextCardEvent,
} from '@/types'

interface EditorPageProps {
  project: CaptureProject
  onChangeProject: (project: CaptureProject) => void
  onExit: () => void
}

export function EditorPage({ project: initialProject, onChangeProject, onExit }: EditorPageProps) {
  const [store, dispatch] = useReducer(projectReducer, {
    project: initialProject,
    selectedEventId: null,
  })
  const project = store.project!
  const selectedEventId = store.selectedEventId

  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportLabel, setExportLabel] = useState('')
  const [lastExportInfo, setLastExportInfo] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const exportControllerRef = useRef<ExportController | null>(null)
  const rafRef = useRef(0)

  const isVideo = project.media.kind === 'video'
  const durationMs = project.media.kind === 'video' ? project.media.durationMs : 0

  useEffect(() => {
    onChangeProject(project)
  }, [project, onChangeProject])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    return () => {
      exportControllerRef.current?.cancel()
    }
  }, [])

  // Sync hidden video element
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isVideo) return
    if (video.src !== project.media.objectUrl) {
      video.src = project.media.objectUrl
    }
  }, [isVideo, project.media.objectUrl])

  useEffect(() => {
    const img = imageRef.current
    if (!img || isVideo) return
    if (img.src !== project.media.objectUrl) {
      img.src = project.media.objectUrl
    }
  }, [isVideo, project.media.objectUrl])

  const tick = useCallback(() => {
    const video = videoRef.current
    if (video && isVideo) {
      setCurrentTimeMs(video.currentTime * 1000)
      if (!video.paused && !video.ended) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setIsPlaying(false)
      }
    }
  }, [isVideo])

  const play = async () => {
    if (!isVideo || !videoRef.current) return
    try {
      await videoRef.current.play()
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      if (import.meta.env.DEV) console.error(err)
      toast.error('Playback could not start.')
    }
  }

  const pause = () => {
    videoRef.current?.pause()
    setIsPlaying(false)
    cancelAnimationFrame(rafRef.current)
    if (videoRef.current) setCurrentTimeMs(videoRef.current.currentTime * 1000)
  }

  const seek = (timeMs: number) => {
    if (!videoRef.current || !isVideo) return
    const t = Math.max(0, Math.min(durationMs, timeMs)) / 1000
    videoRef.current.currentTime = t
    setCurrentTimeMs(t * 1000)
  }

  const selectedEvent = useMemo(
    () => project.events.find((e) => e.id === selectedEventId) ?? null,
    [project.events, selectedEventId],
  )

  const addClickAt = (x: number, y: number) => {
    if (isVideo && isPlaying) {
      pause()
    }
    const event = createManualClickEvent(x, y, isVideo ? currentTimeMs : 0)
    dispatch({ type: 'ADD_EVENT', event })
    toast.success('Click marker added')
  }

  const addTextCard = () => {
    const event = createTextCardEvent('Describe this step', isVideo ? currentTimeMs : 0)
    dispatch({ type: 'ADD_EVENT', event })
  }

  const addFreeze = () => {
    if (!isVideo) return
    const event = createFreezeEvent(currentTimeMs)
    dispatch({ type: 'ADD_EVENT', event })
    toast.message('Experimental freeze marker added')
  }

  const handleExportVideo = async () => {
    if (!isVideo) return
    setIsExporting(true)
    setExportProgress(0)
    setExportLabel('Preparing…')
    setLastExportInfo(null)
    pause()

    const controller = exportVideoWebM(project, (p) => {
      setExportProgress(Math.round(p.progress * 100))
      setExportLabel(
        p.phase === 'rendering'
          ? 'Rendering frames…'
          : p.phase === 'finalizing'
            ? 'Finalizing…'
            : p.phase === 'cancelled'
              ? 'Cancelled'
              : p.phase === 'done'
                ? 'Done'
                : 'Preparing…',
      )
    })
    exportControllerRef.current = controller

    try {
      const result = await controller.promise
      const filename = `demomaiw-demo-${todayStamp()}.webm`
      downloadBlob(result.blob, filename)
      setLastExportInfo(`${filename} · ${formatFileSize(result.blob.size)}`)
      toast.success('WebM export complete')
    } catch (err) {
      if (err instanceof CaptureError && err.code === 'EXPORT_CANCELLED') {
        toast.message('Export cancelled')
      } else {
        const message =
          err instanceof CaptureError ? err.userMessage : 'Video export failed.'
        if (import.meta.env.DEV) console.error(err)
        toast.error(message)
      }
    } finally {
      exportControllerRef.current = null
      setIsExporting(false)
    }
  }

  const handleExportPng = async () => {
    setIsExporting(true)
    setExportProgress(10)
    setExportLabel('Creating PNG…')
    try {
      let result
      if (isVideo) {
        if (!videoRef.current) throw new CaptureError('NO_VIDEO', 'Video is not ready.')
        pause()
        result = await exportCurrentVideoFramePng(project, videoRef.current, currentTimeMs)
      } else {
        const image = await loadImageElement(project.media.objectUrl)
        result = await exportScreenshotPng(project, image)
      }
      setExportProgress(100)
      const filename = `demomaiw-screenshot-${todayStamp()}.png`
      downloadBlob(result.blob, filename)
      setLastExportInfo(`${filename} · ${formatFileSize(result.blob.size)}`)
      toast.success('PNG export complete')
    } catch (err) {
      const message = err instanceof CaptureError ? err.userMessage : 'PNG export failed.'
      if (import.meta.env.DEV) console.error(err)
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }

  const cancelExport = () => {
    exportControllerRef.current?.cancel()
  }

  const inspector = (
    <div className="flex h-full flex-col gap-4">
      <Tabs defaultValue="events">
        <TabsList className="w-full">
          <TabsTrigger value="events" className="flex-1">
            Events
          </TabsTrigger>
          <TabsTrigger value="canvas" className="flex-1">
            Canvas
          </TabsTrigger>
          <TabsTrigger value="export" className="flex-1">
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={addTextCard} disabled={isExporting}>
              <Type className="size-3.5" />
              Text card
            </Button>
            {isVideo && (
              <Button size="sm" variant="outline" onClick={addFreeze} disabled={isExporting}>
                <Snowflake className="size-3.5" />
                Freeze
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isVideo
              ? 'Pause and click the preview to add a click marker.'
              : 'Click the preview to add a click ring.'}
          </p>

          <ScrollArea className="h-[220px] rounded-md border border-border">
            <ul className="p-2" role="listbox" aria-label="Event list">
              {project.events.length === 0 && (
                <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No events yet
                </li>
              )}
              {project.events.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedEventId === event.id}
                    className={`mb-1 flex w-full items-start justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted ${
                      selectedEventId === event.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => {
                      dispatch({ type: 'SELECT_EVENT', id: event.id })
                      if (isVideo) seek(event.startTimeMs)
                    }}
                  >
                    <span>
                      <span className="font-medium capitalize">{event.type.replace('-', ' ')}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {event.type === 'click'
                          ? event.label || 'Click'
                          : event.type === 'text-card'
                            ? event.text
                            : `Hold ${formatDuration(event.durationMs)}`}
                      </span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {isVideo ? formatDuration(event.startTimeMs) : '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>

          {selectedEvent && (
            <EventInspector
              event={selectedEvent}
              isVideo={isVideo}
              disabled={isExporting}
              onChange={(patch) =>
                dispatch({ type: 'UPDATE_EVENT', id: selectedEvent.id, patch })
              }
              onDelete={() => dispatch({ type: 'DELETE_EVENT', id: selectedEvent.id })}
            />
          )}
        </TabsContent>

        <TabsContent value="canvas" className="space-y-4">
          <div className="space-y-2">
            <Label>Aspect ratio</Label>
            <Select
              value={project.aspectRatio}
              onValueChange={(v) =>
                dispatch({ type: 'SET_ASPECT_RATIO', aspectRatio: v as ProjectAspectRatio })
              }
              disabled={isExporting}
            >
              <SelectTrigger>
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
            <p className="text-xs text-muted-foreground">
              Original keeps the full captured page. Other ratios letterbox by default so nothing is
              cropped.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Framing</Label>
            <Select
              value={project.frameMode}
              onValueChange={(v) =>
                dispatch({ type: 'SET_FRAME_MODE', frameMode: v as 'fit' | 'fill' })
              }
              disabled={isExporting || project.aspectRatio === 'original'}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fit">Fit — full page, letterbox</SelectItem>
                <SelectItem value="fill">Fill — crop to cover</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {project.frameMode === 'fill' && project.aspectRatio !== 'original' && (
            <>
              <div className="space-y-2">
                <Label>Crop focal X ({project.crop.focalX.toFixed(2)})</Label>
                <Slider
                  value={[project.crop.focalX]}
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={isExporting}
                  onValueChange={([focalX]) => dispatch({ type: 'SET_CROP', crop: { focalX } })}
                />
              </div>
              <div className="space-y-2">
                <Label>Crop focal Y ({project.crop.focalY.toFixed(2)})</Label>
                <Slider
                  value={[project.crop.focalY]}
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={isExporting}
                  onValueChange={([focalY]) => dispatch({ type: 'SET_CROP', crop: { focalY } })}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="rounded">Rounded frame</Label>
            <Switch
              id="rounded"
              checked={project.exportSettings.roundedFrame}
              disabled={isExporting}
              onCheckedChange={(roundedFrame) =>
                dispatch({ type: 'SET_EXPORT_SETTINGS', settings: { roundedFrame } })
              }
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="reduced">Reduced motion preview</Label>
            <Switch
              id="reduced"
              checked={reducedMotion}
              onCheckedChange={setReducedMotion}
            />
          </div>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <div className="space-y-2">
            <Label>Resolution</Label>
            <Select
              value={project.exportSettings.resolution}
              disabled={isExporting}
              onValueChange={(resolution) =>
                dispatch({
                  type: 'SET_EXPORT_SETTINGS',
                  settings: {
                    resolution: resolution as CaptureProject['exportSettings']['resolution'],
                  },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original">Original</SelectItem>
                <SelectItem value="1920x1080">1920×1080</SelectItem>
                <SelectItem value="1280x720">1280×720</SelectItem>
                <SelectItem value="1080x1080">1080×1080</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!isVideo && (
            <div className="space-y-2">
              <Label>PNG background</Label>
              <Select
                value={project.exportSettings.background}
                disabled={isExporting}
                onValueChange={(background) =>
                  dispatch({
                    type: 'SET_EXPORT_SETTINGS',
                    settings: {
                      background: background as 'solid' | 'transparent',
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="transparent">Transparent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{exportLabel}</span>
                <span className="font-mono">{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} />
              {isVideo && (
                <Button variant="outline" size="sm" onClick={cancelExport}>
                  Cancel export
                </Button>
              )}
            </div>
          )}

          {lastExportInfo && (
            <p className="text-xs text-muted-foreground">Last export: {lastExportInfo}</p>
          )}

          <div className="flex flex-col gap-2">
            {isVideo && (
              <Button disabled={isExporting} onClick={() => void handleExportVideo()}>
                <Download className="size-4" />
                Export WebM
              </Button>
            )}
            <Button
              variant={isVideo ? 'secondary' : 'default'}
              disabled={isExporting}
              onClick={() => void handleExportPng()}
            >
              <Download className="size-4" />
              {isVideo ? 'Save current frame as PNG' : 'Export PNG'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Export bakes overlays into the file. WebM uses VP9/VP8 when available. MP4 is not
            offered in this MVP.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <Atmosphere intensity="studio" />

      <header className="relative z-10 flex items-center gap-3 border-b border-white/[0.06] bg-panel/50 px-4 py-2.5 backdrop-blur-md animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => setConfirmExit(true)} disabled={isExporting}>
          <ArrowLeft className="size-4" />
          Home
        </Button>
        <Separator orientation="vertical" className="h-5 bg-white/10" />
        <div className="min-w-0 flex-1">
          <Input
            value={project.name}
            disabled={isExporting}
            onChange={(e) => dispatch({ type: 'SET_NAME', name: e.target.value })}
            className="h-8 border-transparent bg-transparent px-1 font-display text-base font-semibold tracking-tight focus-visible:border-border"
            aria-label="Project name"
          />
        </div>
        <Badge variant="outline" className="border-white/10 bg-white/[0.03]">
          {isVideo ? 'Video' : 'Screenshot'}
        </Badge>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {project.media.width}×{project.media.height}
        </Badge>
      </header>

      <p className="relative z-10 border-b border-white/[0.06] bg-panel-muted/80 px-4 py-2 text-xs text-muted-foreground lg:hidden">
        Recording and editing work best on desktop.
      </p>

      <div className="relative z-10 hidden min-h-0 flex-1 lg:block">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={70} minSize={48}>
            <EditorStage
              project={project}
              currentTimeMs={currentTimeMs}
              reducedMotion={reducedMotion}
              isPlaying={isPlaying}
              isVideo={isVideo}
              durationMs={durationMs}
              selectedEventId={selectedEventId}
              isExporting={isExporting}
              videoRef={videoRef}
              imageRef={imageRef}
              onPlay={() => void play()}
              onPause={pause}
              onSeek={seek}
              onSelectEvent={(id) => dispatch({ type: 'SELECT_EVENT', id })}
              onCanvasClick={addClickAt}
            />
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-white/[0.04]" />
          <ResizablePanel defaultSize={30} minSize={22}>
            <div className="h-full overflow-auto border-l border-white/[0.06] bg-panel/70 p-4 backdrop-blur-sm">
              {inspector}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="min-h-0 flex-1">
          <EditorStage
            project={project}
            currentTimeMs={currentTimeMs}
            reducedMotion={reducedMotion}
            isPlaying={isPlaying}
            isVideo={isVideo}
            durationMs={durationMs}
            selectedEventId={selectedEventId}
            isExporting={isExporting}
            videoRef={videoRef}
            imageRef={imageRef}
            onPlay={() => void play()}
            onPause={pause}
            onSeek={seek}
            onSelectEvent={(id) => dispatch({ type: 'SELECT_EVENT', id })}
            onCanvasClick={addClickAt}
          />
        </div>
        <div className="max-h-[42vh] overflow-auto border-t border-white/[0.06] bg-panel/80 p-4 backdrop-blur-sm">
          {inspector}
        </div>
      </div>

      {/* Hidden media elements */}
      {isVideo ? (
        <video ref={videoRef} className="hidden" preload="auto" playsInline muted />
      ) : (
        <img ref={imageRef} alt="" className="hidden" />
      )}

      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this project?</AlertDialogTitle>
            <AlertDialogDescription>
              Your recording and annotations are only in memory. Leaving home will discard this
              session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                revokeObjectUrl(project.media.objectUrl)
                onExit()
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EditorStage(props: {
  project: CaptureProject
  currentTimeMs: number
  reducedMotion: boolean
  isPlaying: boolean
  isVideo: boolean
  durationMs: number
  selectedEventId: string | null
  isExporting: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  onPlay: () => void
  onPause: () => void
  onSeek: (ms: number) => void
  onSelectEvent: (id: string) => void
  onCanvasClick: (x: number, y: number) => void
}) {
  return (
    <div className="flex h-full flex-col gap-3 p-3 sm:p-4">
      <PreviewCanvas
        project={props.project}
        timeMs={props.currentTimeMs}
        reducedMotion={props.reducedMotion}
        videoRef={props.videoRef}
        imageRef={props.imageRef}
        onCanvasClick={props.onCanvasClick}
        interactive={!props.isExporting}
        className="min-h-0 flex-1 stage-frame !rounded-xl border-white/[0.06]"
      />
      {props.isVideo && (
        <div className="space-y-3 rounded-xl border border-white/[0.06] bg-panel/55 p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {props.isPlaying ? (
              <Button size="sm" variant="secondary" onClick={props.onPause} disabled={props.isExporting}>
                <Pause className="size-4" />
                Pause
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={props.onPlay} disabled={props.isExporting}>
                <Play className="size-4" />
                Play
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="border-white/10"
              disabled={props.isExporting}
              onClick={() => props.onCanvasClick(0.5, 0.5)}
            >
              <Plus className="size-4" />
              Add click at center
            </Button>
            <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
              Pause and click the stage to place a marker
            </p>
          </div>
          <TimelineBar
            durationMs={props.durationMs}
            currentTimeMs={props.currentTimeMs}
            events={props.project.events}
            selectedEventId={props.selectedEventId}
            onSeek={props.onSeek}
            onSelectEvent={props.onSelectEvent}
            disabled={props.isExporting}
          />
        </div>
      )}
    </div>
  )
}

function EventInspector({
  event,
  isVideo,
  disabled,
  onChange,
  onDelete,
}: {
  event: DemoEvent
  isVideo: boolean
  disabled: boolean
  onChange: (patch: Partial<DemoEvent>) => void
  onDelete: () => void
}) {
  if (event.type === 'click') {
    const click = event as ClickEvent
    return (
      <div className="space-y-3 rounded-md border border-border p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Click event</p>
          <Badge variant={click.source === 'enhanced' ? 'success' : 'outline'}>
            {click.source}
          </Badge>
        </div>
        <div className="space-y-2">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            value={click.label}
            disabled={disabled}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>
        {isVideo && (
          <>
            <div className="space-y-2">
              <Label>Start (ms)</Label>
              <Input
                type="number"
                value={Math.round(click.startTimeMs)}
                disabled={disabled}
                onChange={(e) => onChange({ startTimeMs: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ring duration (ms)</Label>
              <Input
                type="number"
                value={click.ringDurationMs}
                disabled={disabled}
                onChange={(e) => onChange({ ringDurationMs: Number(e.target.value) })}
              />
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <Label htmlFor="zoom">Zoom</Label>
          <Switch
            id="zoom"
            checked={click.zoomEnabled}
            disabled={disabled}
            onCheckedChange={(zoomEnabled) => onChange({ zoomEnabled })}
          />
        </div>
        {click.zoomEnabled && (
          <div className="space-y-2">
            <Label>Zoom strength ({click.zoomStrength.toFixed(2)}×)</Label>
            <Slider
              value={[click.zoomStrength]}
              min={1.02}
              max={1.35}
              step={0.01}
              disabled={disabled}
              onValueChange={([zoomStrength]) => onChange({ zoomStrength })}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label>Label position</Label>
          <Select
            value={click.labelPosition}
            disabled={disabled}
            onValueChange={(labelPosition) =>
              onChange({ labelPosition: labelPosition as CardPosition })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  'top-left',
                  'top-center',
                  'top-right',
                  'bottom-left',
                  'bottom-center',
                  'bottom-right',
                ] as const
              ).map((pos) => (
                <SelectItem key={pos} value={pos}>
                  {pos}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="destructive" size="sm" disabled={disabled} onClick={onDelete}>
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>
    )
  }

  if (event.type === 'text-card') {
    const card = event as TextCardEvent
    return (
      <div className="space-y-3 rounded-md border border-border p-3">
        <p className="text-sm font-medium">Text card</p>
        <Textarea
          value={card.text}
          disabled={disabled}
          onChange={(e) => onChange({ text: e.target.value })}
        />
        {isVideo && (
          <>
            <div className="space-y-2">
              <Label>Start (ms)</Label>
              <Input
                type="number"
                value={Math.round(card.startTimeMs)}
                disabled={disabled}
                onChange={(e) => onChange({ startTimeMs: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (ms)</Label>
              <Input
                type="number"
                value={card.durationMs}
                disabled={disabled}
                onChange={(e) => onChange({ durationMs: Number(e.target.value) })}
              />
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label>Position</Label>
          <Select
            value={card.position}
            disabled={disabled}
            onValueChange={(position) => onChange({ position: position as CardPosition })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  'top-left',
                  'top-center',
                  'top-right',
                  'bottom-left',
                  'bottom-center',
                  'bottom-right',
                ] as const
              ).map((pos) => (
                <SelectItem key={pos} value={pos}>
                  {pos}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="destructive" size="sm" disabled={disabled} onClick={onDelete}>
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-medium">Freeze marker (experimental)</p>
      <div className="space-y-2">
        <Label>Start (ms)</Label>
        <Input
          type="number"
          value={Math.round(event.startTimeMs)}
          disabled={disabled}
          onChange={(e) => onChange({ startTimeMs: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-2">
        <Label>Hold duration (ms)</Label>
        <Input
          type="number"
          value={event.durationMs}
          disabled={disabled}
          onChange={(e) => onChange({ durationMs: Number(e.target.value) })}
        />
      </div>
      <Button variant="destructive" size="sm" disabled={disabled} onClick={onDelete}>
        <Trash2 className="size-3.5" />
        Delete
      </Button>
    </div>
  )
}
