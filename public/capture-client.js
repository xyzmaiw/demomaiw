/**
 * demomaiw capture companion client
 *
 * Optional script developers can add to the product they are recording.
 * Sends trusted click metadata to the recorder via BroadcastChannel and/or postMessage.
 *
 * Does NOT collect: form values, input/textarea contents, passwords, selected text,
 * cookies, storage, page HTML, auth tokens, or network requests.
 */
;(function demomaiwCaptureClient(global) {
  'use strict'

  var PROTOCOL_VERSION = 1
  var CHANNEL_NAME = 'demomaiw-capture'
  var MAX_TEXT = 200
  var DEDUPE_MS = 40

  var SENSITIVE_RE = /password|passwd|secret|token|api[_-]?key|auth|credential/i
  var INTERACTIVE =
    'button, a, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="option"], summary, input[type="button"], input[type="submit"], input[type="reset"]'

  /** @type {any} */
  var config = global.DEMOMAIW_CAPTURE || {}
  var sessionId = typeof config.sessionId === 'string' ? config.sessionId : ''
  var recorderOrigin = typeof config.recorderOrigin === 'string' ? config.recorderOrigin : '*'
  var enabled = config.autoConnect !== false

  /** @type {BroadcastChannel | null} */
  var channel = null
  var connected = false
  var lastClickKey = ''
  var lastClickAt = 0
  var startedAt = 0
  var handshakeTimer = null

  function clampString(value, max) {
    if (typeof value !== 'string') return ''
    var cleaned = value.replace(/\s+/g, ' ').trim()
    if (cleaned.length <= max) return cleaned
    return cleaned.slice(0, max - 1).trim() + '…'
  }

  function isSensitive(el) {
    if (!el || !el.tagName) return true
    var tag = el.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true
    var type = (el.getAttribute && el.getAttribute('type')) || ''
    if (String(type).toLowerCase() === 'password' || String(type).toLowerCase() === 'hidden') {
      return true
    }
    var meta =
      ((el.getAttribute && el.getAttribute('name')) || '') +
      ' ' +
      ((el.getAttribute && el.getAttribute('id')) || '') +
      ' ' +
      ((el.getAttribute && el.getAttribute('autocomplete')) || '')
    return SENSITIVE_RE.test(meta)
  }

  function findTarget(target) {
    if (!target || !target.closest) return null
    var interactive = target.closest(INTERACTIVE)
    if (interactive && !isSensitive(interactive)) return interactive
    if (isSensitive(target)) return null
    return target
  }

  function safeVisibleText(el) {
    if (isSensitive(el)) return ''
    if (el.closest && el.closest('input, textarea, [contenteditable="true"]')) return ''
    return clampString(el.textContent || '', MAX_TEXT)
  }

  function post(message) {
    if (channel) {
      try {
        channel.postMessage(message)
      } catch (_) {
        /* ignore */
      }
    }
    try {
      if (global.opener && !global.opener.closed) {
        global.opener.postMessage(message, recorderOrigin === '*' ? '*' : recorderOrigin)
      }
    } catch (_) {
      /* ignore */
    }
    try {
      global.postMessage(message, recorderOrigin === '*' ? '*' : recorderOrigin)
    } catch (_) {
      /* ignore */
    }
  }

  function sendHandshake() {
    if (!sessionId) return
    post({
      type: 'DEMOMAIW_HANDSHAKE',
      version: PROTOCOL_VERSION,
      sessionId: sessionId,
      role: 'client',
    })
  }

  function sendReady() {
    post({
      type: 'DEMOMAIW_READY',
      version: PROTOCOL_VERSION,
      sessionId: sessionId,
    })
  }

  function onClick(event) {
    if (!connected || !sessionId) return
    if (!event.isTrusted) return

    var el = findTarget(event.target)
    if (!el) return

    var vw = global.innerWidth || 1
    var vh = global.innerHeight || 1
    var x = Math.min(1, Math.max(0, event.clientX / vw))
    var y = Math.min(1, Math.max(0, event.clientY / vh))
    var key = x.toFixed(3) + ':' + y.toFixed(3) + ':' + (el.tagName || '')
    var now = Date.now()
    if (key === lastClickKey && now - lastClickAt < DEDUPE_MS) return
    lastClickKey = key
    lastClickAt = now

    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 }
    var aria = clampString((el.getAttribute && el.getAttribute('aria-label')) || '', MAX_TEXT)
    var title = clampString((el.getAttribute && el.getAttribute('title')) || '', MAX_TEXT)
    if (SENSITIVE_RE.test(aria) || SENSITIVE_RE.test(title)) {
      aria = ''
      title = ''
    }

    post({
      type: 'DEMOMAIW_CLICK_EVENT',
      version: PROTOCOL_VERSION,
      sessionId: sessionId,
      timestamp: startedAt ? now - startedAt : now,
      x: x,
      y: y,
      visibleText: safeVisibleText(el),
      ariaLabel: aria,
      title: title,
      tagName: String(el.tagName || 'div').toLowerCase(),
      boundingRect: {
        x: rect.x || 0,
        y: rect.y || 0,
        width: rect.width || 0,
        height: rect.height || 0,
      },
      viewportWidth: vw,
      viewportHeight: vh,
    })
  }

  function onMessage(event) {
    var data = event.data
    if (!data || typeof data !== 'object') return
    if (data.version !== PROTOCOL_VERSION) return
    if (data.sessionId !== sessionId) return

    if (recorderOrigin !== '*' && event.origin && event.origin !== recorderOrigin) {
      // Allow same-origin BroadcastChannel path (origin may be empty in some engines)
      if (event.origin) return
    }

    if (data.type === 'DEMOMAIW_HANDSHAKE' && data.role === 'recorder') {
      connected = true
      startedAt = Date.now()
      if (handshakeTimer) {
        clearInterval(handshakeTimer)
        handshakeTimer = null
      }
      sendReady()
      return
    }

    if (data.type === 'DEMOMAIW_DISCONNECT') {
      connected = false
    }
  }

  function connect(nextSessionId) {
    if (nextSessionId) sessionId = nextSessionId
    if (!sessionId) {
      console.warn('[demomaiw] capture client requires sessionId')
      return
    }
    if (typeof BroadcastChannel !== 'undefined' && !channel) {
      try {
        channel = new BroadcastChannel(CHANNEL_NAME)
        channel.onmessage = function (event) {
          onMessage({ data: event.data, origin: '' })
        }
      } catch (_) {
        channel = null
      }
    }
    global.addEventListener('message', onMessage)
    global.addEventListener('click', onClick, true)
    enabled = true
    sendHandshake()
    if (handshakeTimer) clearInterval(handshakeTimer)
    handshakeTimer = setInterval(function () {
      if (!connected) sendHandshake()
    }, 1500)
  }

  function disconnect() {
    connected = false
    if (sessionId) {
      post({
        type: 'DEMOMAIW_DISCONNECT',
        version: PROTOCOL_VERSION,
        sessionId: sessionId,
      })
    }
    global.removeEventListener('click', onClick, true)
    global.removeEventListener('message', onMessage)
    if (handshakeTimer) {
      clearInterval(handshakeTimer)
      handshakeTimer = null
    }
    if (channel) {
      try {
        channel.close()
      } catch (_) {
        /* ignore */
      }
      channel = null
    }
  }

  global.demomaiwCapture = {
    connect: connect,
    disconnect: disconnect,
    isConnected: function () {
      return connected
    },
    getSessionId: function () {
      return sessionId
    },
  }

  if (enabled && sessionId) {
    connect(sessionId)
  }
})(typeof window !== 'undefined' ? window : globalThis)
