import { useMemo, useState } from 'react'
import { ArrowLeft, Check, Copy, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { buildCaptureScriptSnippet } from '@/features/enhanced-capture/session'
import { withBase } from '@/lib/utils'
import type { CaptureConnection } from '@/types'

interface EnhancedSetupPageProps {
  sessionId: string
  connection: CaptureConnection
  onBack: () => void
  onDisconnect: () => void
  onStartListening: () => void
}

export function EnhancedSetupPage({
  sessionId,
  connection,
  onBack,
  onDisconnect,
  onStartListening,
}: EnhancedSetupPageProps) {
  const [copied, setCopied] = useState<'script' | 'esm' | null>(null)

  const snippets = useMemo(() => {
    const origin = window.location.origin
    const baseUrl = `${origin}${withBase('/')}`.replace(/\/$/, '') || origin
    return buildCaptureScriptSnippet({
      baseUrl,
      sessionId,
      recorderOrigin: origin,
    })
  }, [sessionId])

  const copy = async (text: string, key: 'script' | 'esm') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      toast.success('Copied')
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-6">
        <ArrowLeft className="size-4" />
        Back
      </Button>

      <h1 className="font-display text-3xl font-semibold">Enhanced click capture</h1>
      <p className="mt-2 text-muted-foreground">
        Optional companion script. The recorder works fully without it — Enhanced mode only adds
        automatic click rings, zooms, and step labels.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
          <CardDescription>
            Same-origin sample testing uses BroadcastChannel. Cross-origin pages need the script
            installed and a matching session id. Direct cross-tab DOM access is not possible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                : connection.status === 'waiting'
                  ? 'Waiting for companion'
                  : connection.status}
            </Badge>
            <span className="text-xs text-muted-foreground">Session</span>
            <code className="rounded bg-panel-muted px-2 py-0.5 font-mono text-xs">{sessionId}</code>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onStartListening}>
              Start listening
            </Button>
            <Button size="sm" variant="outline" onClick={onDisconnect}>
              <Unplug className="size-3.5" />
              Disconnect
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <a
                href={`${withBase('/sample/')}?session=${encodeURIComponent(sessionId)}`}
                target="_blank"
                rel="noreferrer"
              >
                Open sample product
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Install on your product</CardTitle>
          <CardDescription>
            Remove this script from production if you do not want it permanently included.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Session id</Label>
            <Input readOnly value={sessionId} className="font-mono text-xs" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Script tag</Label>
              <Button size="sm" variant="ghost" onClick={() => void copy(snippets.scriptTag, 'script')}>
                {copied === 'script' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                Copy
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-md border border-border bg-panel-muted p-3 text-xs">
              {snippets.scriptTag}
            </pre>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>ESM-style setup</Label>
              <Button size="sm" variant="ghost" onClick={() => void copy(snippets.esmHint, 'esm')}>
                {copied === 'esm' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                Copy
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-md border border-border bg-panel-muted p-3 text-xs">
              {snippets.esmHint}
            </pre>
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            The companion never sends form values, passwords, selected text, cookies, storage, page
            HTML, or auth tokens. Only trusted clicks and safe element metadata.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
