import { getTimelineMarkerPercent } from '@/lib/animations'
import { formatDuration, cn } from '@/lib/utils'
import type { DemoEvent } from '@/types'

interface TimelineBarProps {
  durationMs: number
  currentTimeMs: number
  events: DemoEvent[]
  selectedEventId: string | null
  onSeek: (timeMs: number) => void
  onSelectEvent: (id: string) => void
  disabled?: boolean
}

export function TimelineBar({
  durationMs,
  currentTimeMs,
  events,
  selectedEventId,
  onSeek,
  onSelectEvent,
  disabled,
}: TimelineBarProps) {
  const progress = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono tabular-nums">{formatDuration(currentTimeMs)}</span>
        <span className="font-mono tabular-nums">{formatDuration(durationMs)}</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={0}
          max={Math.max(durationMs, 1)}
          step={16}
          value={Math.min(currentTimeMs, durationMs)}
          disabled={disabled || durationMs <= 0}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="relative z-10 h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-muted accent-primary disabled:opacity-50"
          aria-label="Playback position"
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-2 -translate-y-1/2 overflow-hidden rounded-full">
          <div
            className="h-full bg-primary/40"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-0">
          {events.map((event) => {
            const left = getTimelineMarkerPercent(
              event.type === 'text-card' || event.type === 'click' || event.type === 'freeze'
                ? event.startTimeMs
                : 0,
              durationMs,
            )
            const color =
              event.type === 'click'
                ? 'bg-[hsl(var(--timeline-marker))]'
                : event.type === 'text-card'
                  ? 'bg-sky-400'
                  : 'bg-amber-400'
            return (
              <button
                key={event.id}
                type="button"
                className={cn(
                  'pointer-events-auto absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background',
                  color,
                  selectedEventId === event.id && 'ring-2 ring-foreground',
                )}
                style={{ left: `${left}%` }}
                aria-label={`${event.type} marker at ${formatDuration(event.startTimeMs)}`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onSelectEvent(event.id)
                  onSeek(event.startTimeMs)
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
