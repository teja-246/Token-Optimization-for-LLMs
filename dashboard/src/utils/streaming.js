// streaming.js — callback-based SSE consumer for Aether's /v1/chat endpoint
//
// ── Why fetch and not EventSource? ───────────────────────────────────────────
//
// The browser's native EventSource only supports GET requests with no body.
// Our endpoint is POST (prompt in JSON body, JWT in Authorization header).
// We therefore use fetch() with a ReadableStream and parse SSE lines manually.
//
// ── SSE format emitted by the Go gateway ─────────────────────────────────────
//
//   data: {"token":"Hello"}\n\n                          ← normal token
//   data: {"token":" world","phase":"correction"}\n\n    ← CoVe correction
//   data: {"type":"loop_detected","cycle_length":2,"message":"..."}\n\n
//   data: {"type":"remediation","diagnosis":"...","search_performed":true,
//           "previous_model":"...","new_model":"...","escalated":true,
//           "message":"..."}\n\n
//   data: {"done":true,"model":"...","cache":"MISS","similarity":0,
//           "input_tokens":N,"output_tokens":N,"latency_ms":N,
//           "original_tokens":N,"pruned_tokens":N,"compression_ratio":0.67,
//           "cycle_detected":false,"remediation_applied":false}\n\n
//   data: [DONE]\n\n                                     ← stream complete

import { getToken } from './auth.js'

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Open a streaming chat request to Aether and dispatch callbacks as
 * events arrive from the server.
 *
 * @param {object}    opts
 * @param {string}    opts.prompt          — user's message text
 * @param {string}    opts.sessionId       — conversation UUID (from newSessionId)
 * @param {AbortSignal} [opts.signal]      — cancel the stream (AbortController.signal)
 * @param {function}  [opts.onToken]       — (text: string, phase: string|null) => void
 * @param {function}  [opts.onLoopDetected]— (event: object) => void
 * @param {function}  [opts.onRemediation] — (event: object) => void
 * @param {function}  [opts.onFinal]       — (event: object) => void
 * @param {function}  [opts.onError]       — (message: string) => void
 *
 * Returns a promise that resolves when the stream ends (cleanly or on error).
 * Returns null if aborted via the signal.
 */
export async function streamChat({
  prompt,
  sessionId,
  signal       = null,
  onToken        = () => {},
  onLoopDetected = () => {},
  onRemediation  = () => {},
  onFinal        = () => {},
  onError        = () => {},
}) {
  const token = getToken()
  if (!token) {
    onError('Not authenticated — please sign in again.')
    return
  }

  // ── 1. open HTTP connection ───────────────────────────────────────────────

  let response
  try {
    response = await fetch('/v1/chat', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body:   JSON.stringify({ prompt, session_id: sessionId }),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') return null
    onError(`Network error: ${err.message}`)
    return
  }

  // ── 2. handle non-200 ────────────────────────────────────────────────────

  if (!response.ok) {
    let message = `Server error (${response.status})`
    try {
      const body = await response.json()
      message = body.error ?? message
    } catch (_) {}
    onError(message)
    return
  }

  // ── 3. read and parse SSE stream ─────────────────────────────────────────

  const reader  = response.body.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''     // holds partial SSE events between network chunks

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      // `stream: true` keeps the TextDecoder's internal state so multi-byte
      // UTF-8 characters that straddle chunk boundaries decode correctly
      buffer += decoder.decode(value, { stream: true })

      // SSE events are separated by a blank line (\n\n).
      // Split on that delimiter — the last element may be an incomplete event,
      // so we keep it in the buffer and wait for the next chunk.
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const line = part.trim()

        // every SSE event line starts with "data:"
        if (!line.startsWith('data:')) continue

        const raw = line.slice(5).trim()

        // ── [DONE] — stream finished cleanly ─────────────────────────────
        if (raw === '[DONE]') return

        // ── parse JSON payload ────────────────────────────────────────────
        let event
        try {
          event = JSON.parse(raw)
        } catch (_) {
          // skip malformed JSON — never break the whole stream over one bad chunk
          continue
        }

        // ── dispatch to the correct callback ─────────────────────────────

        if (event.error) {
          onError(event.error)
          return
        }

        if (event.type === 'loop_detected') {
          onLoopDetected(event)
          continue
        }

        if (event.type === 'remediation') {
          onRemediation(event)
          continue
        }

        if (event.done === true) {
          onFinal(event)
          return
        }

        if (typeof event.token === 'string') {
          // phase is null for normal tokens, "correction" for CoVe retries
          onToken(event.token, event.phase ?? null)
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') return null
    onError(`Stream read error: ${err.message}`)
  } finally {
    // always release the reader — even if we returned early
    reader.cancel().catch(() => {})
  }
}

// ── Session ID ────────────────────────────────────────────────────────────────

/**
 * Generate a UUID v4 for a new conversation session.
 * Uses the browser's built-in crypto.randomUUID() — available in all
 * modern browsers and Node 14.17+.
 */
export function newSessionId() {
  return crypto.randomUUID()
}