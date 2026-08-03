// Chat.jsx — Phase 4.3: streaming fully wired
//
// ── Stale-closure strategy ────────────────────────────────────────────────────
//
// The streamChat callbacks fire outside React's render cycle. If a callback
// captures a state variable directly (e.g. `messages`) it gets the value
// from the render in which it was created — not the latest value. This is
// the classic stale-closure bug.
//
// Fix: store all mutable streaming state in refs, and always update React
// state using the functional form `setMessages(prev => ...)` so we operate
// on the latest snapshot regardless of when the callback fires.
//
// Refs used during a stream:
//   assistantIdRef  — id of the message currently being built
//   contentRef      — accumulates main response tokens
//   correctionRef   — accumulates CoVe correction tokens
//   eventsRef       — accumulates loop_detected / remediation events
//   sessionRef      — session UUID for the current conversation
//
// ── Message lifecycle ─────────────────────────────────────────────────────────
//
//   { loading:true,  streaming:false }  →  thinking bubble (3 dots)
//   { loading:false, streaming:true  }  →  text building up, cursor blinks
//   { loading:false, streaming:false }  →  complete, meta tags visible

import { useState, useRef, useEffect, useCallback } from 'react'
import { getUser }         from '../utils/auth.js'
import { streamChat, newSessionId } from '../utils/streaming.js'
import {
  loadConversations,
  loadConversation,
  createConversation,
  appendMessage,
  deleteConversation,
} from '../utils/storage.js'
import Sidebar     from '../components/Sidebar.jsx'
import ChatMessage from '../components/ChatMessage.jsx'

// ── Suggestion chips on the empty state ──────────────────────────────────────

const SUGGESTIONS = [
  { icon: '🧠', text: 'Explain transformer attention mechanisms' },
  { icon: '⚡', text: 'Write a Go HTTP middleware for rate limiting' },
  { icon: '🗄', text: 'Design a Redis-backed semantic cache layer' },
  { icon: '🔍', text: 'What is token optimization in LLM systems?' },
]

// ─────────────────────────────────────────────────────────────────────────────

export default function Chat() {
  const user = getUser()

  // ── layout ────────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // ── conversation list (kept in sync with localStorage) ───────────────────
  const [conversations, setConversations] = useState(() => loadConversations())
  const [activeId,      setActiveId]      = useState(null)

  // ── messages for the current conversation ────────────────────────────────
  const [messages, setMessages] = useState([])

  // ── input / send state ────────────────────────────────────────────────────
  const [input,   setInput]   = useState('')
  const [sending, setSending] = useState(false)

  // ── refs ─────────────────────────────────────────────────────────────────
  const textareaRef    = useRef(null)
  const bottomRef      = useRef(null)
  const abortRef       = useRef(null)  // AbortController for the live stream

  // streaming accumulators — updated inside callbacks, never trigger re-renders
  const assistantIdRef = useRef(null)
  const contentRef     = useRef('')
  const correctionRef  = useRef('')
  const eventsRef      = useRef([])
  const sessionRef     = useRef(null)

  // ── auto-grow textarea ────────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  // ── auto-scroll to latest message ────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── helper: update the streaming assistant message in state ───────────────
  // Always uses the functional form so stale closures are never a problem.
  function patchAssistant(updates) {
    const id = assistantIdRef.current
    if (!id) return
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
  }

  // ── reload sidebar from localStorage ─────────────────────────────────────
  function refreshConversations() {
    setConversations(loadConversations())
  }

  // ── new chat ──────────────────────────────────────────────────────────────
  const startNewChat = useCallback(() => {
    abortRef.current?.abort()

    const id = newSessionId()
    sessionRef.current = id

    setActiveId(null)
    setMessages([])
    setInput('')
    setSending(false)

    createConversation(id)
    refreshConversations()

    // reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    textareaRef.current?.focus()
  }, [])

  // start a fresh chat on first mount
  useEffect(() => { startNewChat() }, []) // eslint-disable-line

  // ── switch conversation ───────────────────────────────────────────────────
  function selectConversation(id) {
    abortRef.current?.abort()

    const convo = loadConversation(id)
    if (!convo) return

    sessionRef.current = id
    setActiveId(id)
    setMessages(convo.messages)
    setSending(false)
    textareaRef.current?.focus()
  }

  function handleConvoDeleted(deletedId) {
    deleteConversation(deletedId)
    refreshConversations()
    if (activeId === deletedId) startNewChat()
  }

  // ── send ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    const prompt    = input.trim()
    const sessionId = sessionRef.current
    if (!prompt || sending) return

    // clear input immediately so user can type the next message
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // ── 1. append user message ────────────────────────────────────────────
    const userMsg = {
      id: crypto.randomUUID(), role: 'user',
      content: prompt, correction: '', events: [],
      meta: null, error: null, loading: false, streaming: false,
    }
    setMessages(prev => [...prev, userMsg])
    appendMessage(sessionId, {
      role: 'user', content: prompt,
      correction: '', events: [], meta: null, error: null,
    })

    // update sidebar so the title appears from the first message
    setActiveId(sessionId)
    refreshConversations()

    // ── 2. add assistant placeholder (thinking bubble) ────────────────────
    const aId = crypto.randomUUID()
    assistantIdRef.current = aId
    contentRef.current     = ''
    correctionRef.current  = ''
    eventsRef.current      = []

    setMessages(prev => [...prev, {
      id: aId, role: 'assistant',
      content: '', correction: '', events: [],
      meta: null, error: null,
      loading: true, streaming: false,
    }])

    // ── 3. open SSE stream ────────────────────────────────────────────────
    setSending(true)
    abortRef.current = new AbortController()

    await streamChat({
      prompt,
      sessionId,
      signal: abortRef.current.signal,

      // ── first token: flip from thinking → streaming ─────────────────
      onToken(text, phase) {
        if (phase === 'correction') {
          correctionRef.current += text
          patchAssistant({
            loading:    false,
            streaming:  true,
            correction: correctionRef.current,
          })
        } else {
          contentRef.current += text
          patchAssistant({
            loading:   false,
            streaming: true,
            content:   contentRef.current,
          })
        }
      },

      // ── loop detected: push event card mid-stream ───────────────────
      onLoopDetected(event) {
        eventsRef.current = [...eventsRef.current, event]
        patchAssistant({ events: eventsRef.current })
      },

      // ── remediation: push card, correction tokens follow ────────────
      onRemediation(event) {
        eventsRef.current = [...eventsRef.current, event]
        patchAssistant({ events: eventsRef.current })
      },

      // ── final: stop cursor, attach metadata ─────────────────────────
      onFinal(event) {
        const finalMsg = {
          loading:    false,
          streaming:  false,
          content:    contentRef.current,
          correction: correctionRef.current,
          events:     eventsRef.current,
          meta:       event,
          error:      null,
        }
        patchAssistant(finalMsg)

        // persist the completed assistant message to localStorage
        appendMessage(sessionRef.current, {
          role: 'assistant', ...finalMsg,
        })
        refreshConversations()
        setSending(false)
      },

      // ── error: replace thinking bubble with error state ─────────────
      onError(msg) {
        patchAssistant({ loading: false, streaming: false, error: msg })
        setSending(false)
      },
    })

    // guard: if the stream ended without calling onFinal or onError
    // (e.g. server closed connection early), clean up gracefully
    patchAssistant(prev => ({
      loading:   false,
      streaming: false,
      // only set a generic error if neither content nor error arrived
      ...(prev?.content || prev?.error ? {} : { error: 'No response received.' }),
    }))
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSuggestion(text) {
    setInput(text)
    textareaRef.current?.focus()
  }

  // ── derived values ────────────────────────────────────────────────────────
  const canSend    = input.trim().length > 0 && !sending
  const activeMeta = conversations.find(c => c.id === activeId)

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>

      {/* ── sidebar ── */}
      {sidebarOpen && (
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onNewChat={startNewChat}
          onSelectConvo={selectConversation}
          onConvoDeleted={handleConvoDeleted}
          user={user}
        />
      )}

      {/* ── main panel ── */}
      <div style={s.main}>

        {/* top bar */}
        <div style={s.topBar}>
          <button
            style={s.menuBtn}
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <MenuIcon />
          </button>

          <span style={s.topTitle}>
            {activeMeta?.title ?? 'New Chat'}
          </span>

          <div style={s.topRight}>
            {/* streaming indicator */}
            {sending && (
              <div style={s.streamPill}>
                <span style={s.streamDot} />
                Streaming…
              </div>
            )}
            {/* model indicator */}
            <div style={s.modelPill}>
              <span style={s.modelDot} />
              Llama 3 · Groq
            </div>
          </div>
        </div>

        {/* message area */}
        <div style={s.msgArea}>
          {messages.length === 0 ? (
            <EmptyState onSuggestion={handleSuggestion} />
          ) : (
            <div style={s.msgList}>
              {messages.map(m => (
                <ChatMessage key={m.id} message={m} />
              ))}
              {/* invisible anchor for auto-scroll */}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* input bar */}
        <div style={s.inputWrap}>
          <div style={{
            ...s.inputBox,
            borderColor: sending ? 'var(--indigo)' : 'var(--border-2)',
          }}>
            <textarea
              ref={textareaRef}
              style={s.textarea}
              placeholder={sending ? 'Streaming response…' : 'Message Aether…'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending}
              aria-label="Message input"
            />
            <button
              style={{
                ...s.sendBtn,
                background: canSend ? 'var(--indigo)' : 'var(--bg-hover)',
                cursor:     canSend ? 'pointer'       : 'default',
              }}
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Send message"
            >
              {sending ? <SpinnerIcon /> : <UpIcon />}
            </button>
          </div>
          <p style={s.hint}>
            <kbd style={s.kbd}>Enter</kbd> send &nbsp;·&nbsp;
            <kbd style={s.kbd}>Shift+Enter</kbd> new line &nbsp;·&nbsp;
            Processed by Aether
          </p>
        </div>

      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onSuggestion }) {
  const [hov, setHov] = useState(null)
  return (
    <div style={es.root}>
      <div style={es.iconWrap}>
        <span style={es.icon}>⬡</span>
      </div>
      <h2 style={es.h}>What can I help you with?</h2>
      <p style={es.p}>
        Your messages pass through Aether's semantic cache, prompt pruning,
        intelligent routing, and loop-detection pipeline — automatically.
      </p>
      <div style={es.grid}>
        {SUGGESTIONS.map((sg, i) => (
          <button
            key={i}
            style={{ ...es.card, ...(hov === i ? es.cardHov : {}) }}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
            onClick={() => onSuggestion(sg.text)}
          >
            <span style={es.sgIcon}>{sg.icon}</span>
            <span style={es.sgText}>{sg.text}</span>
          </button>
        ))}
      </div>
      <div style={es.legend}>
        {[
          ['var(--green)',     'Semantic cache'],
          ['var(--cyan)',      'Prompt pruning'],
          ['var(--indigo-2)',  'Smart routing'],
          ['var(--amber)',     'Loop detection'],
        ].map(([c, l]) => (
          <div key={l} style={es.item}>
            <div style={{ ...es.dot, background: c }} />
            <span style={es.lbl}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  root:    { display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' },
  main:    { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },

  topBar: {
    height: 52, display: 'flex', alignItems: 'center', gap: 12,
    padding: '0 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-card)', flexShrink: 0,
  },
  menuBtn: {
    padding: '6px 7px', background: 'transparent', border: 'none',
    borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)',
    display: 'flex', alignItems: 'center',
    transition: 'background 0.15s',
  },
  topTitle: {
    fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  topRight:   { display: 'flex', alignItems: 'center', gap: 8 },
  streamPill: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 11, color: 'var(--indigo-2)',
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.2)',
    padding: '3px 10px', borderRadius: 20,
    animation: 'pulse 1.4s ease-in-out infinite',
  },
  streamDot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--indigo-2)', flexShrink: 0 },
  modelPill: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: 'var(--text-muted)',
    background: 'var(--bg-card-2)',
    border: '1px solid var(--border)',
    padding: '4px 10px', borderRadius: 20,
  },
  modelDot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 },

  msgArea: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  msgList: {
    display: 'flex', flexDirection: 'column',
    maxWidth: 820, width: '100%',
    margin: '0 auto', padding: '28px 24px', gap: 24,
  },

  inputWrap: {
    padding: '12px 20px 14px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-card)', flexShrink: 0,
  },
  inputBox: {
    display: 'flex', alignItems: 'flex-end', gap: 10,
    background: 'var(--bg-card-2)',
    border: '1px solid',
    borderRadius: 14, padding: '10px 12px 10px 16px',
    maxWidth: 820, margin: '0 auto',
    transition: 'border-color 0.2s',
  },
  textarea: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.65,
    resize: 'none', fontFamily: 'inherit',
    minHeight: 24, maxHeight: 200, overflowY: 'auto',
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 9,
    border: 'none', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'background 0.15s',
  },
  hint: {
    fontSize: 11, color: 'var(--text-muted)',
    textAlign: 'center', maxWidth: 820,
    margin: '8px auto 0',
  },
  kbd: {
    fontSize: 10, fontFamily: 'var(--font-mono)',
    background: 'var(--bg-card-2)',
    border: '1px solid var(--border)',
    borderRadius: 4, padding: '1px 5px',
    color: 'var(--text-muted)',
  },
}

const es = {
  root: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', maxWidth: 600, margin: 'auto',
    padding: '52px 24px', gap: 20,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  icon:    { fontSize: 26, color: 'var(--indigo-2)' },
  h:       { fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 },
  p:       { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 420 },
  grid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' },
  card: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '14px 16px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)', borderRadius: 10,
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
    transition: 'background 0.15s, border-color 0.15s, transform 0.1s',
  },
  cardHov: { background: 'var(--bg-card-2)', borderColor: 'var(--border-2)', transform: 'translateY(-1px)' },
  sgIcon:  { fontSize: 17, flexShrink: 0, marginTop: 1 },
  sgText:  { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 },
  legend:  { display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  item:    { display: 'flex', alignItems: 'center', gap: 6 },
  dot:     { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  lbl:     { fontSize: 12, color: 'var(--text-muted)' },
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M2 8h12M2 12h12"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function UpIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 11.5V3.5M3.5 7.5l4-4 4 4"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="7.5" cy="7.5" r="5.5"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeDasharray="26" strokeDashoffset="10"/>
    </svg>
  )
}