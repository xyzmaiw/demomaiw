import {
  CAPTURE_CHANNEL_NAME,
  CAPTURE_PROTOCOL_VERSION,
  validateCaptureMessage,
} from '@/lib/capture-validation'
import type {
  CaptureClientClickPayload,
  CaptureClientMessage,
  CaptureConnection,
  CaptureConnectionStatus,
} from '@/types'
import { createId } from '@/lib/utils'

export interface CaptureTransport {
  post: (message: CaptureClientMessage) => void
  subscribe: (handler: (message: CaptureClientMessage, origin?: string) => void) => () => void
  close: () => void
}

export function createBroadcastTransport(): CaptureTransport | null {
  if (typeof BroadcastChannel === 'undefined') return null
  const channel = new BroadcastChannel(CAPTURE_CHANNEL_NAME)
  return {
    post(message) {
      channel.postMessage(message)
    },
    subscribe(handler) {
      const listener = (event: MessageEvent) => {
        const validated = validateCaptureMessage(event.data)
        if (validated) handler(validated)
      }
      channel.addEventListener('message', listener)
      return () => channel.removeEventListener('message', listener)
    },
    close() {
      channel.close()
    },
  }
}

export function createWindowMessageTransport(targetOrigin = '*'): CaptureTransport {
  return {
    post(message) {
      window.postMessage(message, targetOrigin)
    },
    subscribe(handler) {
      const listener = (event: MessageEvent) => {
        const validated = validateCaptureMessage(event.data)
        if (validated) handler(validated, event.origin)
      }
      window.addEventListener('message', listener)
      return () => window.removeEventListener('message', listener)
    },
    close() {
      // no-op
    },
  }
}

export class EnhancedCaptureSession {
  sessionId: string
  connection: CaptureConnection
  private transports: CaptureTransport[] = []
  private unsubscribers: Array<() => void> = []
  private clickHandlers = new Set<(payload: CaptureClientClickPayload) => void>()
  private statusHandlers = new Set<(connection: CaptureConnection) => void>()
  private recordingStartedAt: number | null = null

  constructor(sessionId = createId('session')) {
    this.sessionId = sessionId
    this.connection = {
      sessionId,
      status: 'idle',
      connectedAt: null,
      lastEventAt: null,
    }
  }

  startListening(): void {
    this.close()
    const broadcast = createBroadcastTransport()
    if (broadcast) this.transports.push(broadcast)
    this.transports.push(createWindowMessageTransport())

    for (const transport of this.transports) {
      this.unsubscribers.push(
        transport.subscribe((message) => this.handleMessage(message)),
      )
    }

    this.setStatus('waiting')
    this.broadcastHandshake()
  }

  markRecordingStart(now = performance.now()): void {
    this.recordingStartedAt = now
  }

  getRecordingOffsetMs(eventTimestamp: number, now = performance.now()): number {
    // Companion timestamps are ms since client connect; fall back to recorder clock.
    if (this.recordingStartedAt == null) return Math.max(0, eventTimestamp)
    // Prefer wall-clock alignment using last known connection if timestamp looks absolute
    if (eventTimestamp > 1_000_000_000_000) {
      return Math.max(0, eventTimestamp - (Date.now() - (now - this.recordingStartedAt)))
    }
    // Relative timestamps from companion since its ready — approximate with recorder elapsed
    return Math.max(0, now - this.recordingStartedAt)
  }

  onClick(handler: (payload: CaptureClientClickPayload) => void): () => void {
    this.clickHandlers.add(handler)
    return () => this.clickHandlers.delete(handler)
  }

  onStatus(handler: (connection: CaptureConnection) => void): () => void {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  disconnect(): void {
    const message = {
      type: 'DEMOMAIW_DISCONNECT' as const,
      version: CAPTURE_PROTOCOL_VERSION,
      sessionId: this.sessionId,
    }
    for (const transport of this.transports) {
      transport.post(message)
    }
    this.setStatus('disconnected')
    this.close()
  }

  close(): void {
    for (const unsub of this.unsubscribers) unsub()
    this.unsubscribers = []
    for (const transport of this.transports) transport.close()
    this.transports = []
  }

  private broadcastHandshake(): void {
    const message = {
      type: 'DEMOMAIW_HANDSHAKE' as const,
      version: CAPTURE_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      role: 'recorder' as const,
    }
    for (const transport of this.transports) {
      transport.post(message)
    }
  }

  private handleMessage(message: CaptureClientMessage): void {
    if (message.sessionId !== this.sessionId) return

    if (message.type === 'DEMOMAIW_HANDSHAKE' && message.role === 'client') {
      this.setStatus('connected')
      this.broadcastHandshake()
      return
    }

    if (message.type === 'DEMOMAIW_READY') {
      this.setStatus('connected')
      return
    }

    if (message.type === 'DEMOMAIW_DISCONNECT') {
      this.setStatus('disconnected')
      return
    }

    if (message.type === 'DEMOMAIW_CLICK_EVENT') {
      if (this.connection.status !== 'connected') {
        this.setStatus('connected')
      }
      this.connection = {
        ...this.connection,
        lastEventAt: Date.now(),
      }
      this.emitStatus()
      for (const handler of this.clickHandlers) handler(message)
    }
  }

  private setStatus(status: CaptureConnectionStatus): void {
    this.connection = {
      ...this.connection,
      status,
      connectedAt:
        status === 'connected'
          ? this.connection.connectedAt ?? Date.now()
          : status === 'waiting'
            ? null
            : this.connection.connectedAt,
    }
    this.emitStatus()
  }

  private emitStatus(): void {
    for (const handler of this.statusHandlers) handler(this.connection)
  }
}

export function buildCaptureScriptSnippet(options: {
  baseUrl: string
  sessionId: string
  recorderOrigin: string
}): { scriptTag: string; esmHint: string } {
  const { baseUrl, sessionId, recorderOrigin } = options
  const scriptSrc = `${baseUrl.replace(/\/$/, '')}/capture-client.js`
  const scriptTag = `<script>
  window.DEMOMAIW_CAPTURE = {
    sessionId: "${sessionId}",
    recorderOrigin: "${recorderOrigin}",
    autoConnect: true
  };
</script>
<script src="${scriptSrc}"></script>`

  const esmHint = `// ESM-style include (still a classic script under the hood)
// 1. Set window.DEMOMAIW_CAPTURE before loading
// 2. import is not required — load ${scriptSrc}
window.DEMOMAIW_CAPTURE = {
  sessionId: "${sessionId}",
  recorderOrigin: "${recorderOrigin}",
  autoConnect: true,
};
// then: <script src="${scriptSrc}"></script>`

  return { scriptTag, esmHint }
}
