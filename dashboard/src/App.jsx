// App.jsx — hash-based router (Phase 2: handle OAuth redirect token)
//
// Phase 2 adds one responsibility: on mount, check whether the URL contains
// ?token= (set by the Go callback after Google OAuth). If found:
//   1. save the token to localStorage via setToken()
//   2. strip it from the URL so it never appears in browser history
//   3. set authed = true → render the Chat page
//
// Everything else is identical to Phase 1.

import { useState, useEffect } from 'react'
import { isAuthenticated, setToken } from './utils/auth.js'
import Login     from './pages/Login.jsx'
import Chat      from './pages/Chat.jsx'
import Analytics from './pages/Analytics.jsx'

function currentPage() {
  const hash = window.location.hash.replace(/^#/, '').trim()
  if (!hash || hash === 'chat') return 'chat'
  if (hash === 'analytics')     return 'analytics'
  return 'chat'
}

export default function App() {
  const [authed, setAuthed] = useState(false) // start false — useEffect resolves
  const [page,   setPage]   = useState(currentPage)

  // ── Phase 2: read OAuth token from URL on first render ────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('token')

    if (token) {
      // 1. persist the JWT
      setToken(token)

      // 2. strip ?token= from the URL — we never want this in browser history
      //    replaceState keeps the current page without adding a history entry
      const cleanURL = window.location.pathname + window.location.hash
      window.history.replaceState({}, '', cleanURL)

      // 3. navigate to chat
      window.location.hash = '#chat'
      setPage('chat')
      setAuthed(true)
      return
    }

    // check for OAuth error (user declined consent or Google returned an error)
    const authError = params.get('auth_error')
    if (authError) {
      console.warn('[auth] OAuth error from Google:', authError)
      const cleanURL = window.location.pathname
      window.history.replaceState({}, '', cleanURL)
      // stay on login page — the Login component will show an error if needed
    }

    // no token in URL — check localStorage
    setAuthed(isAuthenticated())
  }, []) // runs once on mount

  // re-route on hash change (analytics button, back-to-chat button)
  useEffect(() => {
    function onHashChange() { setPage(currentPage()) }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // detect logout from another tab
  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'aether_token') setAuthed(isAuthenticated())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <Login
        onLogin={() => {
          setAuthed(true)
          window.location.hash = '#chat'
          setPage('chat')
        }}
      />
    )
  }

  if (page === 'analytics') return <Analytics />
  return <Chat />
}