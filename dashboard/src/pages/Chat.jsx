// Chat.jsx — Phase 1 stub
//
// Full layout skeleton: sidebar + main area.
// No backend calls yet — sending a message logs to console.
// Phase 3 fills the sidebar with real conversation history.
// Phase 4 wires up the SSE streaming.

import { useState, useRef, useEffect } from 'react'
import { getUser, logout } from '../utils/auth.js'

// ── placeholder conversation for visual testing ───────────────────────────────
const PLACEHOLDER_CONVOS = [
  { id: 'c1', title: 'Explain transformer architecture', active: false },
  { id: 'c2', title: 'Python async/await patterns',      active: false },
  { id: 'c3', title: 'Design a Redis cache layer',        active: true  },
]

export default function Chat() {
  const user = getUser()

  const [input,        setInput]        = useState('')
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const textareaRef = useRef(null)

  // auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [input])

  function handleSend() {
    const prompt = input.trim()
    if (!prompt) return
    // Phase 4 will replace this with the actual SSE call
    console.log('[Phase 1 stub] sending prompt:', prompt)
    setInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleNewChat() {
    console.log('[Phase 1 stub] new chat')
  }

  function goToAnalytics() {
    window.location.hash = '#analytics'
  }

  return (
    <div style={styles.root}>

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <aside style={styles.sidebar}>

          {/* top: logo + new chat */}
          <div style={styles.sidebarTop}>
            <div style={styles.logoRow}>
              <span style={styles.logoHex}>⬡</span>
              <span style={styles.logoText}>Aether</span>
            </div>
            <button style={styles.newChatBtn} onClick={handleNewChat}>
              <span style={{ fontSize: 16 }}>＋</span>
              New Chat
            </button>
          </div>

          {/* conversation list */}
          <div style={styles.convoSection}>
            <span style={styles.convoLabel}>Recent</span>
            <div style={styles.convoList}>
              {PLACEHOLDER_CONVOS.map(c => (
                <button
                  key={c.id}
                  style={{ ...styles.convoItem, ...(c.active ? styles.convoItemActive : {}) }}
                  onClick={() => console.log('[Phase 1 stub] switch to', c.id)}
                >
                  <span style={styles.convoIcon}>💬</span>
                  <span style={styles.convoTitle}>{c.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* bottom: analytics + user */}
          <div style={styles.sidebarBottom}>
            <button style={styles.analyticsBtn} onClick={goToAnalytics}>
              <span>📊</span>
              Analytics Dashboard
            </button>

            <div style={styles.userRow}>
              <div style={styles.avatar}>
                {user?.picture
                  ? <img src={user.picture} alt="" style={styles.avatarImg} />
                  : <span>{(user?.name?.[0] ?? 'U').toUpperCase()}</span>
                }
              </div>
              <div style={styles.userInfo}>
                <span style={styles.userName}>{user?.name ?? 'User'}</span>
                <span style={styles.userEmail}>{user?.email ?? ''}</span>
              </div>
              <button style={styles.logoutBtn} onClick={logout} title="Sign out">
                ⏻
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ── Main area ── */}
      <div style={styles.main}>

        {/* top bar */}
        <div style={styles.topBar}>
          <button
            style={styles.toggleBtn}
            onClick={() => setSidebarOpen(s => !s)}
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            ☰
          </button>
          <span style={styles.topBarTitle}>Chat</span>
          {/* Phase 4 will show current model + session ID here */}
          <span style={styles.topBarMeta}>Powered by Groq · Llama 3</span>
        </div>

        {/* message area */}
        <div style={styles.messages}>
          {/* Phase 3+ will render actual messages here */}
          <EmptyState />
        </div>

        {/* input bar */}
        <div style={styles.inputWrap}>
          <div style={styles.inputBox}>
            <textarea
              ref={textareaRef}
              style={styles.textarea}
              placeholder="Message Aether… (Shift+Enter for newline)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              style={{
                ...styles.sendBtn,
                opacity: input.trim() ? 1 : 0.35,
                cursor: input.trim() ? 'pointer' : 'default',
              }}
              onClick={handleSend}
              disabled={!input.trim()}
            >
              ↑
            </button>
          </div>
          <p style={styles.inputNote}>
            Responses pass through Aether's pruning, caching, and cycle detection pipeline.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={emptyStyles.root}>
      <div style={emptyStyles.icon}>⬡</div>
      <h2 style={emptyStyles.heading}>What can I help you with?</h2>
      <p style={emptyStyles.sub}>
        Your prompt will be pruned, checked against the semantic cache,
        routed to the right model, and monitored for loops — all automatically.
      </p>
      <div style={emptyStyles.pills}>
        {[
          'Explain transformer attention',
          'Write a Go HTTP server',
          'Design a Redis cache layer',
          'What is token optimization?',
        ].map(s => (
          <button key={s} style={emptyStyles.pill}>{s}</button>
        ))}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  root: {
    display: 'flex',
    height: '100vh',
    background: 'var(--bg-base)',
    overflow: 'hidden',
  },

  // sidebar
  sidebar: {
    width: 260,
    flexShrink: 0,
    background: 'var(--bg-card)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarTop: {
    padding: '16px 12px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    borderBottom: '1px solid var(--border)',
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 8px' },
  logoHex: { fontSize: 20, color: 'var(--indigo-2)' },
  logoText: { fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' },
  newChatBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '9px 12px',
    background: 'var(--indigo)', color: '#fff',
    border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  },

  // conversation list
  convoSection: {
    flex: 1, overflow: 'auto', padding: '12px 8px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  convoLabel: {
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: 'var(--text-muted)',
    padding: '4px 8px', display: 'block',
  },
  convoList: { display: 'flex', flexDirection: 'column', gap: 1 },
  convoItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '8px 10px',
    background: 'transparent', border: 'none',
    borderRadius: 6, cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left',
    transition: 'background 0.1s',
    color: 'var(--text-secondary)',
  },
  convoItemActive: {
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
  },
  convoIcon: { fontSize: 13, flexShrink: 0 },
  convoTitle: {
    fontSize: 13, overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  // sidebar bottom
  sidebarBottom: {
    padding: '8px 8px 12px',
    borderTop: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  analyticsBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '9px 10px',
    background: 'transparent',
    border: '1px solid var(--border)', borderRadius: 7,
    color: 'var(--text-secondary)', fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.15s, color 0.15s',
  },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '6px 4px',
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%',
    background: 'var(--indigo)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 600, flexShrink: 0, overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  userInfo: {
    flex: 1, minWidth: 0,
    display: 'flex', flexDirection: 'column', gap: 1,
  },
  userName:  { fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userEmail: { fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logoutBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', fontSize: 16, padding: '4px',
    borderRadius: 4, flexShrink: 0,
    transition: 'color 0.15s',
  },

  // main
  main: {
    flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    minWidth: 0,
  },
  topBar: {
    height: 52, display: 'flex', alignItems: 'center', gap: 12,
    padding: '0 20px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg-card)', flexShrink: 0,
  },
  toggleBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: 18, padding: '4px 6px', borderRadius: 4,
    fontFamily: 'inherit',
  },
  topBarTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' },
  topBarMeta:  { marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' },

  // messages
  messages: {
    flex: 1, overflow: 'auto',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
  },

  // input
  inputWrap: {
    padding: '12px 20px 16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-card)',
    flexShrink: 0,
  },
  inputBox: {
    display: 'flex', alignItems: 'flex-end', gap: 10,
    background: 'var(--bg-card-2)',
    border: '1px solid var(--border-2)',
    borderRadius: 12, padding: '10px 10px 10px 16px',
    maxWidth: 760, margin: '0 auto',
  },
  textarea: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6,
    resize: 'none', fontFamily: 'inherit', minHeight: 24,
    maxHeight: 180, overflowY: 'auto',
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 8,
    background: 'var(--indigo)', border: 'none',
    color: '#fff', fontSize: 18, fontWeight: 700,
    cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.15s',
  },
  inputNote: {
    fontSize: 11, color: 'var(--text-muted)',
    textAlign: 'center', marginTop: 8,
    maxWidth: 760, margin: '8px auto 0',
  },
}

const emptyStyles = {
  root: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center',
    maxWidth: 520, margin: 'auto', gap: 16,
  },
  icon: { fontSize: 48, color: 'var(--indigo-2)', lineHeight: 1 },
  heading: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' },
  sub: { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 },
  pills: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  pill: {
    padding: '8px 14px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 20, fontSize: 13,
    color: 'var(--text-secondary)', cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s, color 0.15s',
  },
}