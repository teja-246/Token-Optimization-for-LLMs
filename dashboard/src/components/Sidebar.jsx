// Sidebar.jsx — left panel of the chat UI
//
// Props interface is designed for Phase 6 (conversation history):
//   conversations  — array of { id, title, updatedAt }  (empty in Phase 3)
//   activeId       — id of the currently open conversation
//   onNewChat      — called when "New Chat" is clicked
//   onSelectConvo  — called with convo id when a conversation is clicked
//   user           — { name, email, picture } from auth.js
//   onLogout       — called when "Sign out" is clicked
//
// Phase 3: conversations is always [], activeId is null.
// Phase 6: storage.js fills conversations from localStorage.

import { useState } from 'react'
import { logout }   from '../utils/auth.js'

export default function Sidebar({
  conversations = [],
  activeId      = null,
  onNewChat     = () => {},
  onSelectConvo = () => {},
  user          = null,
}) {
  const [hovered, setHovered] = useState(null)

  function goToAnalytics() {
    window.location.hash = '#analytics'
  }

  return (
    <aside style={s.root}>

      {/* ── top: logo + new chat ── */}
      <div style={s.top}>
        <div style={s.logoRow}>
          <span style={s.logoHex}>⬡</span>
          <span style={s.logoText}>Aether</span>
          <span style={s.logoBadge}>beta</span>
        </div>

        <button
          style={s.newChatBtn}
          onClick={onNewChat}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <PlusIcon />
          New Chat
        </button>
      </div>

      {/* ── conversation list ── */}
      <nav style={s.nav} aria-label="Conversations">
        {conversations.length === 0 ? (
          <EmptyConversations />
        ) : (
          <>
            <span style={s.navLabel}>Recent</span>
            <div style={s.convoList}>
              {conversations.map(c => (
                <ConvoItem
                  key={c.id}
                  convo={c}
                  isActive={c.id === activeId}
                  isHovered={hovered === c.id}
                  onMouseEnter={() => setHovered(c.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelectConvo(c.id)}
                />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* ── bottom: analytics + user ── */}
      <div style={s.bottom}>

        <button
          style={s.analyticsBtn}
          onClick={goToAnalytics}
          onMouseEnter={e => {
            e.currentTarget.style.background   = 'var(--bg-hover)'
            e.currentTarget.style.borderColor  = 'var(--border-2)'
            e.currentTarget.style.color        = 'var(--text-primary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background  = 'transparent'
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color       = 'var(--text-secondary)'
          }}
        >
          <ChartIcon />
          <span>Analytics Dashboard</span>
          <span style={s.analyticsArrow}>↗</span>
        </button>

        <div style={s.divider} />

        <UserSection user={user} />
      </div>
    </aside>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function EmptyConversations() {
  return (
    <div style={s.emptyConvos}>
      <div style={s.emptyConvoIcon}>💬</div>
      <p style={s.emptyConvoText}>No conversations yet</p>
      <p style={s.emptyConvoSub}>Start a new chat above</p>
    </div>
  )
}

function ConvoItem({ convo, isActive, isHovered, onMouseEnter, onMouseLeave, onClick }) {
  return (
    <button
      style={{
        ...s.convoItem,
        ...(isActive  ? s.convoItemActive  : {}),
        ...(isHovered && !isActive ? s.convoItemHover : {}),
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      title={convo.title}
    >
      <span style={s.convoIcon}>💬</span>
      <span style={s.convoTitle}>{convo.title}</span>
    </button>
  )
}

function UserSection({ user }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const initial = (user?.name?.[0] ?? 'U').toUpperCase()

  return (
    <div style={s.userWrap}>
      <button
        style={s.userRow}
        onClick={() => setMenuOpen(m => !m)}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title="Account options"
      >
        {/* avatar */}
        <div style={s.avatar}>
          {user?.picture
            ? <img src={user.picture} alt="" style={s.avatarImg} referrerPolicy="no-referrer" />
            : <span>{initial}</span>
          }
        </div>

        {/* name + email */}
        <div style={s.userInfo}>
          <span style={s.userName}>{user?.name ?? 'User'}</span>
          <span style={s.userEmail}>{user?.email ?? ''}</span>
        </div>

        {/* chevron */}
        <span style={{ ...s.chevron, transform: menuOpen ? 'rotate(180deg)' : 'none' }}>
          ⌄
        </span>
      </button>

      {/* dropdown menu */}
      {menuOpen && (
        <div style={s.menu}>
          <button
            style={s.menuItem}
            onClick={logout}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span>⏻</span>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ── icons ─────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="8" width="3" height="5" rx="1" fill="currentColor"/>
      <rect x="5.5" y="5" width="3" height="8" rx="1" fill="currentColor"/>
      <rect x="10" y="2" width="3" height="11" rx="1" fill="currentColor"/>
    </svg>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────

const s = {
  root: {
    width: 260,
    flexShrink: 0,
    height: '100vh',
    background: 'var(--bg-card)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  // top
  top: {
    padding: '14px 12px 10px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flexShrink: 0,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 4px 6px',
  },
  logoHex:  { fontSize: 20, color: 'var(--indigo-2)', lineHeight: 1 },
  logoText: { fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' },
  logoBadge: {
    fontSize: 9, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--indigo-2)',
    background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.25)',
    padding: '1px 6px',
    borderRadius: 20,
    marginLeft: 2,
  },
  newChatBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, width: '100%', padding: '9px 12px',
    background: 'var(--indigo)',
    color: '#fff', border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  },

  // navigation / conversation list
  nav: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navLabel: {
    fontSize: 10, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    color: 'var(--text-muted)',
    padding: '4px 8px 6px',
    display: 'block',
  },
  convoList: { display: 'flex', flexDirection: 'column', gap: 1 },
  convoItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '8px 10px',
    background: 'transparent',
    border: 'none', borderRadius: 7,
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    color: 'var(--text-secondary)', fontSize: 13,
    transition: 'background 0.1s, color 0.1s',
  },
  convoItemActive: {
    background: 'rgba(99,102,241,0.12)',
    color: 'var(--text-primary)',
  },
  convoItemHover: {
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
  },
  convoIcon:  { fontSize: 13, flexShrink: 0, opacity: 0.6 },
  convoTitle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },

  // empty conversations
  emptyConvos: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 6, flex: 1,
    padding: '40px 20px', textAlign: 'center',
  },
  emptyConvoIcon: { fontSize: 28, opacity: 0.25, marginBottom: 4 },
  emptyConvoText: { fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 },
  emptyConvoSub:  { fontSize: 12, color: 'var(--text-muted)', opacity: 0.7 },

  // bottom section
  bottom: {
    padding: '8px 8px 10px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flexShrink: 0,
  },
  analyticsBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '9px 10px',
    background: 'transparent',
    border: '1px solid var(--border)', borderRadius: 7,
    color: 'var(--text-secondary)', fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
  },
  analyticsArrow: { marginLeft: 'auto', fontSize: 12, opacity: 0.5 },
  divider: { height: 1, background: 'var(--border)', margin: '2px 0' },

  // user section
  userWrap:   { position: 'relative' },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '8px 8px',
    background: 'transparent', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%',
    background: 'var(--indigo)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, flexShrink: 0, overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  userInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 },
  userName:  { fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userEmail: { fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chevron:   { fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.2s', marginRight: 2 },

  // dropdown
  menu: {
    position: 'absolute', bottom: '110%', left: 8, right: 8,
    background: 'var(--bg-card-2)',
    border: '1px solid var(--border)',
    borderRadius: 8, overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '10px 14px',
    background: 'transparent', border: 'none',
    color: 'var(--text-secondary)', fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.1s',
  },
}