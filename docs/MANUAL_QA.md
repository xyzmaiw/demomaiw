# Manual QA checklist

Browser media features cannot be fully automated. Run these on Chrome desktop (and Edge when possible).

## Capture

- [ ] Record a browser tab
- [ ] Record a window
- [ ] Confirm Enhanced vs Standard prompt appears before sharing
- [ ] After sharing a tab, confirm countdown auto-starts (no manual Start required)
- [ ] Confirm floating PiP controls appear on Chromium when supported
- [ ] Stop capture from browser chrome
- [ ] Pause and resume during recording
- [ ] Cancel the screen-selection prompt and see a clear message

## Editor (video)

- [ ] Manually add a click event by clicking the paused preview
- [ ] Edit a click label
- [ ] Add and edit a text card
- [ ] Scrub the progress bar and select markers
- [ ] Toggle zoom and adjust strength
- [ ] Change aspect ratio and crop focal point

## Screenshot

- [ ] Take a screenshot from a selected source
- [ ] Annotate with click rings and text cards
- [ ] Export PNG
- [ ] Save current video frame as PNG

## Export

- [ ] Export WebM with overlays baked in
- [ ] Confirm export progress updates
- [ ] Cancel an in-progress WebM export
- [ ] Confirm file downloads with a sensible name and non-zero size

## Enhanced mode

- [ ] Open Enhanced setup and start listening
- [ ] Copy the DevTools console snippet
- [ ] Open sample product from demomaiw and confirm connection (or paste console snippet)
- [ ] Open a cross-origin URL from Enhanced setup, paste console snippet, confirm connection when opener exists
- [ ] Record the sample tab and click UI controls
- [ ] Receive automatic click events with rings, zoom, and editable labels
- [ ] Disconnect companion and confirm events stop

## Accessibility / polish

- [ ] Reduced-motion preference shows restrained ring/zoom preview
- [ ] Keyboard focus is visible on primary controls
- [ ] GitHub Pages deployment serves the app, `/sample/`, and `/capture-client.js`

## Browsers

- [ ] Chrome desktop
- [ ] Edge desktop
