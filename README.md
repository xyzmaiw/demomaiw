# demomaiw

Browser-only product demo recorder for indie developers.

Record a tab, window, or screen. Add click highlights, zooms, and step cards. Export a polished silent WebM or MP4 — or annotate a screenshot and download a PNG. Everything stays on your device.

![demomaiw editor placeholder](docs/screenshot-placeholder.svg)

## Features

- **Record a demo** with `getDisplayMedia` + `MediaRecorder` (no mic, no system audio)
- **Take a screenshot** from the same capture sources
- **Review editor** with click markers, text cards, optional freeze markers, crop, and aspect ratios
- **Manual annotations** by clicking the preview
- **Enhanced mode** via an optional companion script for automatic click rings, zooms, and step labels
- **Built-in sample product** for end-to-end Enhanced testing
- **Export WebM or MP4** with baked-in overlays (canvas `captureStream` + MediaRecorder; Auto prefers MP4/H.264 when the browser supports it)
- **Export PNG** for screenshots and current video frames
- **Privacy-first**: no backend, no accounts, no uploads, no AI

## Privacy

Captured media never leaves the device. There is no server, no cloud processing, and no analytics. The optional companion script sends only safe click metadata (coordinates, tag, aria-label, title, trimmed visible text, bounding rect, viewport size) over `BroadcastChannel` / `postMessage`. It never collects form values, passwords, selected text, cookies, storage, page HTML, or auth tokens.

## Browser support

Designed primarily for **Chrome** and **Edge** on desktop.

Requires:

- `navigator.mediaDevices.getDisplayMedia`
- `MediaRecorder` with a video codec (capture prefers H.264/MP4 for smoother recording, then VP9/AV1/VP8; video-only, no audio)
- `HTMLCanvasElement.captureStream` for polished video export

Firefox/Safari may lack codecs or capture behavior needed for the full loop. Safari typically records/exports **MP4 (H.264)**; Chrome/Edge often offer **WebM (VP9/AV1)** and may also support **MP4**. The app feature-detects APIs and shows clear errors when unsupported.

**Honest limitation:** a normal display capture stream does **not** expose DOM click events from another tab. Automatic click capture only works when the recorded page includes the companion script and can communicate with the recorder (same-origin `BroadcastChannel`, or `postMessage` where an opener relationship exists). Cross-origin pages you do not control cannot send Enhanced events.

## Recording flow

1. Click **Record a demo**
2. Choose **Standard** or **Enhanced** click capture (Enhanced offers a console snippet to paste)
3. Pick aspect ratio, then **Share tab & auto-start**
4. Choose a browser tab, window, or screen
5. Chrome may focus the shared tab — recording **auto-starts after a 3-second countdown** (no need to return and press Start). A floating control window opens when Document Picture-in-Picture is available.
6. Pause / resume / stop from demomaiw, the floating control, or the browser’s stop-sharing bar
7. Review in the editor, add events, export WebM or MP4

## Screenshot flow

1. Click **Take a screenshot**
2. Choose a capture source
3. Click **Take screenshot**
4. Annotate with click rings and text cards
5. Export PNG

In the video editor, use **Save current frame as PNG** to export a still with overlays.

## Manual event creation

- Pause on a frame and click the preview to add a click marker
- Add text cards from the inspector
- Edit labels, timing, duration, zoom, and card position
- Select events from the marker bar or event list
- Delete events when needed

## Automatic click capture (Enhanced mode)

1. Open **Enhanced click capture** and start listening
2. Prefer **Paste into DevTools console**: copy the self-contained snippet, open your product (from demomaiw if cross-origin), paste in that tab’s console
3. Or open the sample product / install the companion script with the same session id
4. Record that tab and click through the UI
5. Automatic click rings, subtle zooms (~1.12×), and editable step labels appear in review

Label priority: `aria-label` → visible text → `title` → humanized tag name.

### Console paste (recommended for demos)

Enhanced setup provides a **self-contained console snippet** with your session id baked in. Paste it into the product page DevTools console — no script tag and no network load required.

For **cross-origin** products, open the page from demomaiw first (so `window.opener` exists), then paste. Same-origin pages can use `BroadcastChannel` without an opener.

### Companion script installation

Serve `/capture-client.js` from this deployment and include:

```html
<script>
  window.DEMOMAIW_CAPTURE = {
    sessionId: "YOUR_SESSION_ID",
    recorderOrigin: "https://your-recorder-origin",
    autoConnect: true
  };
</script>
<script src="https://your-pages-host/capture-client.js"></script>
```

Remove the script from production if you do not want it permanently included.

Communication uses `BroadcastChannel` (`demomaiw-capture`) when available, plus `window.postMessage` to `window.opener` when present. Same-origin sample testing and console-paste workflows work best. Do not expect cross-origin messaging without an opener relationship or an installed companion on a page you control.

## Local development

```bash
corepack enable
pnpm install
pnpm dev
```

Other commands:

```bash
pnpm lint
pnpm test
pnpm build
pnpm preview
```

Use **pnpm only**. Do not use npm or Yarn.

## GitHub Pages deployment

1. Enable GitHub Pages with **GitHub Actions** as the source
2. Push to `main` (or run the **Deploy GitHub Pages** workflow manually)
3. The workflow runs `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, and `pnpm build`
4. Build output in `dist/` is deployed

Base path defaults to `/<repository-name>/` in CI via `VITE_BASE_PATH`. For a user/org root site, set `VITE_BASE_PATH=/`.

Local production preview with a subpath:

```bash
VITE_BASE_PATH=/demomaiw/ pnpm build
pnpm preview
```

Navigation uses in-app view state (no server rewrite required). The sample product lives at `/sample/`.

## Architecture overview

```
src/
  app/                 # App shell / view routing
  components/ui/       # shadcn/ui primitives (custom maiw theme)
  features/
    capture/           # display media + MediaRecorder
    screenshot/        # frame capture
    editor/            # project reducer, preview canvas, timeline
    export/            # shared renderer + WebM/MP4/PNG export
    enhanced-capture/  # companion session + transports
  lib/                 # pure helpers (labels, validation, aspect, animations)
  pages/               # Home, record, screenshot, editor, enhanced setup
  types/               # shared TypeScript types
public/
  capture-client.js    # companion script
  sample/              # built-in sample product
```

Shared canvas rendering powers preview and export so overlays match as closely as practical.

## Current limitations

- No GIF export; video is WebM and/or MP4 via native MediaRecorder (no ffmpeg.wasm)
- No project persistence across reloads
- Enhanced clicks require the companion script and workable same-origin / messaging constraints
- Freeze markers are experimental
- Desktop Chrome/Edge recommended; Safari works when MP4 MediaRecorder is available
- Video export re-encodes by playing the recording once (sharper than seek-per-frame); takes roughly the media duration
- Audio is never captured (silent demos only)
- Capture quality still depends on the browser/OS encoder — share a **tab** at full size when possible for the sharpest result

## Manual QA checklist

See [docs/MANUAL_QA.md](docs/MANUAL_QA.md).

## Roadmap

- Better crop dragging on the preview
- Keyboard shortcuts for playhead and markers
- Optional local project save/export as JSON sidecar
- Improved freeze-marker timeline mapping UX
- Optional rounded device frames / padding presets

## License

MIT — see [LICENSE](LICENSE).
