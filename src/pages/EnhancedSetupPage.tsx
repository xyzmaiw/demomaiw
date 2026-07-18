import { useMemo, useState } from 'react'
import { ArrowLeft, Check, Copy, ExternalLink, Terminal, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Atmosphere } from '@/components/Atmosphere'
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

type CopyKey = 'console' | 'loader' | 'script' | 'esm'

export function EnhancedSetupPage({
  sessionId,
  connection,
  onBack,
  onDisconnect,
  onStartListening,
}: EnhancedSetupPageProps) {
  const [copied, setCopied] = useState<CopyKey | null>(null)
  const [productUrl, setProductUrl] = useState('https://')

  const snippets = useMemo(() => {
    const origin = window.location.origin
    const baseUrl = `${origin}${withBase('/')}`.replace(/\/$/, '') || origin
    return buildCaptureScriptSnippet({
      baseUrl,
      sessionId,
      recorderOrigin: origin,
    })
  }, [sessionId])

  const copy = async (text: string, key: CopyKey) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      toast.success('Copied to clipboard')
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  const openSample = () => {
    const url = `${window.location.origin}${withBase('/sample/')}?session=${encodeURIComponent(sessionId)}`
    // Named window without noopener so postMessage via window.opener works.
    window.open(url, 'demomaiw-sample')
  }

  const openProductUrl = () => {
    try {
      const url = new URL(productUrl)
      window.open(url.toString(), 'demomaiw-product')
      toast.message('Page opened — paste the console snippet there')
    } catch {
      toast.error('Enter a valid URL first')
    }
  }

  return (
    <div className="relative min-h-screen">
      <Atmosphere intensity="studio" />
      <div className="relative mx-auto w-full max-w-3xl px-4 py-8 animate-fade-up">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-6">
        <ArrowLeft className="size-4" />
        Back
      </Button>

      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Enhanced click capture
      </h1>
      <p className="mt-2 text-muted-foreground text-balance">
        Optional companion. Prefer pasting a console snippet while recording — no install required.
        The recorder still works fully in Standard mode without it.
      </p>

      <Card className="mt-6 border-white/[0.06] bg-panel/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
          <CardDescription>
            Same-origin uses BroadcastChannel. Cross-origin needs an opener relationship (open the
            page from demomaiw) plus the console snippet or installed script.
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
            <Button size="sm" variant="secondary" onClick={openSample}>
              <ExternalLink className="size-3.5" />
              Open sample product
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 border-primary/25 bg-panel/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="size-4 text-primary" />
            Paste into DevTools console
          </CardTitle>
          <CardDescription>
            Fastest path: start listening here → open your product (from demomaiw if cross-origin) →
            paste this snippet in that page’s console → record that tab and click.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-url">Open product URL from demomaiw</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="product-url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://your-app.example"
                className="font-mono text-xs"
              />
              <Button type="button" variant="secondary" onClick={openProductUrl}>
                <ExternalLink className="size-3.5" />
                Open
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Opening from here keeps <code className="text-[11px]">window.opener</code> so
              cross-origin <code className="text-[11px]">postMessage</code> can reach the recorder.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Self-contained console snippet</Label>
              <Button size="sm" onClick={() => void copy(snippets.consolePaste, 'console')}>
                {copied === 'console' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                Copy console script
              </Button>
            </div>
            <pre className="max-h-56 overflow-auto rounded-md border border-border bg-panel-muted p-3 text-[11px] leading-relaxed">
              {snippets.consolePaste}
            </pre>
          </div>

          <div className="rounded-md border border-border bg-panel-muted/50 p-3 text-sm text-muted-foreground">
            <ol className="list-decimal space-y-1 pl-4">
              <li>Click <strong className="text-foreground">Start listening</strong></li>
              <li>Open the sample or your product URL from this page</li>
              <li>In that tab: DevTools → Console → paste → Enter</li>
              <li>Return here, record that tab, click through the UI</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 border-white/[0.06] bg-panel/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Install on your product</CardTitle>
          <CardDescription>
            Permanent install is optional. Remove it from production if you do not want it included.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Session id</Label>
            <Input readOnly value={sessionId} className="font-mono text-xs" />
          </div>

          <Tabs defaultValue="script">
            <TabsList>
              <TabsTrigger value="script">Script tag</TabsTrigger>
              <TabsTrigger value="loader">Console loader</TabsTrigger>
              <TabsTrigger value="esm">ESM hint</TabsTrigger>
            </TabsList>
            <TabsContent value="script" className="space-y-2">
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => void copy(snippets.scriptTag, 'script')}>
                  {copied === 'script' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-md border border-border bg-panel-muted p-3 text-xs">
                {snippets.scriptTag}
              </pre>
            </TabsContent>
            <TabsContent value="loader" className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Loads <code>/capture-client.js</code> from this deployment. May be blocked on
                cross-origin pages by CSP — prefer the self-contained console snippet above.
              </p>
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => void copy(snippets.consoleLoader, 'loader')}>
                  {copied === 'loader' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-md border border-border bg-panel-muted p-3 text-xs">
                {snippets.consoleLoader}
              </pre>
            </TabsContent>
            <TabsContent value="esm" className="space-y-2">
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => void copy(snippets.esmHint, 'esm')}>
                  {copied === 'esm' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-md border border-border bg-panel-muted p-3 text-xs">
                {snippets.esmHint}
              </pre>
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            The companion never sends form values, passwords, selected text, cookies, storage, page
            HTML, or auth tokens. Only trusted clicks and safe element metadata.
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
