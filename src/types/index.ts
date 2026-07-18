export type ProjectAspectRatio = 'original' | '16:9' | '4:3' | '1:1'

export type FrameMode = 'fit' | 'fill'

export type CardPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type EventSource = 'manual' | 'enhanced'

export type MediaKind = 'video' | 'screenshot'

export interface CropState {
  /** Focal point X in source coords, 0–1 */
  focalX: number
  /** Focal point Y in source coords, 0–1 */
  focalY: number
}

export interface RecordedMedia {
  kind: 'video'
  blob: Blob
  objectUrl: string
  mimeType: string
  width: number
  height: number
  durationMs: number
  createdAt: number
}

export interface ScreenshotMedia {
  kind: 'screenshot'
  blob: Blob
  objectUrl: string
  width: number
  height: number
  createdAt: number
}

export type ProjectMedia = RecordedMedia | ScreenshotMedia

export interface ClickSourceMetadata {
  visibleText?: string
  ariaLabel?: string
  title?: string
  tagName?: string
  boundingRect?: {
    x: number
    y: number
    width: number
    height: number
  }
  viewportWidth?: number
  viewportHeight?: number
}

export interface ClickEvent {
  id: string
  type: 'click'
  x: number
  y: number
  startTimeMs: number
  ringDurationMs: number
  zoomEnabled: boolean
  zoomStrength: number
  zoomHoldDurationMs: number
  label: string
  labelPosition: CardPosition
  source: EventSource
  sourceMetadata?: ClickSourceMetadata
}

export interface TextCardEvent {
  id: string
  type: 'text-card'
  text: string
  startTimeMs: number
  durationMs: number
  position: CardPosition
}

export interface FreezeEvent {
  id: string
  type: 'freeze'
  startTimeMs: number
  durationMs: number
  experimental: true
}

export type DemoEvent = ClickEvent | TextCardEvent | FreezeEvent

/** Video export container preference. Auto prefers MP4 when the browser can encode it. */
export type VideoExportFormat = 'auto' | 'mp4' | 'webm'

export interface ExportSettings {
  resolution: 'original' | '1920x1080' | '1280x720' | '1080x1080'
  fps: 30
  format: VideoExportFormat | 'png'
  roundedFrame: boolean
  background: 'solid' | 'transparent'
  backgroundColor: string
}

export interface CaptureProject {
  id: string
  name: string
  media: ProjectMedia
  events: DemoEvent[]
  aspectRatio: ProjectAspectRatio
  /** fit = letterbox full page (default). fill = crop to cover. */
  frameMode: FrameMode
  crop: CropState
  exportSettings: ExportSettings
  createdAt: number
}

export interface EditorState {
  currentTimeMs: number
  isPlaying: boolean
  selectedEventId: string | null
  isExporting: boolean
  exportProgress: number
  reducedMotion: boolean
}

export type AppView =
  | 'home'
  | 'recording-setup'
  | 'recording'
  | 'screenshot-setup'
  | 'editor'
  | 'enhanced-setup'

export interface CaptureClientClickPayload {
  type: 'DEMOMAIW_CLICK_EVENT'
  version: number
  sessionId: string
  timestamp: number
  x: number
  y: number
  visibleText: string
  ariaLabel: string
  title: string
  tagName: string
  boundingRect: {
    x: number
    y: number
    width: number
    height: number
  }
  viewportWidth: number
  viewportHeight: number
}

export interface CaptureClientHandshake {
  type: 'DEMOMAIW_HANDSHAKE'
  version: number
  sessionId: string
  role: 'client' | 'recorder'
}

export interface CaptureClientReady {
  type: 'DEMOMAIW_READY'
  version: number
  sessionId: string
}

export interface CaptureClientDisconnect {
  type: 'DEMOMAIW_DISCONNECT'
  version: number
  sessionId: string
}

export type CaptureClientMessage =
  | CaptureClientClickPayload
  | CaptureClientHandshake
  | CaptureClientReady
  | CaptureClientDisconnect

export type CaptureConnectionStatus =
  | 'idle'
  | 'waiting'
  | 'connected'
  | 'disconnected'

export interface CaptureConnection {
  sessionId: string
  status: CaptureConnectionStatus
  connectedAt: number | null
  lastEventAt: number | null
}

export interface RenderFrameContext {
  timeMs: number
  sourceWidth: number
  sourceHeight: number
  outputWidth: number
  outputHeight: number
  aspectRatio: ProjectAspectRatio
  frameMode: FrameMode
  crop: CropState
  events: DemoEvent[]
  reducedMotion: boolean
  backgroundColor: string
  roundedFrame: boolean
  mediaKind: MediaKind
}

export interface BrowserCapabilities {
  getDisplayMedia: boolean
  mediaRecorder: boolean
  canvasCaptureStream: boolean
  broadcastChannel: boolean
  webmAv1: boolean
  webmVp9: boolean
  webmVp8: boolean
  webm: boolean
  mp4Avc: boolean
  mp4: boolean
  preferredMimeType: string | null
  preferredExportMimeType: string | null
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}
