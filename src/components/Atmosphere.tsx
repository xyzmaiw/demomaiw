import { cn } from '@/lib/utils'

interface AtmosphereProps {
  className?: string
  intensity?: 'home' | 'studio' | 'capture'
}

/** Ambient light orbs for immersive dark scenes. Respects reduced motion via CSS. */
export function Atmosphere({ className, intensity = 'home' }: AtmosphereProps) {
  return (
    <div className={cn('atmosphere', className)} aria-hidden>
      <div
        className={cn(
          'atmosphere-orb bg-primary/25',
          intensity === 'home' && 'left-[12%] top-[-8%] size-[42vmax] animate-orb-drift',
          intensity === 'studio' && 'left-[8%] top-[-12%] size-[36vmax] animate-orb-drift opacity-70',
          intensity === 'capture' && 'left-[20%] top-[-10%] size-[48vmax] animate-orb-drift opacity-50',
        )}
      />
      <div
        className={cn(
          'atmosphere-orb bg-indigo-500/10',
          intensity === 'home' && 'bottom-[-10%] right-[-5%] size-[38vmax] animate-orb-drift-slow',
          intensity === 'studio' && 'bottom-[-15%] right-[-8%] size-[32vmax] animate-orb-drift-slow opacity-50',
          intensity === 'capture' && 'bottom-[-12%] right-[10%] size-[30vmax] animate-orb-drift-slow opacity-40',
        )}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(240_8%_3%/0.55)_100%)]" />
    </div>
  )
}

interface StageFrameProps {
  children: React.ReactNode
  className?: string
  live?: boolean
  recording?: boolean
  label?: string
}

export function StageFrame({
  children,
  className,
  live,
  recording,
  label,
}: StageFrameProps) {
  return (
    <div className={cn('stage-frame editor-checker', className)}>
      {(live || recording || label) && (
        <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-md border border-white/10 bg-black/55 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white/90 backdrop-blur-sm">
          {recording ? (
            <>
              <span className="rec-dot" />
              REC
            </>
          ) : live ? (
            <>
              <span className="size-1.5 rounded-full bg-emerald-400" />
              LIVE
            </>
          ) : null}
          {label ? <span className="text-white/60">{label}</span> : null}
        </div>
      )}
      {children}
      <div className="cinema-vignette pointer-events-none absolute inset-0 z-[5]" />
    </div>
  )
}
