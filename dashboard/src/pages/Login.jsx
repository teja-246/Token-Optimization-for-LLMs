// Login.jsx — Phase 1 stub
//
// Shows the Aether login screen. The "Sign in with Google" button is
// visually complete but wired to a dev-only shortcut until Phase 2
// implements the real OAuth flow.
//
// Phase 2 will:
//   - Replace handleDevLogin with a redirect to GET /auth/google
//   - The Go callback will redirect back here with ?token=... in the URL

import { devLogin } from '../utils/auth.js'

export default function Login({ onLogin }) {

  // ── Phase 2 replaces this with: window.location.href = '/auth/google' ──
  function handleGoogleLogin() {
    devLogin()        // writes a fake token to localStorage
    onLogin()         // tells App.jsx auth state has changed
  }

  return (
    <div style={styles.root}>

      {/* background grid decoration */}
      <div style={styles.grid} aria-hidden="true" />

      {/* card */}
      <div style={styles.card}>

        {/* logo */}
        <div style={styles.logoRow}>
          <span style={styles.logoHex}>⬡</span>
          <span style={styles.logoText}>Aether</span>
        </div>

        {/* headline */}
        <h1 style={styles.heading}>Token Optimization Middleware</h1>
        <p style={styles.sub}>
          Intelligent caching, pruning, and hallucination detection
          for every LLM request.
        </p>

        {/* divider */}
        <div style={styles.divider} />

        {/* OAuth button */}
        <button style={styles.googleBtn} onClick={handleGoogleLogin}>
          <GoogleIcon />
          <span>Sign in with Google</span>
        </button>

        {/* Phase 2 notice — remove when real OAuth is wired */}
        <p style={styles.devNote}>
          ⚙ Phase 1: clicking the button injects a dev token.
          Real Google OAuth is implemented in Phase 2.
        </p>

      </div>

      {/* footer */}
      <p style={styles.footer}>Aether · LLM Middleware Proxy</p>
    </div>
  )
}

// ── Google "G" SVG icon ───────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.2C9.5 35.5 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.2 5.2C41.3 35.2 44 30 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-base)',
    position: 'relative',
    overflow: 'hidden',
    gap: 24,
  },
  // subtle dot-grid background
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(circle, #1f2d45 1px, transparent 1px)',
    backgroundSize: '32px 32px',
    opacity: 0.5,
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '40px 44px',
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  logoHex: { fontSize: 32, color: 'var(--indigo-2)' },
  logoText: {
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    color: 'var(--text-primary)',
  },
  heading: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-primary)',
    textAlign: 'center',
    lineHeight: 1.4,
  },
  sub: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    textAlign: 'center',
    lineHeight: 1.6,
    maxWidth: 300,
  },
  divider: {
    width: '100%',
    height: 1,
    background: 'var(--border)',
    margin: '4px 0',
  },
  googleBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '11px 20px',
    background: 'var(--bg-card-2)',
    border: '1px solid var(--border-2)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    fontFamily: 'inherit',
  },
  devNote: {
    fontSize: 11,
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 1.5,
  },
  footer: {
    position: 'relative',
    fontSize: 12,
    color: 'var(--text-muted)',
  },
}