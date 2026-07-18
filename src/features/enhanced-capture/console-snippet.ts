/**
 * Builds a self-contained snippet that can be pasted into a page's DevTools console.
 * No network fetch — works without installing a script tag.
 */
export function buildConsolePasteSnippet(options: {
  sessionId: string
  recorderOrigin: string
}): string {
  const sessionId = sanitizeForJsString(options.sessionId)
  const recorderOrigin = sanitizeForJsString(options.recorderOrigin)

  return `/* demomaiw Enhanced capture — paste into the product page DevTools console */
(() => {
  const PROTOCOL_VERSION = 1;
  const CHANNEL_NAME = "demomaiw-capture";
  const MAX_TEXT = 200;
  const DEDUPE_MS = 40;
  const sessionId = "${sessionId}";
  const recorderOrigin = "${recorderOrigin}";
  const SENSITIVE_RE = /password|passwd|secret|token|api[_-]?key|auth|credential/i;
  const INTERACTIVE = 'button, a, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="option"], summary, input[type="button"], input[type="submit"], input[type="reset"]';

  if (window.demomaiwCapture && typeof window.demomaiwCapture.disconnect === "function") {
    try { window.demomaiwCapture.disconnect(); } catch (_) {}
  }

  let channel = null;
  let connected = false;
  let lastClickKey = "";
  let lastClickAt = 0;
  let startedAt = 0;
  let handshakeTimer = null;

  const clampString = (value, max) => {
    if (typeof value !== "string") return "";
    const cleaned = value.replace(/\\s+/g, " ").trim();
    return cleaned.length <= max ? cleaned : cleaned.slice(0, max - 1).trim() + "…";
  };

  const isSensitive = (el) => {
    if (!el || !el.tagName) return true;
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.getAttribute && el.getAttribute("contenteditable") === "true") return true;
    const type = ((el.getAttribute && el.getAttribute("type")) || "").toLowerCase();
    if (type === "password" || type === "hidden") return true;
    const meta = [
      (el.getAttribute && el.getAttribute("name")) || "",
      (el.getAttribute && el.getAttribute("id")) || "",
      (el.getAttribute && el.getAttribute("autocomplete")) || "",
    ].join(" ");
    return SENSITIVE_RE.test(meta);
  };

  const findTarget = (target) => {
    if (!target || !target.closest) return null;
    const interactive = target.closest(INTERACTIVE);
    if (interactive && !isSensitive(interactive)) return interactive;
    if (isSensitive(target)) return null;
    return target;
  };

  const safeVisibleText = (el) => {
    if (isSensitive(el)) return "";
    if (el.closest && el.closest('input, textarea, [contenteditable="true"]')) return "";
    return clampString(el.textContent || "", MAX_TEXT);
  };

  const post = (message) => {
    if (channel) {
      try { channel.postMessage(message); } catch (_) {}
    }
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(message, recorderOrigin === "*" ? "*" : recorderOrigin);
      }
    } catch (_) {}
    try {
      window.postMessage(message, recorderOrigin === "*" ? "*" : recorderOrigin);
    } catch (_) {}
  };

  const sendHandshake = () => {
    post({ type: "DEMOMAIW_HANDSHAKE", version: PROTOCOL_VERSION, sessionId, role: "client" });
  };

  const sendReady = () => {
    post({ type: "DEMOMAIW_READY", version: PROTOCOL_VERSION, sessionId });
  };

  const onClick = (event) => {
    if (!connected || !event.isTrusted) return;
    const el = findTarget(event.target);
    if (!el) return;
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const x = Math.min(1, Math.max(0, event.clientX / vw));
    const y = Math.min(1, Math.max(0, event.clientY / vh));
    const key = x.toFixed(3) + ":" + y.toFixed(3) + ":" + (el.tagName || "");
    const now = Date.now();
    if (key === lastClickKey && now - lastClickAt < DEDUPE_MS) return;
    lastClickKey = key;
    lastClickAt = now;
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };
    let aria = clampString((el.getAttribute && el.getAttribute("aria-label")) || "", MAX_TEXT);
    let title = clampString((el.getAttribute && el.getAttribute("title")) || "", MAX_TEXT);
    if (SENSITIVE_RE.test(aria) || SENSITIVE_RE.test(title)) { aria = ""; title = ""; }
    post({
      type: "DEMOMAIW_CLICK_EVENT",
      version: PROTOCOL_VERSION,
      sessionId,
      timestamp: startedAt ? now - startedAt : now,
      x, y,
      visibleText: safeVisibleText(el),
      ariaLabel: aria,
      title,
      tagName: String(el.tagName || "div").toLowerCase(),
      boundingRect: { x: rect.x || 0, y: rect.y || 0, width: rect.width || 0, height: rect.height || 0 },
      viewportWidth: vw,
      viewportHeight: vh,
    });
  };

  const onMessage = (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.version !== PROTOCOL_VERSION || data.sessionId !== sessionId) return;
    if (recorderOrigin !== "*" && event.origin && event.origin !== recorderOrigin) return;
    if (data.type === "DEMOMAIW_HANDSHAKE" && data.role === "recorder") {
      connected = true;
      startedAt = Date.now();
      if (handshakeTimer) { clearInterval(handshakeTimer); handshakeTimer = null; }
      sendReady();
      console.info("[demomaiw] Enhanced capture connected");
      return;
    }
    if (data.type === "DEMOMAIW_DISCONNECT") connected = false;
  };

  const disconnect = () => {
    connected = false;
    post({ type: "DEMOMAIW_DISCONNECT", version: PROTOCOL_VERSION, sessionId });
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("message", onMessage);
    if (handshakeTimer) { clearInterval(handshakeTimer); handshakeTimer = null; }
    if (channel) { try { channel.close(); } catch (_) {} channel = null; }
  };

  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => onMessage({ data: event.data, origin: "" });
    } catch (_) { channel = null; }
  }

  window.addEventListener("message", onMessage);
  window.addEventListener("click", onClick, true);
  window.demomaiwCapture = {
    connect: () => sendHandshake(),
    disconnect,
    isConnected: () => connected,
    getSessionId: () => sessionId,
  };

  sendHandshake();
  handshakeTimer = setInterval(() => { if (!connected) sendHandshake(); }, 1500);

  console.info("[demomaiw] Enhanced capture armed for session", sessionId);
  console.info("[demomaiw] Same-origin: BroadcastChannel. Cross-origin: open the page from demomaiw (opener) then paste this snippet.");
  return "demomaiw Enhanced capture ready";
})();`
}

export function sanitizeForJsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
}

export function buildCaptureLoaderSnippet(options: {
  baseUrl: string
  sessionId: string
  recorderOrigin: string
}): string {
  const sessionId = sanitizeForJsString(options.sessionId)
  const recorderOrigin = sanitizeForJsString(options.recorderOrigin)
  const scriptSrc = sanitizeForJsString(`${options.baseUrl.replace(/\/$/, '')}/capture-client.js`)

  return `/* demomaiw — load companion from deployment (console) */
(() => {
  window.DEMOMAIW_CAPTURE = {
    sessionId: "${sessionId}",
    recorderOrigin: "${recorderOrigin}",
    autoConnect: true,
  };
  const existing = document.querySelector('script[data-demomaiw-capture]');
  if (existing) existing.remove();
  const s = document.createElement("script");
  s.src = "${scriptSrc}";
  s.async = true;
  s.dataset.demomaiwCapture = "1";
  s.onload = () => console.info("[demomaiw] capture-client.js loaded");
  s.onerror = () => console.warn("[demomaiw] failed to load capture-client.js (cross-origin or blocked)");
  document.documentElement.appendChild(s);
  "demomaiw loader injected";
})();`
}
