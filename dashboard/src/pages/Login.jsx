// Login.jsx — Phase 2
//
// "Sign in with Google" now triggers a real OAuth redirect to /auth/google.
// The Go server handles the consent flow and redirects back to the frontend
// with ?token= in the URL, which App.jsx picks up and stores.
//
// The devLogin() shortcut from Phase 1 is removed.
// The "Phase 1" dev note is removed.

export default function Login() {
  // Clicking the button navigates to the Go gateway's OAuth entry point.
  // Vite's dev proxy forwards /auth/* to localhost:8000.
  function handleGoogleLogin() {
    window.location.href = '/auth/google'
  }

  return (
    <div style={styles.root}>

      {/* background dot-grid decoration */}
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

        {/* feature pills */}
        <div style={styles.features}>
          {[
            { icon: '⚡', label: 'Semantic cache' },
            { icon: '✂', label: 'Prompt pruning' },
            { icon: '↻', label: 'Loop detection' },
          ].map(f => (
            <div key={f.label} style={styles.featurePill}>
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </div>
          ))}
        </div>

        <div style={styles.divider} />

        {/* OAuth button */}
        <button style={styles.googleBtn} onClick={handleGoogleLogin}>
          <GoogleIcon />
          <span>Sign in with Google</span>
        </button>

        <p style={styles.disclaimer}>
          Your account is used only to identify your session.
          No data is shared with third parties.
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
  grid: {
    position: 'absolute', inset: 0,
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
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 },
  logoHex: { fontSize: 32, color: 'var(--indigo-2)' },
  logoText: { fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' },
  heading: {
    fontSize: 16, fontWeight: 600,
    textAlign: 'center', lineHeight: 1.4,
  },
  sub: {
    fontSize: 13, color: 'var(--text-secondary)',
    textAlign: 'center', lineHeight: 1.6, maxWidth: 300,
  },
  features: {
    display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
  },
  featurePill: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 12, color: 'var(--text-secondary)',
    background: 'var(--bg-card-2)',
    border: '1px solid var(--border)',
    padding: '4px 10px', borderRadius: 20,
  },
  divider: { width: '100%', height: 1, background: 'var(--border)', margin: '4px 0' },
  googleBtn: {
    width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
    padding: '11px 20px',
    background: 'var(--bg-card-2)',
    border: '1px solid var(--border-2)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.15s, border-color 0.15s',
  },
  disclaimer: {
    fontSize: 11, color: 'var(--text-muted)',
    textAlign: 'center', lineHeight: 1.5,
  },
  footer: { position: 'relative', fontSize: 12, color: 'var(--text-muted)' },
}