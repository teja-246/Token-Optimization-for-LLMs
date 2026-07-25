// App.jsx — hash-based router
//
// Routing logic:
//   No token in localStorage  →  Login page (always)
//   Token present + #analytics →  Analytics dashboard
//   Token present + anything   →  Chat page
//
// The router re-evaluates on:
//   - hashchange events (user clicks navigation links)
//   - storage events (logout from another tab clears the token)

import { useState, useEffect } from 'react'
import { isAuthenticated }     from './utils/auth.js'
import Login     from './pages/Login.jsx'
import Chat      from './pages/Chat.jsx'
import Analytics from './pages/Analytics.jsx'

/** Read the current page from the URL hash. */
function currentPage() {
  // strip the leading '#'
  const hash = window.location.hash.replace(/^#/, '').trim()
  if (!hash || hash === 'chat') return 'chat'
  if (hash === 'analytics')     return 'analytics'
  return 'chat' // unknown hash → default to chat
}

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated)
  const [page,   setPage]   = useState(currentPage)

  // re-route when the hash changes (e.g. the analytics button is clicked)
  useEffect(() => {
    function onHashChange() {
      setPage(currentPage())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // detect logout from another tab
  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'aether_token') {
        setAuthed(isAuthenticated())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // ── Not authenticated → always show Login ──────────────────────────────────
  if (!authed) {
    return (
      <Login
        onLogin={() => {
          setAuthed(true)
          // make sure we land on chat after login
          window.location.hash = '#chat'
          setPage('chat')
        }}
      />
    )
  }

  // ── Authenticated → route by hash ─────────────────────────────────────────
  if (page === 'analytics') return <Analytics />
  return <Chat />
}