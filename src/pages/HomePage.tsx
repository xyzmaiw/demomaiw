import { useEffect, useState } from 'react'
import { Camera, CircleDot, Info, MonitorPlay, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { detectBrowserCapabilities, describeCapabilityGaps } from '@/lib/capabilities'
import { withBase } from '@/lib/utils'

interface HomePageProps {
  sessionId: string
  onRecord: () => void
  onScreenshot: () => void
  onEnhancedSetup: () => void
}

export function HomePage({ sessionId, onRecord, onScreenshot, onEnhancedSetup }: HomePageProps) {
  const [gaps, setGaps] = useState<string[]>([])

  useEffect(() => {
    const caps = detectBrowserCapabilities()
    setGaps(describeCapabilityGaps(caps))
  }, [])

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-10">
      <header className="mb-10 animate-fade-in">
        <p className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          demomaiw
        </p>
        <p className="mt-3 max-w-xl text-base text-muted-foreground">
          Record your product. Add click highlights, zooms, and step cards. Export a polished demo
          without opening a video editor.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <Shield className="size-3" />
            Everything stays on your device
          </Badge>
          <Badge variant="outline">No account · No uploads · No AI</Badge>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          className="h-14 justify-start gap-3 text-base"
          onClick={onRecord}
          disabled={gaps.some((g) => g.includes('Screen capture'))}
        >
          <MonitorPlay className="size-5" />
          Record a demo
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-14 justify-start gap-3 text-base"
          onClick={onScreenshot}
          disabled={gaps.some((g) => g.includes('Screen capture'))}
        >
          <Camera className="size-5" />
          Take a screenshot
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <Button variant="outline" size="sm" asChild>
          <a
            href={`${withBase('/sample/')}?session=${encodeURIComponent(sessionId)}`}
            target="_blank"
            rel="noreferrer"
          >
            <CircleDot className="size-3.5" />
            Try with sample product
          </a>
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Info className="size-3.5" />
              Enhanced click capture
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enhanced click capture</DialogTitle>
              <DialogDescription>
                Optional companion script for automatic click rings, zooms, and step cards. The app
                works fully without it — you can always add markers manually during review.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                A normal screen recording cannot read DOM clicks from another tab. Enhanced mode uses
                a tiny same-origin companion script that sends safe click metadata via BroadcastChannel
                or postMessage.
              </p>
              <p>
                Cross-origin capture targets cannot send click events unless you control that page and
                install the script with a matching session id.
              </p>
              <Button onClick={onEnhancedSetup}>Open Enhanced setup</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {gaps.length > 0 && (
        <div
          role="alert"
          className="mt-8 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          <p className="font-medium">Limited browser support</p>
          <ul className="mt-1 list-disc pl-5 text-amber-100/80">
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-10 text-xs text-muted-foreground">
        Designed for Chrome and Edge on desktop. Recording and editing work best on a wide screen.
      </p>
    </div>
  )
}
