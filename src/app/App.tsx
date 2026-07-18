import { useCallback, useEffect, useRef, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { HomePage } from '@/pages/HomePage'
import { RecordingFlow, type PendingEnhancedClick } from '@/pages/RecordingFlow'
import { ScreenshotFlow } from '@/pages/ScreenshotFlow'
import { EditorPage } from '@/pages/EditorPage'
import { EnhancedSetupPage } from '@/pages/EnhancedSetupPage'
import { EnhancedCaptureSession } from '@/features/enhanced-capture/session'
import { clickEventFromEnhanced } from '@/features/enhanced-capture/from-click'
import { generateEventLabel } from '@/lib/labels'
import { createId } from '@/lib/utils'
import type { AppView, CaptureConnection, CaptureProject } from '@/types'

export default function App() {
  const [view, setView] = useState<AppView>('home')
  const [project, setProject] = useState<CaptureProject | null>(null)
  const [sessionId] = useState(() => createId('session'))
  const [connection, setConnection] = useState<CaptureConnection>({
    sessionId,
    status: 'idle',
    connectedAt: null,
    lastEventAt: null,
  })

  const sessionRef = useRef<EnhancedCaptureSession | null>(null)
  const pendingEnhancedClicksRef = useRef<PendingEnhancedClick[]>([])
  const recordingActiveRef = useRef(false)
  const recordingStartedAtRef = useRef(0)

  useEffect(() => {
    const session = new EnhancedCaptureSession(sessionId)
    sessionRef.current = session
    const unsubStatus = session.onStatus(setConnection)
    const unsubClick = session.onClick((payload) => {
      if (!recordingActiveRef.current) return
      const timeMs = Math.max(0, performance.now() - recordingStartedAtRef.current)
      const label = generateEventLabel({
        ariaLabel: payload.ariaLabel,
        visibleText: payload.visibleText,
        title: payload.title,
        tagName: payload.tagName,
      })
      pendingEnhancedClicksRef.current.push({
        x: payload.x,
        y: payload.y,
        label,
        timeMs,
        metadata: {
          visibleText: payload.visibleText,
          ariaLabel: payload.ariaLabel,
          title: payload.title,
          tagName: payload.tagName,
          boundingRect: payload.boundingRect,
          viewportWidth: payload.viewportWidth,
          viewportHeight: payload.viewportHeight,
        },
      })
      // Also keep a typed event factory available for future live injection
      void clickEventFromEnhanced(payload, timeMs)
    })

    session.startListening()

    return () => {
      unsubStatus()
      unsubClick()
      session.close()
    }
  }, [sessionId])

  const goHome = useCallback(() => {
    recordingActiveRef.current = false
    setProject(null)
    setView('home')
  }, [])

  const handleRecordingComplete = useCallback((next: CaptureProject) => {
    recordingActiveRef.current = false
    setProject(next)
    setView('editor')
  }, [])

  return (
    <TooltipProvider delayDuration={200}>
      {view === 'home' && (
        <HomePage
          sessionId={sessionId}
          onRecord={() => setView('recording')}
          onScreenshot={() => setView('screenshot-setup')}
          onEnhancedSetup={() => setView('enhanced-setup')}
        />
      )}

      {view === 'recording' && (
        <RecordingFlow
          connection={connection}
          pendingEnhancedClicksRef={pendingEnhancedClicksRef}
          onCancel={goHome}
          onComplete={handleRecordingComplete}
          onRecordingStart={() => {
            recordingActiveRef.current = true
            recordingStartedAtRef.current = performance.now()
            sessionRef.current?.markRecordingStart(recordingStartedAtRef.current)
            pendingEnhancedClicksRef.current = []
          }}
        />
      )}

      {view === 'screenshot-setup' && (
        <ScreenshotFlow
          onCancel={goHome}
          onComplete={(next) => {
            setProject(next)
            setView('editor')
          }}
        />
      )}

      {view === 'editor' && project && (
        <EditorPage
          project={project}
          onChangeProject={setProject}
          onExit={goHome}
        />
      )}

      {view === 'enhanced-setup' && (
        <EnhancedSetupPage
          sessionId={sessionId}
          connection={connection}
          onBack={() => setView('home')}
          onDisconnect={() => sessionRef.current?.disconnect()}
          onStartListening={() => sessionRef.current?.startListening()}
        />
      )}

      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
