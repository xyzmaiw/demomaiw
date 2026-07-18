import { useEffect, useState } from 'react'
import { ArrowUpRight, Camera, CircleDot, Info, MonitorPlay, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Atmosphere } from '@/components/Atmosphere'
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

  const captureBlocked = gaps.some((g) => g.includes('Screen capture'))

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Atmosphere intensity="home" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-8">
        <div className="animate-fade-up">
          <p className="font-display text-5xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            demomaiw
          </p>
          <p className="mt-4 max-w-md text-base text-muted-foreground text-balance sm:text-lg">
            Record your product. Add click highlights, zooms, and step cards. Export a polished demo
            without opening a video editor.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="action-tile group animate-fade-up [animation-delay:80ms]"
              onClick={onRecord}
              disabled={captureBlocked}
            >
              <span className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-primary/15 text-primary">
                <MonitorPlay className="size-5" />
              </span>
              <span>
                <span className="block font-display text-lg font-semibold tracking-tight">
                  Record a demo
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Tab, window, or screen
                </span>
              </span>
              <ArrowUpRight className="absolute right-4 top-4 size-4 text-muted-foreground transition group-hover:text-primary" />
            </button>

            <button
              type="button"
              className="action-tile group animate-fade-up [animation-delay:140ms]"
              onClick={onScreenshot}
              disabled={captureBlocked}
            >
              <span className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-foreground">
                <Camera className="size-5" />
              </span>
              <span>
                <span className="block font-display text-lg font-semibold tracking-tight">
                  Take a screenshot
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Annotate and export PNG
                </span>
              </span>
              <ArrowUpRight className="absolute right-4 top-4 size-4 text-muted-foreground transition group-hover:text-foreground" />
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm animate-fade-up [animation-delay:200ms]">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Shield className="size-3.5 text-primary/80" />
              Everything stays on your device
            </span>
            <span className="text-white/20">·</span>
            <span className="text-muted-foreground">No account · No uploads · No AI</span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 animate-fade-up [animation-delay:260ms]">
            <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03]" asChild>
              <a
                href={`${withBase('/sample/')}?session=${encodeURIComponent(sessionId)}`}
                target="_blank"
                rel="opener"
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
                    Optional companion for automatic click rings, zooms, and step cards. The app
                    works fully without it — add markers manually during review anytime.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Screen capture cannot read DOM clicks from another tab. Enhanced mode sends safe
                    click metadata via BroadcastChannel or postMessage.
                  </p>
                  <p>
                    Fastest setup: paste the DevTools console snippet from Enhanced setup into the
                    product tab. For cross-origin pages, open the URL from demomaiw first.
                  </p>
                  <Button onClick={onEnhancedSetup}>Open Enhanced setup</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {gaps.length > 0 && (
            <div
              role="alert"
              className="mt-8 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 animate-fade-in"
            >
              <p className="font-medium">Limited browser support</p>
              <ul className="mt-1 list-disc pl-5 text-amber-100/80">
                {gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="relative hidden animate-scale-in [animation-delay:120ms] lg:block">
          <HomeStagePreview />
        </div>
      </div>

      <p className="absolute bottom-5 left-5 text-xs text-muted-foreground/70 sm:left-8">
        Chrome, Edge, Safari · WebM or MP4 · Best on a wide screen
      </p>
    </div>
  )
}

function HomeStagePreview() {
  return (
    <div className="relative">
      <div className="stage-frame aspect-[4/3] w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1524] via-[#0c0c10] to-[#08080c]" />
        <div className="absolute inset-6 rounded-lg border border-white/[0.07] bg-[#12131a]" />
        <div className="absolute left-10 top-10 h-3 w-24 rounded-sm bg-white/10" />
        <div className="absolute left-10 top-16 h-2 w-40 rounded-sm bg-white/5" />
        <div className="absolute bottom-16 left-10 right-10 grid grid-cols-3 gap-3">
          <div className="h-20 rounded-md border border-white/5 bg-white/[0.03]" />
          <div className="h-20 rounded-md border border-white/5 bg-white/[0.03]" />
          <div className="h-20 rounded-md border border-white/5 bg-white/[0.03]" />
        </div>

        {/* Animated click ring */}
        <div className="absolute left-[58%] top-[42%] -translate-x-1/2 -translate-y-1/2">
          <span className="absolute inset-0 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/80 animate-pulse-ring" />
          <span className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_20px_hsl(263_70%_58%/0.7)]" />
        </div>

        {/* Step card */}
        <div className="absolute bottom-10 right-10 max-w-[180px] animate-fade-up [animation-delay:400ms] rounded-lg border border-primary/30 bg-black/80 px-3 py-2 text-xs text-white/90 backdrop-blur-sm">
          Click Invite teammate
        </div>

        <div className="cinema-vignette absolute inset-0" />
      </div>

      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-3xl" />
    </div>
  )
}
